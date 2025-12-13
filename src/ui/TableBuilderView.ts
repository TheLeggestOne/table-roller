import { App, ItemView, WorkspaceLeaf, TFile, Modal, Notice } from 'obsidian';
import { TableRollerCore } from '../services/TableRollerCore';
import { TableParser } from '../services/TableParser';

export const VIEW_TYPE_TABLE_BUILDER = 'table-builder';

interface ColumnConfig {
	name: string;
	type: 'dice' | 'regular' | 'reroll';
	diceNotation?: string; // e.g., 'd6', '2d6', 'd100'
}

interface RowData {
	range?: string; // For dice columns
	[columnName: string]: string | undefined;
}

interface TableState {
	tableName: string;
	columns: ColumnConfig[];
	rows: RowData[];
	isPrivate: boolean;
	tableReroll?: string;
}

interface HistoryEntry {
	state: TableState;
	timestamp: number;
}

export class TableBuilderView extends ItemView {
	private roller: TableRollerCore;
	private state: TableState;
	private hasUnsavedChanges: boolean = false;
	private selectedRowIndex: number = 0;
	private currentFile: TFile | null = null; // Track the file we loaded from
	
	// UI elements
	private leftPanel: HTMLElement;
	private rightPanel: HTMLElement;
	private tableNameInput: HTMLInputElement;
	private rowGrid: HTMLElement;
	private previewContainer: HTMLElement;
	private markdownPreview: HTMLElement;
	private htmlPreview: HTMLElement;
	
	// History for undo/redo
	private history: HistoryEntry[] = [];
	private historyIndex: number = -1;
	private readonly MAX_HISTORY = 50;
	
	// Debounce timer for preview updates
	private previewUpdateTimer: NodeJS.Timeout | null = null;

	constructor(leaf: WorkspaceLeaf, roller: TableRollerCore) {
		super(leaf);
		this.roller = roller;
		this.state = this.getDefaultState();
	}

	getViewType(): string {
		return VIEW_TYPE_TABLE_BUILDER;
	}

	getDisplayText(): string {
		const asterisk = this.hasUnsavedChanges ? '*' : '';
		return `Table Builder${asterisk}`;
	}

	getIcon(): string {
		return 'table';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('table-builder-view');

		// Create split layout
		const splitContainer = container.createDiv({ cls: 'table-builder-split' });
		
		this.leftPanel = splitContainer.createDiv({ cls: 'table-builder-left-panel' });
		this.rightPanel = splitContainer.createDiv({ cls: 'table-builder-right-panel' });

		this.buildLeftPanel();
		this.buildRightPanel();
		
		// Apply styles
		this.applyStyles();
	}

	async onClose(): Promise<void> {
		if (this.hasUnsavedChanges) {
			// Show warning - in practice, Obsidian will handle this
			// We can't actually block close, but we can warn
			console.warn('Closing Table Builder with unsaved changes');
		}
	}

	private getDefaultState(): TableState {
		return {
			tableName: 'New Table',
			columns: [
				{ name: 'd6', type: 'dice', diceNotation: 'd6' },
				{ name: 'Result', type: 'regular' }
			],
			rows: this.generateDefaultRows('d6', 6),
			isPrivate: false
		};
	}

	private generateDefaultRows(diceNotation: string, count: number): RowData[] {
		const rows: RowData[] = [];
		
		// Parse dice notation
		const match = diceNotation.match(/^(\d*)d(\d+)$/i);
		if (!match) return rows;
		
		const sides = parseInt(match[2]);
		
		if (sides <= 20) {
			// Individual rows for d20 or less
			for (let i = 1; i <= Math.min(sides, count); i++) {
				rows.push({ range: `${i}` });
			}
		} else if (sides === 100) {
			// Range groups for d100
			const rangeSize = Math.floor(sides / count);
			for (let i = 0; i < count; i++) {
				const start = i * rangeSize + 1;
				const end = (i === count - 1) ? sides : (i + 1) * rangeSize;
				rows.push({ range: `${start}-${end}` });
			}
		} else {
			// Default to individual for other dice
			for (let i = 1; i <= Math.min(sides, count); i++) {
				rows.push({ range: `${i}` });
			}
		}
		
		return rows;
	}

	private buildLeftPanel(): void {
		// Toolbar
		const toolbar = this.leftPanel.createDiv({ cls: 'table-builder-toolbar' });
		
		// Undo/Redo buttons
		const undoButton = toolbar.createEl('button', { text: 'Undo', cls: 'table-builder-btn' });
		undoButton.addEventListener('click', () => this.undo());
		
		const redoButton = toolbar.createEl('button', { text: 'Redo', cls: 'table-builder-btn' });
		redoButton.addEventListener('click', () => this.redo());
		
		// Bulk operations
		const duplicateBtn = toolbar.createEl('button', { text: 'Duplicate Row', cls: 'table-builder-btn' });
		duplicateBtn.addEventListener('click', () => this.duplicateRow());
		
		const deleteRowBtn = toolbar.createEl('button', { text: 'Delete Row', cls: 'table-builder-btn' });
		deleteRowBtn.addEventListener('click', () => this.deleteRow());
		
		const clearResultsBtn = toolbar.createEl('button', { text: 'Clear Results', cls: 'table-builder-btn' });
		clearResultsBtn.addEventListener('click', () => this.clearResults());
		
		const deleteAllBtn = toolbar.createEl('button', { text: 'Delete All Rows', cls: 'table-builder-btn' });
		deleteAllBtn.addEventListener('click', () => this.deleteAllRows());
		
		// Table name
		const nameSection = this.leftPanel.createDiv({ cls: 'table-builder-section' });
		nameSection.createEl('label', { text: 'Table Name:' });
		this.tableNameInput = nameSection.createEl('input', { type: 'text', value: this.state.tableName });
		this.tableNameInput.addEventListener('input', () => {
			this.captureState();
			this.state.tableName = this.tableNameInput.value;
			this.markUnsaved();
			this.schedulePreviewUpdate();
		});
		
		// Columns section
		const columnsSection = this.leftPanel.createDiv({ cls: 'table-builder-section' });
		columnsSection.createEl('h3', { text: 'Columns' });
		this.buildColumnsEditor(columnsSection);
		
		// Directives section
		const directivesSection = this.leftPanel.createDiv({ cls: 'table-builder-section' });
		directivesSection.createEl('h3', { text: 'Directives' });
		this.buildDirectivesEditor(directivesSection);
		
		// Rows section
		const rowsSection = this.leftPanel.createDiv({ cls: 'table-builder-section' });
		rowsSection.createEl('h3', { text: 'Rows' });
		this.rowGrid = rowsSection.createDiv({ cls: 'table-builder-row-grid' });
		this.buildRowGrid();
		
		// Add row button
		const addRowBtn = rowsSection.createEl('button', { text: '+ Add Row', cls: 'table-builder-btn' });
		addRowBtn.addEventListener('click', () => this.addRow());
		
		// Examples & Templates sidebar
		this.buildExamplesSidebar(this.leftPanel);
	}

	private buildColumnsEditor(container: HTMLElement): void {
		const columnsList = container.createDiv({ cls: 'columns-list' });
		
		this.state.columns.forEach((col, index) => {
			const colItem = columnsList.createDiv({ cls: 'column-item' });
			
			// Drag handle
			const dragHandle = colItem.createDiv({ cls: 'drag-handle', text: '⋮⋮' });
			dragHandle.draggable = true;
			dragHandle.addEventListener('dragstart', (e) => this.onColumnDragStart(e, index));
			dragHandle.addEventListener('dragover', (e) => this.onColumnDragOver(e));
			dragHandle.addEventListener('drop', (e) => this.onColumnDrop(e, index));
			
			// Column name
			const nameInput = colItem.createEl('input', { 
				type: 'text', 
				value: col.name,
				placeholder: 'Column name'
			});
			nameInput.addEventListener('input', () => {
				this.captureState();
				col.name = nameInput.value;
				this.markUnsaved();
				this.buildRowGrid();
				this.schedulePreviewUpdate();
			});
			
			// Column type indicator
			const typeLabel = colItem.createSpan({ text: `(${col.type})`, cls: 'column-type' });
			
			// Delete button
			if (this.state.columns.length > 1) {
				const deleteBtn = colItem.createEl('button', { text: '×', cls: 'delete-btn' });
				deleteBtn.addEventListener('click', () => this.deleteColumn(index));
			}
		});
		
		// Add column buttons
		const addBtns = container.createDiv({ cls: 'add-column-btns' });
		
		const addDiceBtn = addBtns.createEl('button', { text: '+ Dice Column', cls: 'table-builder-btn' });
		addDiceBtn.addEventListener('click', () => this.addDiceColumn());
		
		const addRegularBtn = addBtns.createEl('button', { text: '+ Regular Column', cls: 'table-builder-btn' });
		addRegularBtn.addEventListener('click', () => this.addColumn('regular'));
		
		const addRerollBtn = addBtns.createEl('button', { text: '+ Reroll Column', cls: 'table-builder-btn' });
		addRerollBtn.addEventListener('click', () => this.addColumn('reroll'));
	}

	private buildDirectivesEditor(container: HTMLElement): void {
		// Private checkbox
		const privateDiv = container.createDiv({ cls: 'directive-item' });
		const privateLabel = privateDiv.createEl('label');
		const privateCheckbox = privateLabel.createEl('input', { type: 'checkbox' });
		privateCheckbox.checked = this.state.isPrivate;
		privateLabel.appendText(' Private (hide from table picker)');
		
		privateCheckbox.addEventListener('change', () => {
			this.captureState();
			this.state.isPrivate = privateCheckbox.checked;
			this.markUnsaved();
			this.schedulePreviewUpdate();
		});
		
		// Table-level reroll
		const rerollDiv = container.createDiv({ cls: 'directive-item' });
		rerollDiv.createEl('label', { text: 'Table-level Reroll:' });
		const rerollInput = rerollDiv.createEl('input', { 
			type: 'text',
			placeholder: 'Table1,Table2 or d6 Table1',
			value: this.state.tableReroll || ''
		});
		
		rerollInput.addEventListener('input', () => {
			this.captureState();
			this.state.tableReroll = rerollInput.value || undefined;
			this.markUnsaved();
			this.schedulePreviewUpdate();
		});
		
		rerollInput.addEventListener('blur', () => {
			if (this.state.tableReroll) {
				this.validateRerollReference(this.state.tableReroll);
			}
		});
	}

	private buildRowGrid(): void {
		this.rowGrid.empty();
		
		// Header row
		const headerRow = this.rowGrid.createDiv({ cls: 'row-grid-header' });
		headerRow.createDiv({ text: '', cls: 'row-number' }); // Empty cell for row numbers
		
		this.state.columns.forEach(col => {
			headerRow.createDiv({ text: col.name, cls: 'grid-cell' });
		});
		
		// Data rows
		this.state.rows.forEach((row, rowIndex) => {
			const rowEl = this.rowGrid.createDiv({ cls: 'row-grid-row' });
			if (rowIndex === this.selectedRowIndex) {
				rowEl.addClass('selected');
			}
			
			// Row number
			const rowNum = rowEl.createDiv({ text: `${rowIndex + 1}`, cls: 'row-number' });
			rowNum.addEventListener('click', () => {
				this.selectedRowIndex = rowIndex;
				this.updateRowSelection();
			});
			
			// Cells
			this.state.columns.forEach((col, colIndex) => {
				const cellKey = col.type === 'dice' ? 'range' : col.name;
				const cellValue = row[cellKey] || '';
				
				const cell = rowEl.createDiv({ cls: 'grid-cell' });
				const input = cell.createEl('input', { 
					type: 'text',
					value: cellValue,
					placeholder: col.type === 'dice' ? '1-6' : 'Value'
				});
				
				input.addEventListener('focus', () => {
					// Only update selection, don't rebuild
					if (this.selectedRowIndex !== rowIndex) {
						this.selectedRowIndex = rowIndex;
						// Just update the visual styling without rebuilding
						this.updateRowSelection();
					}
				});
				
				input.addEventListener('input', () => {
					row[cellKey] = input.value;
					this.markUnsaved();
					this.schedulePreviewUpdate();
				});
				
				input.addEventListener('blur', () => {
					// Capture state when user finishes editing
					this.captureState();
				});
				
				// Keyboard navigation
				input.addEventListener('keydown', (e) => {
					this.handleCellKeydown(e, rowIndex, colIndex);
				});
				
				// Validate reroll column on blur
				if (col.type === 'reroll') {
					input.addEventListener('blur', () => {
						if (input.value && input.value !== '—' && input.value !== '-') {
							this.validateRerollReference(input.value);
						}
					});
				}
			});
		});
	}

	private buildExamplesSidebar(container: HTMLElement): void {
		const sidebar = container.createDiv({ cls: 'examples-sidebar' });
		
		const toggle = sidebar.createEl('details');
		toggle.createEl('summary', { text: 'Examples & Templates' });
		
		const content = toggle.createDiv({ cls: 'examples-content' });
		
		// Preset examples
		content.createEl('h4', { text: 'Presets' });
		
		const examples = [
			{ name: 'Individual d6 (6 rows)', dice: 'd6', count: 6 },
			{ name: 'Individual d20 (20 rows)', dice: 'd20', count: 20 },
			{ name: 'Range d100 (10 rows)', dice: 'd100', count: 10 },
			{ name: 'Weighted d100 (20 rows)', dice: 'd100', count: 20 }
		];
		
		examples.forEach(example => {
			const btn = content.createEl('button', { 
				text: example.name,
				cls: 'example-btn'
			});
			btn.addEventListener('click', () => this.applyExample(example.dice, example.count));
		});
		
		// Templates section (placeholder for now)
		content.createEl('h4', { text: 'Custom Templates' });
		content.createEl('p', { text: 'No templates saved yet.', cls: 'placeholder-text' });
		
		const saveTemplateBtn = content.createEl('button', { 
			text: 'Save as Template',
			cls: 'table-builder-btn'
		});
		saveTemplateBtn.addEventListener('click', () => this.saveAsTemplate());
	}

	private buildRightPanel(): void {
		// Tabs
		const tabs = this.rightPanel.createDiv({ cls: 'preview-tabs' });
		
		const markdownTab = tabs.createEl('button', { text: 'Markdown', cls: 'tab-btn active' });
		const htmlTab = tabs.createEl('button', { text: 'Preview', cls: 'tab-btn' });
		
		// Preview containers
		this.previewContainer = this.rightPanel.createDiv({ cls: 'preview-container' });
		
		this.markdownPreview = this.previewContainer.createDiv({ cls: 'markdown-preview active' });
		this.htmlPreview = this.previewContainer.createDiv({ cls: 'html-preview' });
		
		// Tab switching
		markdownTab.addEventListener('click', () => {
			markdownTab.addClass('active');
			htmlTab.removeClass('active');
			this.markdownPreview.addClass('active');
			this.htmlPreview.removeClass('active');
		});
		
		htmlTab.addEventListener('click', () => {
			htmlTab.addClass('active');
			markdownTab.removeClass('active');
			this.htmlPreview.addClass('active');
			this.markdownPreview.removeClass('active');
		});
		
		// Export buttons
		const exportBtns = this.rightPanel.createDiv({ cls: 'export-buttons' });
		
		const copyBtn = exportBtns.createEl('button', { text: 'Copy to Clipboard', cls: 'table-builder-btn' });
		copyBtn.addEventListener('click', () => this.copyToClipboard());
		
		const saveBtn = exportBtns.createEl('button', { text: 'Save', cls: 'table-builder-btn' });
		saveBtn.addEventListener('click', async () => await this.save());
		
		const saveAsBtn = exportBtns.createEl('button', { text: 'Save As...', cls: 'table-builder-btn' });
		saveAsBtn.addEventListener('click', async () => await this.saveAs());
		
		const loadBtn = exportBtns.createEl('button', { text: 'Load Table', cls: 'table-builder-btn' });
		loadBtn.addEventListener('click', () => this.loadTable());
		
		const importBtn = exportBtns.createEl('button', { text: 'Import from Clipboard', cls: 'table-builder-btn' });
		importBtn.addEventListener('click', () => this.importFromClipboard());
		
		// Export format dropdown
		const exportDropdown = exportBtns.createEl('select', { cls: 'export-format' });
		exportDropdown.createEl('option', { text: 'Markdown', value: 'md' });
		exportDropdown.createEl('option', { text: 'CSV', value: 'csv' });
		exportDropdown.createEl('option', { text: 'JSON', value: 'json' });
		
		const exportFileBtn = exportBtns.createEl('button', { text: 'Export As...', cls: 'table-builder-btn' });
		exportFileBtn.addEventListener('click', () => {
			const format = exportDropdown.value;
			this.exportAs(format as 'md' | 'csv' | 'json');
		});
		
		this.updatePreview();
	}

	private schedulePreviewUpdate(): void {
		if (this.previewUpdateTimer) {
			clearTimeout(this.previewUpdateTimer);
		}
		this.previewUpdateTimer = setTimeout(() => {
			this.updatePreview();
		}, 300);
	}

	private updatePreview(): void {
		const markdown = this.generateMarkdown();
		
		// Update markdown preview
		this.markdownPreview.empty();
		const pre = this.markdownPreview.createEl('pre');
		pre.createEl('code', { text: markdown });
		
		// Update HTML preview
		this.htmlPreview.empty();
		this.renderHTMLPreview(this.htmlPreview);
	}

	private generateMarkdown(): string {
		const lines: string[] = [];
		
		// Frontmatter
		lines.push('---');
		lines.push('table-roller: true');
		lines.push('---');
		lines.push('');
		
		// Table heading
		lines.push(`# ${this.state.tableName}`);
		lines.push('');
		
		// Directives
		if (this.state.isPrivate) {
			lines.push('private: true');
		}
		if (this.state.tableReroll) {
			lines.push(`reroll: ${this.state.tableReroll}`);
		}
		if (this.state.isPrivate || this.state.tableReroll) {
			lines.push('');
		}
		
		// Table headers
		const headers = this.state.columns.map(col => col.name);
		lines.push('| ' + headers.join(' | ') + ' |');
		lines.push('|' + headers.map(() => '----').join('|') + '|');
		
		// Table rows
		this.state.rows.forEach(row => {
			const cells = this.state.columns.map(col => {
				const key = col.type === 'dice' ? 'range' : col.name;
				return row[key] || '';
			});
			lines.push('| ' + cells.join(' | ') + ' |');
		});
		
		return lines.join('\n');
	}

	private renderHTMLPreview(container: HTMLElement): void {
		// Title
		container.createEl('h2', { text: this.state.tableName });
		
		// Directives info
		if (this.state.isPrivate || this.state.tableReroll) {
			const info = container.createDiv({ cls: 'directives-info' });
			if (this.state.isPrivate) {
				info.createSpan({ text: '🔒 Private', cls: 'badge' });
			}
			if (this.state.tableReroll) {
				info.createSpan({ text: `↻ Rerolls: ${this.state.tableReroll}`, cls: 'badge' });
			}
		}
		
		// Render table
		const table = container.createEl('table', { cls: 'preview-table' });
		
		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		this.state.columns.forEach(col => {
			headerRow.createEl('th', { text: col.name });
		});
		
		// Body
		const tbody = table.createEl('tbody');
		this.state.rows.forEach(row => {
			const tr = tbody.createEl('tr');
			this.state.columns.forEach(col => {
				const key = col.type === 'dice' ? 'range' : col.name;
				tr.createEl('td', { text: row[key] || '' });
			});
		});
	}

	// History management
	private captureState(): void {
		// Remove any states after current index (if we've undone)
		if (this.historyIndex < this.history.length - 1) {
			this.history = this.history.slice(0, this.historyIndex + 1);
		}
		
		// Add new state
		const stateCopy = JSON.parse(JSON.stringify(this.state));
		this.history.push({
			state: stateCopy,
			timestamp: Date.now()
		});
		
		// Limit history size
		if (this.history.length > this.MAX_HISTORY) {
			this.history.shift();
		} else {
			this.historyIndex++;
		}
	}

	private undo(): void {
		if (this.historyIndex > 0) {
			this.historyIndex--;
			this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex].state));
			this.refreshUI();
			this.markUnsaved();
		}
	}

	private redo(): void {
		if (this.historyIndex < this.history.length - 1) {
			this.historyIndex++;
			this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex].state));
			this.refreshUI();
			this.markUnsaved();
		}
	}

	private refreshUI(): void {
		this.tableNameInput.value = this.state.tableName;
		this.buildRowGrid();
		this.updatePreview();
		// Note: Would need to rebuild columns and directives editors too for full refresh
	}

	// Column operations
	private addDiceColumn(): void {
		// Show modal to select dice type
		const modal = new Modal(this.app);
		modal.titleEl.setText('Add Dice Column');
		
		modal.contentEl.createEl('label', { text: 'Select dice type:' });
		const select = modal.contentEl.createEl('select');
		select.style.width = '100%';
		select.style.padding = '8px';
		select.style.marginTop = '8px';
		select.style.marginBottom = '12px';
		
		const diceOptions = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
		diceOptions.forEach(dice => {
			select.createEl('option', { text: dice, value: dice });
		});
		
		const btnContainer = modal.contentEl.createDiv();
		btnContainer.style.display = 'flex';
		btnContainer.style.justifyContent = 'flex-end';
		btnContainer.style.gap = '8px';
		
		const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => modal.close());
		
		const addBtn = btnContainer.createEl('button', { text: 'Add' });
		addBtn.addEventListener('click', () => {
			this.captureState();
			const diceType = select.value;
			this.state.columns.push({ 
				name: diceType, 
				type: 'dice',
				diceNotation: diceType
			});
			this.markUnsaved();
			this.leftPanel.empty();
			this.buildLeftPanel();
			this.schedulePreviewUpdate();
			modal.close();
		});
		
		modal.open();
	}

	private addColumn(type: 'regular' | 'reroll'): void {
		this.captureState();
		const name = type === 'reroll' ? 'reroll' : `Column ${this.state.columns.length}`;
		this.state.columns.push({ name, type });
		this.markUnsaved();
		this.leftPanel.empty();
		this.buildLeftPanel();
		this.schedulePreviewUpdate();
	}

	private deleteColumn(index: number): void {
		if (this.state.columns.length <= 1) {
			new Notice('Cannot delete the last column');
			return;
		}
		
		this.captureState();
		const col = this.state.columns[index];
		this.state.columns.splice(index, 1);
		
		// Remove data from rows
		const key = col.type === 'dice' ? 'range' : col.name;
		this.state.rows.forEach(row => {
			delete row[key];
		});
		
		this.markUnsaved();
		this.leftPanel.empty();
		this.buildLeftPanel();
		this.schedulePreviewUpdate();
	}

	// Row operations
	private addRow(): void {
		this.captureState();
		this.state.rows.push({});
		this.markUnsaved();
		this.buildRowGrid();
		this.schedulePreviewUpdate();
	}

	private duplicateRow(): void {
		if (this.state.rows.length === 0) return;
		
		this.captureState();
		const row = this.state.rows[this.selectedRowIndex];
		const copy = JSON.parse(JSON.stringify(row));
		this.state.rows.splice(this.selectedRowIndex + 1, 0, copy);
		this.selectedRowIndex++;
		this.markUnsaved();
		this.buildRowGrid();
		this.schedulePreviewUpdate();
	}

	private deleteRow(): void {
		if (this.state.rows.length === 0) return;
		
		this.captureState();
		this.state.rows.splice(this.selectedRowIndex, 1);
		if (this.selectedRowIndex >= this.state.rows.length && this.selectedRowIndex > 0) {
			this.selectedRowIndex--;
		}
		this.markUnsaved();
		this.buildRowGrid();
		this.schedulePreviewUpdate();
	}

	private clearResults(): void {
		this.captureState();
		this.state.rows.forEach(row => {
			this.state.columns.forEach(col => {
				if (col.type === 'regular') {
					row[col.name] = '';
				}
			});
		});
		this.markUnsaved();
		this.buildRowGrid();
		this.schedulePreviewUpdate();
	}

	private deleteAllRows(): void {
		// Show confirmation modal
		const modal = new Modal(this.app);
		modal.titleEl.setText('Delete All Rows?');
		modal.contentEl.setText('This will delete all rows. Do you want to proceed?.');
		
		const btnContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });
		const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => modal.close());
		
		const confirmBtn = btnContainer.createEl('button', { text: 'Delete All', cls: 'mod-warning' });
		confirmBtn.addEventListener('click', () => {
			this.captureState();
			this.state.rows = [];
			this.selectedRowIndex = 0;
			this.markUnsaved();
			this.buildRowGrid();
			this.schedulePreviewUpdate();
			modal.close();
		});
		
		modal.open();
	}

	// Keyboard navigation
	private handleCellKeydown(e: KeyboardEvent, rowIndex: number, colIndex: number): void {
		const rows = this.state.rows.length;
		const cols = this.state.columns.length;
		
		let newRow = rowIndex;
		let newCol = colIndex;
		let shouldMove = false;
		
		if (e.key === 'Tab') {
			e.preventDefault();
			if (e.shiftKey) {
				// Move left
				newCol--;
				if (newCol < 0) {
					newCol = cols - 1;
					newRow--;
				}
			} else {
				// Move right
				newCol++;
				if (newCol >= cols) {
					newCol = 0;
					newRow++;
				}
			}
			shouldMove = true;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (e.shiftKey) {
				// Move up
				newRow--;
			} else {
				// Move down
				newRow++;
			}
			shouldMove = true;
		}
		
		if (shouldMove && newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
			this.selectedRowIndex = newRow;
			// Focus the new cell
			setTimeout(() => {
				const rowEls = this.rowGrid.querySelectorAll('.row-grid-row');
				const rowEl = rowEls[newRow] as HTMLElement;
				const inputs = rowEl.querySelectorAll('input');
				const input = inputs[newCol] as HTMLInputElement;
				if (input) {
					input.focus();
					input.select();
				}
			}, 0);
		}
	}

	private updateRowSelection(): void {
		// Update row selection visuals without rebuilding
		const rowEls = this.rowGrid.querySelectorAll('.row-grid-row');
		rowEls.forEach((el, idx) => {
			if (idx === this.selectedRowIndex) {
				el.addClass('selected');
			} else {
				el.removeClass('selected');
			}
		});
	}

	// Drag and drop for columns
	private draggedColumnIndex: number = -1;

	private onColumnDragStart(e: DragEvent, index: number): void {
		this.draggedColumnIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
		}
	}

	private onColumnDragOver(e: DragEvent): void {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
	}

	private onColumnDrop(e: DragEvent, targetIndex: number): void {
		e.preventDefault();
		
		if (this.draggedColumnIndex === targetIndex) return;
		
		this.captureState();
		
		// Reorder columns
		const [moved] = this.state.columns.splice(this.draggedColumnIndex, 1);
		this.state.columns.splice(targetIndex, 0, moved);
		
		this.draggedColumnIndex = -1;
		this.markUnsaved();
		
		this.leftPanel.empty();
		this.buildLeftPanel();
		this.schedulePreviewUpdate();
	}

	// Examples
	private applyExample(diceNotation: string, rowCount: number): void {
		this.captureState();
		
		// Update first column to be dice column
		this.state.columns[0] = {
			name: diceNotation,
			type: 'dice',
			diceNotation: diceNotation
		};
		
		// Generate rows
		this.state.rows = this.generateDefaultRows(diceNotation, rowCount);
		
		this.markUnsaved();
		this.leftPanel.empty();
		this.buildLeftPanel();
		this.schedulePreviewUpdate();
		
		new Notice(`Applied ${diceNotation} with ${rowCount} rows`);
	}

	// Template operations
	private async saveAsTemplate(): Promise<void> {
		const modal = new Modal(this.app);
		modal.titleEl.setText('Save as Template');
		
		const input = modal.contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Template name',
			value: this.state.tableName + ' Template'
		});
		input.style.width = '100%';
		input.style.padding = '8px';
		input.style.marginBottom = '12px';
		
		const btnContainer = modal.contentEl.createDiv();
		btnContainer.style.display = 'flex';
		btnContainer.style.justifyContent = 'flex-end';
		btnContainer.style.gap = '8px';
		
		const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => modal.close());
		
		const saveBtn = btnContainer.createEl('button', { text: 'Save' });
		saveBtn.addEventListener('click', async () => {
			const templateName = input.value.trim();
			if (!templateName) {
				new Notice('Template name cannot be empty');
				return;
			}
			
			await this.saveTemplate(templateName);
			modal.close();
		});
		
		input.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				saveBtn.click();
			}
		});
		
		modal.open();
		input.focus();
	}

	private async saveTemplate(templateName: string): Promise<void> {
		try {
			// Ensure .table-templates folder exists
			const templatesFolder = '.table-templates';
			const folder = this.app.vault.getAbstractFileByPath(templatesFolder);
			if (!folder) {
				await this.app.vault.createFolder(templatesFolder);
			}
			
			// Create template content (structure only, no row data)
			const templateState: TableState = {
				tableName: templateName,
				columns: JSON.parse(JSON.stringify(this.state.columns)),
				rows: this.state.rows.map(() => ({})), // Empty rows with same count
				isPrivate: this.state.isPrivate,
				tableReroll: this.state.tableReroll
			};
			
			const lines: string[] = [];
			lines.push('---');
			lines.push('table-roller-template: true');
			lines.push('---');
			lines.push('');
			lines.push(`# ${templateName}`);
			lines.push('');
			lines.push('```json');
			lines.push(JSON.stringify(templateState, null, 2));
			lines.push('```');
			
			const filename = `${templatesFolder}/${templateName}.md`;
			await this.app.vault.create(filename, lines.join('\n'));
			
			new Notice(`Template saved: ${templateName}`);
		} catch (error) {
			console.error('Error saving template:', error);
			new Notice('Failed to save template');
		}
	}

	// Import/Export
	private async importFromClipboard(): Promise<void> {
		try {
			const text = await navigator.clipboard.readText();
			
			// Parse as markdown table
			const lines = text.split('\n').filter(l => l.trim().includes('|'));
			if (lines.length < 2) {
				new Notice('No valid table found in clipboard');
				return;
			}
			
			// Parse similar to TableParser
			const headerLine = lines[0];
			const headers = headerLine.split('|')
				.map(h => h.trim())
				.filter(h => h.length > 0);
			
			if (headers.length === 0) {
				new Notice('Could not parse table headers');
				return;
			}
			
			// Detect columns
			const columns: ColumnConfig[] = headers.map(h => {
				if (/^\d*d\d+$/i.test(h.trim())) {
					return { name: h, type: 'dice' as const, diceNotation: h.toLowerCase() };
				} else if (/^reroll$/i.test(h.trim())) {
					return { name: h, type: 'reroll' as const };
				} else {
					return { name: h, type: 'regular' as const };
				}
			});
			
			// Parse rows (skip separator line)
			const rows: RowData[] = [];
			for (let i = 2; i < lines.length; i++) {
				const cells = lines[i].split('|')
					.map(c => c.trim())
					.filter((_, idx) => idx > 0 && idx <= headers.length);
				
				if (cells.length > 0) {
					const row: RowData = {};
					headers.forEach((header, idx) => {
						const col = columns[idx];
						const key = col.type === 'dice' ? 'range' : col.name;
						row[key] = cells[idx] || '';
					});
					rows.push(row);
				}
			}
			
			// Update state
			this.captureState();
			this.state.columns = columns;
			this.state.rows = rows;
			this.markUnsaved();
			
			this.leftPanel.empty();
			this.buildLeftPanel();
			this.schedulePreviewUpdate();
			
			new Notice('Table imported from clipboard');
		} catch (error) {
			console.error('Import error:', error);
			new Notice('Failed to import from clipboard');
		}
	}

	private async copyToClipboard(): Promise<void> {
		const markdown = this.generateMarkdown();
		await navigator.clipboard.writeText(markdown);
		new Notice('Copied to clipboard');
	}

	private async save(): Promise<void> {
		if (!await this.validate()) {
			return;
		}
		
		// If we have a current file, save directly to it
		if (this.currentFile) {
			await this.saveToCurrentFile();
			return;
		}
		
		// Otherwise, show save options
		await this.saveAs();
	}
	
	private async saveAs(): Promise<void> {
		// Validate first
		if (!await this.validate()) {
			return;
		}
		
		// Show save options modal
		const modal = new Modal(this.app);
		modal.titleEl.setText('Save Table As');
		
		const createNewBtn = modal.contentEl.createEl('button', { 
			text: 'Create New File',
			cls: 'table-builder-btn'
		});
		createNewBtn.style.width = '100%';
		createNewBtn.style.marginBottom = '8px';
		createNewBtn.addEventListener('click', () => {
			modal.close();
			this.saveToNewFile();
		});
		
		const appendBtn = modal.contentEl.createEl('button', { 
			text: 'Append to Existing File',
			cls: 'table-builder-btn'
		});
		appendBtn.style.width = '100%';
		appendBtn.addEventListener('click', () => {
			modal.close();
			this.appendToFile();
		});
		
		modal.open();
	}

	private async saveToNewFile(): Promise<void> {
		const modal = new Modal(this.app);
		modal.titleEl.setText('Save to New File');
		
		const input = modal.contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Filename (without .md)',
			value: this.state.tableName
		});
		input.style.width = '100%';
		input.style.padding = '8px';
		input.style.marginBottom = '12px';
		
		const btnContainer = modal.contentEl.createDiv();
		btnContainer.style.display = 'flex';
		btnContainer.style.justifyContent = 'flex-end';
		btnContainer.style.gap = '8px';
		
		const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => modal.close());
		
		const saveBtn = btnContainer.createEl('button', { text: 'Save' });
		saveBtn.addEventListener('click', async () => {
			const filename = input.value.trim();
			if (!filename) {
				new Notice('Filename cannot be empty');
				return;
			}
			
			const fullFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
			const markdown = this.generateMarkdown();
			
			try {
				const file = await this.app.vault.create(fullFilename, markdown);
				new Notice(`Saved to ${fullFilename}`);
				this.currentFile = file; // Remember this file
				this.hasUnsavedChanges = false;
				await this.roller.loadTables(); // Reload tables to include new one
				modal.close();
			} catch (error) {
				console.error('Error saving file:', error);
				new Notice('Failed to save file');
			}
		});
		
		input.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				saveBtn.click();
			}
		});
		
		modal.open();
		input.focus();
	}

	private async appendToFile(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles()
			.filter(f => !f.path.startsWith('.table-templates/'));
		
		if (files.length === 0) {
			new Notice('No markdown files found');
			return;
		}
		
		// Simple file picker modal
		const modal = new Modal(this.app);
		modal.titleEl.setText('Select File to Append To');
		
		const fileList = modal.contentEl.createDiv({ cls: 'file-list' });
		fileList.style.maxHeight = '400px';
		fileList.style.overflowY = 'auto';
		
		files.forEach(file => {
			const fileBtn = fileList.createEl('button', { 
				text: file.path,
				cls: 'file-option'
			});
			fileBtn.style.display = 'block';
			fileBtn.style.width = '100%';
			fileBtn.style.textAlign = 'left';
			fileBtn.style.padding = '8px';
			fileBtn.style.marginBottom = '4px';
			fileBtn.style.border = '1px solid var(--background-modifier-border)';
			fileBtn.style.background = 'var(--background-secondary)';
			fileBtn.style.cursor = 'pointer';
			
			fileBtn.addEventListener('click', async () => {
				modal.close();
				await this.appendToSpecificFile(file);
			});
			
			fileBtn.addEventListener('mouseenter', () => {
				fileBtn.style.background = 'var(--background-modifier-hover)';
			});
			fileBtn.addEventListener('mouseleave', () => {
				fileBtn.style.background = 'var(--background-secondary)';
			});
		});
		
		modal.open();
	}

	private async appendToSpecificFile(file: TFile): Promise<void> {
		try {
			const currentContent = await this.app.vault.read(file);
			const markdown = this.generateMarkdown();
			
			// Extract just the table part (without frontmatter)
			const lines = markdown.split('\n');
			const tableStartIndex = lines.findIndex(l => l.startsWith('#'));
			const tableContent = lines.slice(tableStartIndex).join('\n');
			
			// Append to file
			const newContent = currentContent + '\n\n' + tableContent;
			await this.app.vault.modify(file, newContent);
			
			new Notice(`Appended to ${file.path}`);
			this.currentFile = file; // Remember this file
			this.hasUnsavedChanges = false;
			await this.roller.loadTables(); // Reload tables
		} catch (error) {
			console.error('Error appending to file:', error);
			new Notice('Failed to append to file');
		}
	}

	private async loadTable(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles()
			.filter(f => !f.path.startsWith('.table-templates/'));
		
		if (files.length === 0) {
			new Notice('No markdown files found');
			return;
		}
		
		// Simple file picker modal
		const modal = new Modal(this.app);
		modal.titleEl.setText('Load Table from File');
		
		const fileList = modal.contentEl.createDiv({ cls: 'file-list' });
		fileList.style.maxHeight = '400px';
		fileList.style.overflowY = 'auto';
		
		files.forEach(file => {
			const fileBtn = fileList.createEl('button', { 
				text: file.path,
				cls: 'file-option'
			});
			fileBtn.style.display = 'block';
			fileBtn.style.width = '100%';
			fileBtn.style.textAlign = 'left';
			fileBtn.style.padding = '8px';
			fileBtn.style.marginBottom = '4px';
			fileBtn.style.border = '1px solid var(--background-modifier-border)';
			fileBtn.style.background = 'var(--background-secondary)';
			fileBtn.style.cursor = 'pointer';
			
			fileBtn.addEventListener('click', async () => {
				modal.close();
				await this.loadFromFile(file);
			});
			
			fileBtn.addEventListener('mouseenter', () => {
				fileBtn.style.background = 'var(--background-modifier-hover)';
			});
			fileBtn.addEventListener('mouseleave', () => {
				fileBtn.style.background = 'var(--background-secondary)';
			});
		});
		
		modal.open();
	}

	private async loadFromFile(file: TFile): Promise<void> {
		try {
			this.currentFile = file; // Remember which file we're loading from
			const content = await this.app.vault.read(file);
			const parsed = TableParser.parseTables(content, file.basename);
			
			const tableNames = Object.keys(parsed.tables);
			
			if (tableNames.length === 0) {
				new Notice('No tables found in file');
				return;
			}
			
			if (tableNames.length === 1) {
				// Load the only table
				await this.loadParsedTable(tableNames[0], parsed.tables[tableNames[0]], parsed);
			} else {
				// Show table picker
				this.showTablePicker(tableNames, parsed);
			}
		} catch (error) {
			console.error('Error loading table:', error);
			new Notice('Failed to load table');
		}
	}

	private showTablePicker(tableNames: string[], parsed: any): void {
		const modal = new Modal(this.app);
		modal.titleEl.setText('Select Table');
		
		const tableList = modal.contentEl.createDiv({ cls: 'table-list' });
		
		tableNames.forEach(name => {
			const btn = tableList.createEl('button', { 
				text: name,
				cls: 'table-option'
			});
			btn.style.display = 'block';
			btn.style.width = '100%';
			btn.style.textAlign = 'left';
			btn.style.padding = '8px';
			btn.style.marginBottom = '4px';
			btn.style.border = '1px solid var(--background-modifier-border)';
			btn.style.background = 'var(--background-secondary)';
			btn.style.cursor = 'pointer';
			
			btn.addEventListener('click', async () => {
				modal.close();
				await this.loadParsedTable(name, parsed.tables[name], parsed);
			});
			
			btn.addEventListener('mouseenter', () => {
				btn.style.background = 'var(--background-modifier-hover)';
			});
			btn.addEventListener('mouseleave', () => {
				btn.style.background = 'var(--background-secondary)';
			});
		});
		
		modal.open();
	}

	private async loadParsedTable(tableName: string, table: any, parsed: any): Promise<void> {
		// Convert parsed table back to state
		const columns: ColumnConfig[] = [];
		const rows: RowData[] = [];
		
		if ('dice' in table) {
			// Dice table
			columns.push({
				name: table.dice,
				type: 'dice',
				diceNotation: table.dice
			});
			
			// Get other columns from first entry
			if (table.entries.length > 0) {
				const firstEntry = table.entries[0];
				if (firstEntry.columns) {
					for (const colName of Object.keys(firstEntry.columns)) {
						if (colName.toLowerCase() === 'reroll') {
							columns.push({ name: colName, type: 'reroll' });
						} else {
							columns.push({ name: colName, type: 'regular' });
						}
					}
				}
			}
			
			// Convert entries to rows
			for (const entry of table.entries) {
				const row: RowData = {
					range: entry.min === entry.max ? `${entry.min}` : `${entry.min}-${entry.max}`
				};
				
				if (entry.columns) {
					for (const [key, value] of Object.entries(entry.columns)) {
						row[key] = value as string;
					}
				}
				
				if (entry.reroll) {
					row.reroll = entry.reroll;
				}
				
				rows.push(row);
			}
		} else {
			// Simple table
			for (const header of table.headers) {
				if (header.toLowerCase() === 'reroll') {
					columns.push({ name: header, type: 'reroll' });
				} else {
					columns.push({ name: header, type: 'regular' });
				}
			}
			
			for (const row of table.rows) {
				rows.push({ ...row });
			}
		}
		
		// Update state
		this.state = {
			tableName: tableName,
			columns: columns,
			rows: rows,
			isPrivate: table.private || false,
			tableReroll: table.reroll
		};
		
		// Clear history
		this.history = [];
		this.historyIndex = -1;
		this.hasUnsavedChanges = false;
		
		// Rebuild UI
		this.leftPanel.empty();
		this.buildLeftPanel();
		this.updatePreview();
		
		new Notice(`Loaded table: ${tableName}`);
	}
	
	private async saveToCurrentFile(): Promise<void> {
		if (!this.currentFile) return;
		
		try {
			const currentContent = await this.app.vault.read(this.currentFile);
			const markdown = this.generateMarkdown();
			
			// Try to find and replace the existing table in the file
			const tableName = this.state.tableName;
			const tableHeading = `# ${tableName}`;
			
			// Find the table section
			const lines = currentContent.split('\n');
			let tableStartIndex = -1;
			let tableEndIndex = -1;
			
			// Find the heading for this table
			for (let i = 0; i < lines.length; i++) {
				if (lines[i].trim() === tableHeading) {
					tableStartIndex = i;
					break;
				}
			}
			
			if (tableStartIndex !== -1) {
				// Find the end of this table (next heading or end of file)
				for (let i = tableStartIndex + 1; i < lines.length; i++) {
					if (lines[i].startsWith('# ')) {
						tableEndIndex = i - 1;
						break;
					}
				}
				if (tableEndIndex === -1) {
					tableEndIndex = lines.length - 1;
				}
				
				// Extract just the table content (without frontmatter)
				const markdownLines = markdown.split('\n');
				const tableContentStart = markdownLines.findIndex(l => l.startsWith('#'));
				const newTableContent = markdownLines.slice(tableContentStart).join('\n');
				
				// Replace the old table with the new one
				const before = lines.slice(0, tableStartIndex);
				const after = lines.slice(tableEndIndex + 1);
				
				// Clean up empty lines
				while (before.length > 0 && before[before.length - 1].trim() === '') {
					before.pop();
				}
				while (after.length > 0 && after[0].trim() === '') {
					after.shift();
				}
				
				const newContent = [...before, '', newTableContent, '', ...after].join('\n');
				await this.app.vault.modify(this.currentFile, newContent);
				
				new Notice(`Saved to ${this.currentFile.path}`);
			} else {
				// Table not found, append to end
				const markdownLines = markdown.split('\n');
				const tableContentStart = markdownLines.findIndex(l => l.startsWith('#'));
				const newTableContent = markdownLines.slice(tableContentStart).join('\n');
				
				const newContent = currentContent + '\n\n' + newTableContent;
				await this.app.vault.modify(this.currentFile, newContent);
				
				new Notice(`Table added to ${this.currentFile.path}`);
			}
			
			this.hasUnsavedChanges = false;
			await this.roller.loadTables();
		} catch (error) {
			console.error('Error saving to current file:', error);
			new Notice('Failed to save to file');
		}
	}

	private async exportAs(format: 'md' | 'csv' | 'json'): Promise<void> {
		let content = '';
		let extension = '';
		
		if (format === 'md') {
			content = this.generateMarkdown();
			extension = 'md';
		} else if (format === 'csv') {
			content = this.generateCSV();
			extension = 'csv';
		} else if (format === 'json') {
			content = this.generateJSON();
			extension = 'json';
		}
		
		// Copy to clipboard for now
		await navigator.clipboard.writeText(content);
		new Notice(`${format.toUpperCase()} copied to clipboard`);
	}

	private generateCSV(): string {
		const headers = this.state.columns.map(col => col.name);
		const lines = [headers.join(',')];
		
		this.state.rows.forEach(row => {
			const cells = this.state.columns.map(col => {
				const key = col.type === 'dice' ? 'range' : col.name;
				const value = row[key] || '';
				// Escape commas and quotes
				return value.includes(',') || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value;
			});
			lines.push(cells.join(','));
		});
		
		return lines.join('\n');
	}

	private generateJSON(): string {
		return JSON.stringify({
			tableName: this.state.tableName,
			isPrivate: this.state.isPrivate,
			tableReroll: this.state.tableReroll,
			columns: this.state.columns,
			rows: this.state.rows
		}, null, 2);
	}

	// Validation
	private async validate(): Promise<boolean> {
		const errors: string[] = [];
		
		// Validate table name
		if (!this.state.tableName.trim()) {
			errors.push('Table name cannot be empty');
		}
		
		// Validate reroll references
		if (this.state.tableReroll) {
			const valid = await this.validateRerollReference(this.state.tableReroll, true);
			if (!valid) {
				errors.push(`Invalid table-level reroll reference: ${this.state.tableReroll}`);
			}
		}
		
		// Validate row rerolls
		const rerollCol = this.state.columns.find(c => c.type === 'reroll');
		if (rerollCol) {
			for (const row of this.state.rows) {
				const rerollValue = row[rerollCol.name];
				if (rerollValue && rerollValue !== '—' && rerollValue !== '-') {
					const valid = await this.validateRerollReference(rerollValue, true);
					if (!valid) {
						errors.push(`Invalid reroll reference: ${rerollValue}`);
					}
				}
			}
		}
		
		// Validate dice ranges
		const diceCol = this.state.columns.find(c => c.type === 'dice');
		if (diceCol) {
			for (const row of this.state.rows) {
				const range = row.range;
				if (range) {
					const parsed = TableParser['parseRange'](range);
					if (parsed.min === 0 && parsed.max === 0) {
						errors.push(`Invalid range format: ${range}`);
					}
				}
			}
		}
		
		if (errors.length > 0) {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Validation Errors');
			modal.contentEl.createEl('p', { text: 'Please fix the following errors:' });
			const list = modal.contentEl.createEl('ul');
			errors.forEach(error => {
				list.createEl('li', { text: error });
			});
			
			const closeBtn = modal.contentEl.createEl('button', { text: 'OK' });
			closeBtn.addEventListener('click', () => modal.close());
			
			modal.open();
			return false;
		}
		
		return true;
	}

	private async validateRerollReference(reference: string, silent: boolean = false): Promise<boolean> {
		const tableNames = reference.split(',').map(t => t.trim()).filter(t => t);
		
		for (const name of tableNames) {
			// Handle multi-roll syntax
			const multiRollMatch = name.match(/^(\d*d\d+)\s+(.+)$/i);
			const actualTableName = multiRollMatch ? multiRollMatch[2].trim() : name;
			
			try {
				const tableFile = this.roller.getTableFile(actualTableName);
				if (!tableFile) {
					if (!silent) {
						new Notice(`Table not found: ${actualTableName}`);
					}
					return false;
				}
			} catch (error) {
				if (!silent) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					new Notice(errorMsg);
				}
				return false;
			}
		}
		
		return true;
	}

	// Utility
	private markUnsaved(): void {
		this.hasUnsavedChanges = true;
	}

	private applyStyles(): void {
		const styleEl = document.createElement('style');
		styleEl.textContent = `
			.table-builder-view {
				height: 100%;
				overflow: hidden;
			}
			
			.table-builder-split {
				display: flex;
				height: 100%;
				gap: 16px;
				padding: 16px;
			}
			
			.table-builder-left-panel {
				flex: 1;
				overflow-y: auto;
				padding-right: 8px;
			}
			
			.table-builder-right-panel {
				flex: 1;
				display: flex;
				flex-direction: column;
				overflow: hidden;
			}
			
			.table-builder-toolbar {
				display: flex;
				gap: 8px;
				margin-bottom: 16px;
				flex-wrap: wrap;
			}
			
			.table-builder-btn {
				padding: 6px 12px;
				border-radius: 4px;
				border: 1px solid var(--background-modifier-border);
				background: var(--interactive-normal);
				cursor: pointer;
				font-size: 13px;
			}
			
			.table-builder-btn:hover {
				background: var(--interactive-hover);
			}
			
			.table-builder-section {
				margin-bottom: 24px;
			}
			
			.table-builder-section h3 {
				margin: 0 0 12px 0;
				font-size: 14px;
				font-weight: 600;
			}
			
			.table-builder-section label {
				display: block;
				margin-bottom: 6px;
				font-size: 13px;
			}
			
			.table-builder-section input[type="text"] {
				width: 100%;
				padding: 6px 8px;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				background: var(--background-primary);
			}
			
			.columns-list {
				display: flex;
				flex-direction: column;
				gap: 8px;
				margin-bottom: 12px;
			}
			
			.column-item {
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 8px;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				background: var(--background-secondary);
			}
			
			.drag-handle {
				cursor: move;
				color: var(--text-muted);
				user-select: none;
			}
			
			.column-item input {
				flex: 1;
				padding: 4px 8px;
				border: 1px solid var(--background-modifier-border);
				border-radius: 3px;
			}
			
			.column-type {
				font-size: 11px;
				color: var(--text-muted);
			}
			
			.delete-btn {
				padding: 2px 8px;
				border: none;
				background: var(--background-modifier-error);
				color: var(--text-on-accent);
				border-radius: 3px;
				cursor: pointer;
				font-size: 16px;
				line-height: 1;
			}
			
			.add-column-btns {
				display: flex;
				gap: 8px;
			}
			
			.directive-item {
				margin-bottom: 12px;
			}
			
			.directive-item label {
				display: flex;
				align-items: center;
				gap: 8px;
			}
			
			.directive-item input[type="checkbox"] {
				margin: 0;
			}
			
			.row-grid-header, .row-grid-row {
				display: grid;
				grid-template-columns: 40px repeat(auto-fit, minmax(100px, 1fr));
				gap: 4px;
				margin-bottom: 4px;
			}
			
			.row-grid-header {
				font-weight: 600;
				border-bottom: 2px solid var(--background-modifier-border);
				padding-bottom: 4px;
			}
			
			.row-number {
				text-align: center;
				padding: 6px;
				color: var(--text-muted);
				cursor: pointer;
			}
			
			.row-grid-row.selected {
				background: var(--background-modifier-hover);
			}
			
			.grid-cell {
				padding: 2px;
			}
			
			.grid-cell input {
				width: 100%;
				padding: 4px 6px;
				border: 1px solid var(--background-modifier-border);
				border-radius: 3px;
				background: var(--background-primary);
			}
			
			.examples-sidebar {
				margin-top: 24px;
				padding-top: 16px;
				border-top: 1px solid var(--background-modifier-border);
			}
			
			.examples-sidebar details {
				cursor: pointer;
			}
			
			.examples-content {
				padding: 12px 0;
			}
			
			.examples-content h4 {
				margin: 8px 0;
				font-size: 13px;
			}
			
			.example-btn {
				display: block;
				width: 100%;
				text-align: left;
				padding: 6px 12px;
				margin-bottom: 4px;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				background: var(--background-secondary);
				cursor: pointer;
				font-size: 12px;
			}
			
			.example-btn:hover {
				background: var(--background-modifier-hover);
			}
			
			.placeholder-text {
				font-size: 12px;
				color: var(--text-muted);
				font-style: italic;
			}
			
			.preview-tabs {
				display: flex;
				gap: 4px;
				margin-bottom: 12px;
				border-bottom: 1px solid var(--background-modifier-border);
			}
			
			.tab-btn {
				padding: 8px 16px;
				border: none;
				background: transparent;
				cursor: pointer;
				border-bottom: 2px solid transparent;
			}
			
			.tab-btn.active {
				border-bottom-color: var(--interactive-accent);
			}
			
			.preview-container {
				flex: 1;
				overflow-y: auto;
				position: relative;
			}
			
			.markdown-preview, .html-preview {
				display: none;
				padding: 12px;
			}
			
			.markdown-preview.active, .html-preview.active {
				display: block;
			}
			
			.markdown-preview pre {
				background: var(--background-secondary);
				padding: 12px;
				border-radius: 4px;
				overflow-x: auto;
			}
			
			.markdown-preview code {
				font-family: var(--font-monospace);
				font-size: 12px;
				white-space: pre;
			}
			
			.preview-table {
				width: 100%;
				border-collapse: collapse;
			}
			
			.preview-table th, .preview-table td {
				border: 1px solid var(--background-modifier-border);
				padding: 8px;
				text-align: left;
			}
			
			.preview-table th {
				background: var(--background-secondary);
				font-weight: 600;
			}
			
			.directives-info {
				margin-bottom: 12px;
				display: flex;
				gap: 8px;
			}
			
			.badge {
				padding: 4px 8px;
				border-radius: 4px;
				background: var(--background-secondary);
				font-size: 11px;
			}
			
			.export-buttons {
				display: flex;
				gap: 8px;
				flex-wrap: wrap;
				padding: 12px;
				border-top: 1px solid var(--background-modifier-border);
			}
			
			.export-format {
				padding: 6px 12px;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				background: var(--background-primary);
			}
		`;
		document.head.appendChild(styleEl);
	}
}
