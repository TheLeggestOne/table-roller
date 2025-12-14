// import { App, ItemView, WorkspaceLeaf, TFile, Modal, Notice } from 'obsidian';
// import { TableRollerCore } from '../services/TableRollerCore';
// import { TableParser } from '../services/TableParser';

// export const VIEW_TYPE_TABLE_BUILDER = 'table-builder';

// interface ColumnConfig {
// 	id: string; // Stable identifier that never changes
// 	name: string;
// 	type: 'dice' | 'regular' | 'reroll';
// 	diceNotation?: string; // e.g., 'd6', '2d6', 'd100'
// }

// interface RowData {
// 	range?: string; // For dice columns (dice column always uses 'range')
// 	[columnId: string]: string | undefined; // Data keyed by stable column ID
// }

// interface TableState {
// 	tableName: string;
// 	columns: ColumnConfig[];
// 	rows: RowData[];
// 	isPrivate: boolean;
// 	tableReroll?: string;
// }

// interface HistoryEntry {
// 	state: TableState;
// 	timestamp: number;
// }

// export class TableBuilderView extends ItemView {
// 	private roller: TableRollerCore;
// 	private state: TableState;
// 	private hasUnsavedChanges: boolean = false;
// 	private selectedRowIndex: number = 0;
// 	private currentFile: TFile | null = null; // Track the file we loaded from
// 	private activeContextMenu: HTMLElement | null = null; // Track active context menu
// 	private activeMenuCloseListener: ((event: MouseEvent) => void) | null = null; // Track menu close listener
	
// 	// UI elements
// 	private leftPanel: HTMLElement;
// 	private rightPanel: HTMLElement;
// 	private tableNameInput: HTMLInputElement;
// 	private rowGrid: HTMLElement;
// 	private previewContainer: HTMLElement;
// 	private markdownPreview: HTMLElement;
// 	private htmlPreview: HTMLElement;
	
// 	// History for undo/redo
// 	private history: HistoryEntry[] = [];
// 	private historyIndex: number = -1;
// 	private readonly MAX_HISTORY = 50;
	
// 	// Debounce timer for preview updates
// 	private previewUpdateTimer: NodeJS.Timeout | null = null;

// 	constructor(leaf: WorkspaceLeaf, roller: TableRollerCore) {
// 		super(leaf);
// 		this.roller = roller;
// 		this.state = this.getDefaultState();
// 	}

// 	getViewType(): string {
// 		return VIEW_TYPE_TABLE_BUILDER;
// 	}

// 	getDisplayText(): string {
// 		const asterisk = this.hasUnsavedChanges ? '*' : '';
// 		return `Table Builder${asterisk}`;
// 	}

// 	getIcon(): string {
// 		return 'table';
// 	}

// 	async onOpen(): Promise<void> {
// 		const container = this.containerEl.children[1];
// 		container.empty();
// 		container.addClass('table-builder-view');

// 		// Create split layout
// 		const splitContainer = container.createDiv({ cls: 'table-builder-split' });
		
// 		this.leftPanel = splitContainer.createDiv({ cls: 'table-builder-left-panel' });
// 		this.rightPanel = splitContainer.createDiv({ cls: 'table-builder-right-panel' });

// 		this.buildLeftPanel();
// 		this.buildRightPanel();
		
// 		// Apply styles
// 		this.applyStyles();
// 	}

// 	async onClose(): Promise<void> {
// 		// Clean up active context menu and event listeners
// 		if (this.activeContextMenu && this.activeContextMenu.parentNode) {
// 			try {
// 				this.activeContextMenu.parentNode.removeChild(this.activeContextMenu);
// 			} catch (e) {
// 				// Ignore if already removed
// 			}
// 		}
		
// 		if (this.activeMenuCloseListener) {
// 			document.removeEventListener('click', this.activeMenuCloseListener);
// 			this.activeMenuCloseListener = null;
// 		}
		
// 		if (this.hasUnsavedChanges) {
// 			// Show warning - in practice, Obsidian will handle this
// 			// We can't actually block close, but we can warn
// 			console.warn('Closing Table Builder with unsaved changes');
// 		}
// 	}

// 	private getDefaultState(): TableState {
// 		return {
// 			tableName: 'New Table',
// 			columns: [
// 				{ id: 'col_dice', name: 'd6', type: 'dice', diceNotation: 'd6' },
// 				{ id: 'col_0', name: 'Result', type: 'regular' }
// 			],
// 			rows: this.generateDefaultRows('d6', 6),
// 			isPrivate: false
// 		};
// 	}
	
// 	private generateColumnId(): string {
// 		return `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
// 	}

// 	private generateDefaultRows(diceNotation: string, count: number, groupSize?: number, remainder?: 'expand-first' | 'expand-last' | 'row-first' | 'row-last'): RowData[] {
// 		const rows: RowData[] = [];
		
// 		// Parse dice notation
// 		const match = diceNotation.match(/^(\d*)d(\d+)$/i);
// 		if (!match) return rows;
		
// 		const numDice = match[1] ? parseInt(match[1]) : 1;
// 		const sides = parseInt(match[2]);
		
// 		// Calculate min and max for the dice notation
// 		const minValue = numDice; // minimum is n (e.g., 2d4 = 2)
// 		const maxValue = numDice * sides; // maximum is n * sides (e.g., 2d4 = 8)
		
// 		const totalRange = maxValue - minValue + 1;
		
// 		// If groupSize is specified, create ranges with that many values per row
// 		if (groupSize && groupSize >= 2) {
// 			const extraValues = totalRange % groupSize; // remainder
// 			let currentValue = minValue;
			
// 			// Default remainder handling if not specified
// 			const remainderStrategy = remainder || 'expand-last';
			
// 			// Handle 'row-first' - create a small row at the beginning
// 			if (remainderStrategy === 'row-first' && extraValues > 0) {
// 				const end = minValue + extraValues - 1;
// 				if (minValue === end) {
// 					rows.push({ range: `${minValue}` });
// 				} else {
// 					rows.push({ range: `${minValue}-${end}` });
// 				}
// 				currentValue = end + 1;
// 			}
			
// 			// Create the main grouped rows
// 			const mainRowCount = Math.floor(totalRange / groupSize);
// 			for (let i = 0; i < mainRowCount; i++) {
// 				let rangeSize = groupSize;
				
// 				// Handle 'expand-first' or 'expand-last'
// 				if (extraValues > 0) {
// 					if (remainderStrategy === 'expand-first' && i === 0) {
// 						rangeSize = groupSize + extraValues;
// 					} else if (remainderStrategy === 'expand-last' && i === mainRowCount - 1) {
// 						rangeSize = groupSize + extraValues;
// 					}
// 				}
				
// 				const start = currentValue;
// 				const end = Math.min(currentValue + rangeSize - 1, maxValue);
				
// 				if (start === end) {
// 					rows.push({ range: `${start}` });
// 				} else {
// 					rows.push({ range: `${start}-${end}` });
// 				}
				
// 				currentValue = end + 1;
// 			}
			
// 			// Handle 'row-last' - create a small row at the end
// 			if (remainderStrategy === 'row-last' && extraValues > 0 && currentValue <= maxValue) {
// 				if (currentValue === maxValue) {
// 					rows.push({ range: `${maxValue}` });
// 				} else {
// 					rows.push({ range: `${currentValue}-${maxValue}` });
// 				}
// 			}
// 		}
// 		// Otherwise, calculate appropriate groupSize based on count
// 		else if (count < totalRange) {
// 			// Need to distribute totalRange values across count rows
// 			const calculatedGroupSize = Math.floor(totalRange / count);
// 			const extraValues = totalRange % count;
// 			let currentValue = minValue;
			
// 			for (let i = 0; i < count; i++) {
// 				let rangeSize = calculatedGroupSize;
				
// 				// Distribute extra values across rows (expand last row for simplicity)
// 				if (i === count - 1 && extraValues > 0) {
// 					rangeSize = calculatedGroupSize + extraValues;
// 				}
				
// 				const start = currentValue;
// 				const end = Math.min(currentValue + rangeSize - 1, maxValue);
				
// 				if (start === end) {
// 					rows.push({ range: `${start}` });
// 				} else {
// 					rows.push({ range: `${start}-${end}` });
// 				}
				
// 				currentValue = end + 1;
// 			}
// 		} else {
// 			// count >= totalRange, so create individual rows
// 			for (let i = minValue; i <= Math.min(maxValue, minValue + count - 1); i++) {
// 				rows.push({ range: `${i}` });
// 			}
// 		}
		
// 		return rows;
// 	}

// 	private buildLeftPanel(): void {
// 		// Toolbar
// 		const toolbar = this.leftPanel.createDiv({ cls: 'table-builder-toolbar' });
		
// 		// Undo/Redo buttons
// 		const undoButton = toolbar.createEl('button', { text: 'Undo', cls: 'table-builder-btn' });
// 		undoButton.addEventListener('click', () => this.undo());
		
// 		const redoButton = toolbar.createEl('button', { text: 'Redo', cls: 'table-builder-btn' });
// 		redoButton.addEventListener('click', () => this.redo());
		
// 		// Bulk operations
// 		const clearResultsBtn = toolbar.createEl('button', { text: 'Clear Results', cls: 'table-builder-btn' });
// 		clearResultsBtn.addEventListener('click', () => this.clearResults());
		
// 		const deleteAllBtn = toolbar.createEl('button', { text: 'Delete All Rows', cls: 'table-builder-btn' });
// 		deleteAllBtn.addEventListener('click', () => this.deleteAllRows());
		
// 		// Table name
// 		const nameSection = this.leftPanel.createDiv({ cls: 'table-builder-section' });
// 		nameSection.createEl('label', { text: 'Table Name:' });
// 		this.tableNameInput = nameSection.createEl('input', { type: 'text', value: this.state.tableName });
// 		this.tableNameInput.addEventListener('input', () => {
// 			this.captureState();
// 			this.state.tableName = this.tableNameInput.value;
// 			this.markUnsaved();
// 			this.schedulePreviewUpdate();
// 		});
		
// 		// Columns section
// 		const columnsSection = this.leftPanel.createDiv({ cls: 'table-builder-section' });
// 		columnsSection.createEl('h3', { text: 'Columns' });
// 		this.buildColumnsEditor(columnsSection);
		
// 		// Directives section
// 		const directivesSection = this.leftPanel.createDiv({ cls: 'table-builder-section' });
// 		directivesSection.createEl('h3', { text: 'Directives' });
// 		this.buildDirectivesEditor(directivesSection);
		
// 		// Rows section
// 		const rowsSection = this.leftPanel.createDiv({ cls: 'table-builder-section' });
// 		rowsSection.createEl('h3', { text: 'Rows' });
// 		this.rowGrid = rowsSection.createDiv({ cls: 'table-builder-row-grid' });
// 		this.buildRowGrid();
		
// 		// Add row button
// 		const addRowBtn = rowsSection.createEl('button', { text: '+ Add Row', cls: 'table-builder-btn' });
// 		addRowBtn.addEventListener('click', () => this.addRow());
		
// 		// Examples & Templates sidebar
// 		this.buildExamplesSidebar(this.leftPanel);
// 	}

// 	private buildColumnsEditor(container: HTMLElement): void {
// 		const columnsList = container.createDiv({ cls: 'columns-list' });
		
// 		this.state.columns.forEach((col, index) => {
// 			const colItem = columnsList.createDiv({ cls: 'column-item' });
			
// 			// Drag handle
// 			const dragHandle = colItem.createDiv({ cls: 'drag-handle', text: '⋮⋮' });
// 			dragHandle.draggable = true;
// 			dragHandle.addEventListener('dragstart', (e) => this.onColumnDragStart(e, index));
// 			dragHandle.addEventListener('dragover', (e) => this.onColumnDragOver(e));
// 			dragHandle.addEventListener('drop', (e) => this.onColumnDrop(e, index));
			
// 			// Column name
// 			const nameInput = colItem.createEl('input', { 
// 				type: 'text', 
// 				value: col.name,
// 				placeholder: 'Column name'
// 			});
			
// 			// Disable renaming for reroll columns
// 			if (col.type === 'reroll') {
// 				nameInput.disabled = true;
// 				nameInput.style.opacity = '0.6';
// 				nameInput.style.cursor = 'not-allowed';
// 			}
			
// 		nameInput.addEventListener('input', () => {
// 			this.captureState();
// 			col.name = nameInput.value;
// 			this.markUnsaved();
// 			this.schedulePreviewUpdate();
// 		});
		
// 		// Rebuild row grid when editing is complete (for dice columns to update ranges)
// 		nameInput.addEventListener('blur', () => {
// 			if (col.type === 'dice') {
// 				this.buildRowGrid();
// 			}
// 		});
		
// 		// Column type indicator
// 		const typeLabel = colItem.createSpan({ text: `(${col.type})`, cls: 'column-type' });
		
// 		// Generate button for dice columns
// 		if (col.type === 'dice' && col.diceNotation) {
// 			const generateBtn = colItem.createEl('button', { text: 'Generate Rows...', cls: 'table-builder-btn-small' });
// 			generateBtn.style.marginLeft = '8px';
// 			generateBtn.addEventListener('click', () => this.showGenerateRowsModal(col.diceNotation!));
// 		}
		
// 		// Delete button
// 		if (this.state.columns.length > 1) {
// 			const deleteBtn = colItem.createEl('button', { text: '×', cls: 'delete-btn' });
// 			deleteBtn.addEventListener('click', () => this.deleteColumn(index));
// 		}
// 	});
	
// 		// Add column buttons
// 		const addBtns = container.createDiv({ cls: 'add-column-btns' });
		
// 		// Only show dice column button if there isn't already one
// 		const hasDiceColumn = this.state.columns.some(c => c.type === 'dice');
// 		if (!hasDiceColumn) {
// 			const addDiceBtn = addBtns.createEl('button', { text: '+ Dice Column', cls: 'table-builder-btn' });
// 			addDiceBtn.addEventListener('click', () => this.addDiceColumn());
// 		}
		
// 		const addRegularBtn = addBtns.createEl('button', { text: '+ Regular Column', cls: 'table-builder-btn' });
// 		addRegularBtn.addEventListener('click', () => this.addColumn('regular'));
		
// 		// Only show reroll column button if there isn't already one
// 		const hasRerollColumn = this.state.columns.some(c => c.type === 'reroll');
// 		if (!hasRerollColumn) {
// 			const addRerollBtn = addBtns.createEl('button', { text: '+ Reroll Column', cls: 'table-builder-btn' });
// 			addRerollBtn.addEventListener('click', () => this.addColumn('reroll'));
// 		}
// 	}

// 	private buildDirectivesEditor(container: HTMLElement): void {
// 		// Private checkbox
// 		const privateDiv = container.createDiv({ cls: 'directive-item' });
// 		privateDiv.title = 'When enabled, this table will not appear in the table picker dropdown when rolling from other tables';
// 		const privateLabel = privateDiv.createEl('label');
// 		const privateCheckbox = privateLabel.createEl('input', { type: 'checkbox' });
// 		privateCheckbox.checked = this.state.isPrivate;
// 		privateLabel.appendText(' Private ');
		
// 		privateCheckbox.addEventListener('change', () => {
// 			this.captureState();
// 			this.state.isPrivate = privateCheckbox.checked;
// 			this.markUnsaved();
// 			this.schedulePreviewUpdate();
// 		});
		
// 		// Table-level reroll
// 		const rerollDiv = container.createDiv({ cls: 'directive-item' });
// 		const rerollLabel = rerollDiv.createEl('label', { text: 'Table-level Reroll:' });
// 		rerollLabel.title = 'Automatically roll on additional tables after rolling this one. Use comma-separated list (Table1,Table2) or dice notation (d6 Table1), or both';
// 		const rerollInput = rerollDiv.createEl('input', { 
// 			type: 'text',
// 			placeholder: 'Table1,Table2 or d6 Table1',
// 			value: this.state.tableReroll || ''
// 		});
// 		rerollInput.title = 'Automatically roll on additional tables after rolling this one. Use comma-separated list (Table1,Table2) or dice notation (d6 Table1), or both';
		
// 		rerollInput.addEventListener('input', () => {
// 			this.captureState();
// 			this.state.tableReroll = rerollInput.value || undefined;
// 			this.markUnsaved();
// 			this.schedulePreviewUpdate();
// 		});
		
// 		rerollInput.addEventListener('blur', () => {
// 			if (this.state.tableReroll) {
// 				this.validateRerollReference(this.state.tableReroll);
// 			}
// 		});
// 	}

// 	private buildRowGrid(): void {
// 		this.rowGrid.empty();
		
// 		// Header row
// 		const headerRow = this.rowGrid.createDiv({ cls: 'row-grid-header' });
// 		headerRow.createDiv({ text: '', cls: 'row-number' }); // Empty cell for row numbers
		
// 		this.state.columns.forEach((col, colIndex) => {
// 			const headerCell = headerRow.createDiv({ text: col.name, cls: 'grid-cell' });
			
// 			// Add right-click context menu for paste
// 			headerCell.addEventListener('contextmenu', (e) => {
// 				e.preventDefault();
// 				this.showColumnContextMenu(e, colIndex);
// 			});
			
// 			// Make it clear it's interactive
// 			headerCell.style.cursor = 'context-menu';
// 		});
		
// 		// Data rows
// 		this.state.rows.forEach((row, rowIndex) => {
// 			const rowEl = this.rowGrid.createDiv({ cls: 'row-grid-row' });
// 			if (rowIndex === this.selectedRowIndex) {
// 				rowEl.addClass('selected');
// 			}
			
// 			// Row number
// 			const rowNum = rowEl.createDiv({ text: `${rowIndex + 1}`, cls: 'row-number' });
// 			rowNum.addEventListener('click', () => {
// 				this.selectedRowIndex = rowIndex;
// 				this.updateRowSelection();
// 			});
			
// 			// Cells
// 			this.state.columns.forEach((col, colIndex) => {
// 				const cellKey = col.type === 'dice' ? 'range' : col.id; // Use stable ID
// 				const cellValue = row[cellKey] || '';
				
// 				const cell = rowEl.createDiv({ cls: 'grid-cell' });
// 				const input = cell.createEl('input', { 
// 					type: 'text',
// 					value: cellValue,
// 					placeholder: col.type === 'dice' ? '1-6' : 'Value'
// 				});
				
// 				input.addEventListener('focus', () => {
// 					// Only update selection, don't rebuild
// 					if (this.selectedRowIndex !== rowIndex) {
// 						this.selectedRowIndex = rowIndex;
// 						// Just update the visual styling without rebuilding
// 						this.updateRowSelection();
// 					}
// 				});
				
// 				input.addEventListener('input', () => {
// 					row[cellKey] = input.value;
// 					this.markUnsaved();
// 					this.schedulePreviewUpdate();
// 				});
				
// 				input.addEventListener('blur', () => {
// 					// Capture state when user finishes editing
// 					this.captureState();
// 				});
				
// 				// Keyboard navigation
// 				input.addEventListener('keydown', (e) => {
// 					this.handleCellKeydown(e, rowIndex, colIndex);
// 				});
				
// 				// Validate reroll column on blur
// 				if (col.type === 'reroll') {
// 					input.addEventListener('blur', () => {
// 						if (input.value && input.value !== '—' && input.value !== '-') {
// 							this.validateRerollReference(input.value);
// 						}
// 					});
// 				}
// 			});
			
// 			// Action buttons container
// 			const actionsCell = rowEl.createDiv({ cls: 'row-actions' });
			
// 			// Duplicate button
// 			const duplicateBtn = actionsCell.createEl('button', { 
// 				text: '📋',
// 				cls: 'row-action-btn',
// 				attr: { 'aria-label': 'Duplicate row', 'title': 'Duplicate row' }
// 			});
// 			duplicateBtn.addEventListener('click', (e) => {
// 				e.stopPropagation();
// 				this.duplicateRowAt(rowIndex);
// 			});
			
// 			// Delete button
// 			const deleteBtn = actionsCell.createEl('button', { 
// 				text: '✕',
// 				cls: 'row-action-btn row-delete-btn',
// 				attr: { 'aria-label': 'Delete row', 'title': 'Delete row' }
// 			});
// 			deleteBtn.addEventListener('click', (e) => {
// 				e.stopPropagation();
// 				this.deleteRowAt(rowIndex);
// 			});
// 		});
// 	}

// 	private buildExamplesSidebar(container: HTMLElement): void {
// 		const sidebar = container.createDiv({ cls: 'examples-sidebar' });
		
// 		const toggle = sidebar.createEl('details');
// 		toggle.createEl('summary', { text: 'Examples & Templates' });
		
// 		const content = toggle.createDiv({ cls: 'examples-content' });
		
// 		// Preset examples (for creating new dice columns)
// 		content.createEl('h4', { text: 'Presets' });
		
// 		const examples = [
// 			{ name: 'Individual d6 (6 rows)', dice: 'd6', count: 6 },
// 			{ name: 'Individual d20 (20 rows)', dice: 'd20', count: 20 },
// 			{ name: 'Range d100 (10 rows)', dice: 'd100', count: 10 },
// 			{ name: 'Weighted d100 (20 rows)', dice: 'd100', count: 20 }
// 		];
		
// 		examples.forEach(example => {
// 			const btn = content.createEl('button', { 
// 				text: example.name,
// 				cls: 'example-btn'
// 			});
// 			btn.addEventListener('click', () => this.applyExample(example.dice, example.count));
// 		});
		
// 		// Templates section (placeholder for now)
// 		content.createEl('h4', { text: 'Custom Templates' });
// 		content.createEl('p', { text: 'No templates saved yet.', cls: 'placeholder-text' });
		
// 		const saveTemplateBtn = content.createEl('button', { 
// 			text: 'Save as Template',
// 			cls: 'table-builder-btn'
// 		});
// 		saveTemplateBtn.addEventListener('click', () => this.saveAsTemplate());
// 	}

// 	private buildRightPanel(): void {
// 		// Tabs
// 		const tabs = this.rightPanel.createDiv({ cls: 'preview-tabs' });
		
// 		const markdownTab = tabs.createEl('button', { text: 'Markdown', cls: 'tab-btn active' });
// 		const htmlTab = tabs.createEl('button', { text: 'Preview', cls: 'tab-btn' });
		
// 		// Preview containers
// 		this.previewContainer = this.rightPanel.createDiv({ cls: 'preview-container' });
		
// 		this.markdownPreview = this.previewContainer.createDiv({ cls: 'markdown-preview active' });
// 		this.htmlPreview = this.previewContainer.createDiv({ cls: 'html-preview' });
		
// 		// Tab switching
// 		markdownTab.addEventListener('click', () => {
// 			markdownTab.addClass('active');
// 			htmlTab.removeClass('active');
// 			this.markdownPreview.addClass('active');
// 			this.htmlPreview.removeClass('active');
// 		});
		
// 		htmlTab.addEventListener('click', () => {
// 			htmlTab.addClass('active');
// 			markdownTab.removeClass('active');
// 			this.htmlPreview.addClass('active');
// 			this.markdownPreview.removeClass('active');
// 		});
		
// 		// Export buttons
// 		const exportBtns = this.rightPanel.createDiv({ cls: 'export-buttons' });
		
// 		const copyBtn = exportBtns.createEl('button', { text: 'Copy to Clipboard', cls: 'table-builder-btn' });
// 		copyBtn.addEventListener('click', () => this.copyToClipboard());
		
// 		const saveBtn = exportBtns.createEl('button', { text: 'Save', cls: 'table-builder-btn' });
// 		saveBtn.addEventListener('click', async () => await this.save());
		
// 		const saveAsBtn = exportBtns.createEl('button', { text: 'Save As...', cls: 'table-builder-btn' });
// 		saveAsBtn.addEventListener('click', async () => await this.saveAs());
		
// 		const loadBtn = exportBtns.createEl('button', { text: 'Load Table', cls: 'table-builder-btn' });
// 		loadBtn.addEventListener('click', () => this.loadTable());
		
// 		const importBtn = exportBtns.createEl('button', { text: 'Import from Clipboard', cls: 'table-builder-btn' });
// 		importBtn.addEventListener('click', () => this.importFromClipboard());
		
// 		// Export format dropdown
// 		const exportDropdown = exportBtns.createEl('select', { cls: 'export-format' });
// 		exportDropdown.createEl('option', { text: 'Markdown', value: 'md' });
// 		exportDropdown.createEl('option', { text: 'CSV', value: 'csv' });
// 		exportDropdown.createEl('option', { text: 'JSON', value: 'json' });
		
// 		const exportFileBtn = exportBtns.createEl('button', { text: 'Export As...', cls: 'table-builder-btn' });
// 		exportFileBtn.addEventListener('click', () => {
// 			const format = exportDropdown.value;
// 			this.exportAs(format as 'md' | 'csv' | 'json');
// 		});
		
// 		this.updatePreview();
// 	}

// 	private schedulePreviewUpdate(): void {
// 		if (this.previewUpdateTimer) {
// 			clearTimeout(this.previewUpdateTimer);
// 		}
// 		this.previewUpdateTimer = setTimeout(() => {
// 			this.updatePreview();
// 		}, 300);
// 	}

// 	private updatePreview(): void {
// 		const markdown = this.generateMarkdown();
		
// 		// Update markdown preview
// 		this.markdownPreview.empty();
// 		const pre = this.markdownPreview.createEl('pre');
// 		pre.createEl('code', { text: markdown });
		
// 		// Update HTML preview
// 		this.htmlPreview.empty();
// 		this.renderHTMLPreview(this.htmlPreview);
// 	}

// 	private generateMarkdown(): string {
// 		const lines: string[] = [];
		
// 		// Frontmatter
// 		lines.push('---');
// 		lines.push('table-roller: true');
// 		lines.push('---');
// 		lines.push('');
		
// 		// Table heading
// 		lines.push(`# ${this.state.tableName}`);
// 		lines.push('');
		
// 		// Directives
// 		if (this.state.isPrivate) {
// 			lines.push('private: true');
// 		}
// 		if (this.state.tableReroll) {
// 			lines.push(`reroll: ${this.state.tableReroll}`);
// 		}
// 		if (this.state.isPrivate || this.state.tableReroll) {
// 			lines.push('');
// 		}
		
// 		// Table headers
// 		const headers = this.state.columns.map(col => col.name);
// 		lines.push('| ' + headers.join(' | ') + ' |');
// 		lines.push('|' + headers.map(() => '----').join('|') + '|');
		
// 		// Table rows
// 		this.state.rows.forEach(row => {
// 			const cells = this.state.columns.map(col => {
// 				const key = col.type === 'dice' ? 'range' : col.id; // Use stable ID
// 				return row[key] || '';
// 			});
// 			lines.push('| ' + cells.join(' | ') + ' |');
// 		});
		
// 		return lines.join('\n');
// 	}

// 	private renderHTMLPreview(container: HTMLElement): void {
// 		// Title
// 		container.createEl('h2', { text: this.state.tableName });
		
// 		// Directives info
// 		if (this.state.isPrivate || this.state.tableReroll) {
// 			const info = container.createDiv({ cls: 'directives-info' });
// 			if (this.state.isPrivate) {
// 				info.createSpan({ text: '🔒 Private', cls: 'badge' });
// 			}
// 			if (this.state.tableReroll) {
// 				info.createSpan({ text: `↻ Rerolls: ${this.state.tableReroll}`, cls: 'badge' });
// 			}
// 		}
		
// 		// Render table
// 		const table = container.createEl('table', { cls: 'preview-table' });
		
// 		// Header
// 		const thead = table.createEl('thead');
// 		const headerRow = thead.createEl('tr');
// 		this.state.columns.forEach(col => {
// 			headerRow.createEl('th', { text: col.name });
// 		});
		
// 		// Body
// 		const tbody = table.createEl('tbody');
// 		this.state.rows.forEach(row => {
// 			const tr = tbody.createEl('tr');
// 			this.state.columns.forEach(col => {
// 				const key = col.type === 'dice' ? 'range' : col.id; // Use stable ID
// 				tr.createEl('td', { text: row[key] || '' });
// 			});
// 		});
// 	}

// 	// History management
// 	private captureState(): void {
// 		// Remove any states after current index (if we've undone)
// 		if (this.historyIndex < this.history.length - 1) {
// 			this.history = this.history.slice(0, this.historyIndex + 1);
// 		}
		
// 		// Add new state
// 		const stateCopy = JSON.parse(JSON.stringify(this.state));
// 		this.history.push({
// 			state: stateCopy,
// 			timestamp: Date.now()
// 		});
		
// 		// Limit history size
// 		if (this.history.length > this.MAX_HISTORY) {
// 			this.history.shift();
// 		} else {
// 			this.historyIndex++;
// 		}
// 	}

// 	private undo(): void {
// 		if (this.historyIndex > 0) {
// 			this.historyIndex--;
// 			this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex].state));
// 			this.refreshUI();
// 			this.markUnsaved();
// 		}
// 	}

// 	private redo(): void {
// 		if (this.historyIndex < this.history.length - 1) {
// 			this.historyIndex++;
// 			this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex].state));
// 			this.refreshUI();
// 			this.markUnsaved();
// 		}
// 	}

// 	private refreshUI(): void {
// 		this.tableNameInput.value = this.state.tableName;
// 		this.buildRowGrid();
// 		this.updatePreview();
// 		// Note: Would need to rebuild columns and directives editors too for full refresh
// 	}

// 	// Column operations
// 	private addDiceColumn(): void {
// 		// Check if dice column already exists
// 		if (this.state.columns.some(c => c.type === 'dice')) {
// 			new Notice('Only one dice column is allowed');
// 			return;
// 		}
		
// 		// Show modal to select dice type
// 		const modal = new Modal(this.app);
// 		modal.titleEl.setText('Add Dice Column');
		
// 		modal.contentEl.createEl('label', { text: 'Select dice type:' });
// 		const select = modal.contentEl.createEl('select');
// 		select.style.width = '100%';
// 		select.style.padding = '8px';
// 		select.style.marginTop = '8px';
// 		select.style.marginBottom = '12px';
		
// 		const diceOptions = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100', 'custom'];
// 		diceOptions.forEach(dice => {
// 			select.createEl('option', { text: dice === 'custom' ? 'Custom...' : dice, value: dice });
// 		});
		
// 		// Custom input field (hidden by default)
// 		const customContainer = modal.contentEl.createDiv();
// 		customContainer.style.marginBottom = '12px';
// 		customContainer.style.display = 'none';
		
// 		customContainer.createEl('label', { text: 'Custom dice notation (e.g., d6, 2d6, d100):' });
// 		const customInput = customContainer.createEl('input', {
// 			type: 'text',
// 			placeholder: 'd6'
// 		});
// 		customInput.style.width = '100%';
// 		customInput.style.padding = '8px';
// 		customInput.style.marginTop = '4px';
		
// 		// Show/hide custom input based on selection
// 		select.addEventListener('change', () => {
// 			if (select.value === 'custom') {
// 				customContainer.style.display = 'block';
// 				customInput.focus();
// 			} else {
// 				customContainer.style.display = 'none';
// 			}
// 		});
		
// 		const btnContainer = modal.contentEl.createDiv();
// 		btnContainer.style.display = 'flex';
// 		btnContainer.style.justifyContent = 'flex-end';
// 		btnContainer.style.gap = '8px';
		
// 		const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
// 		cancelBtn.addEventListener('click', () => modal.close());
		
// 		const addBtn = btnContainer.createEl('button', { text: 'Add' });
// 		addBtn.addEventListener('click', () => {
// 			let diceType = select.value;
			
// 			// If custom, validate and use custom input
// 			if (diceType === 'custom') {
// 				diceType = customInput.value.trim().toLowerCase();
// 				if (!diceType) {
// 					new Notice('Please enter a dice notation');
// 					return;
// 				}
// 				// Validate dice notation format
// 				if (!/^\d*d\d+$/.test(diceType)) {
// 					new Notice('Invalid dice notation. Use format like: d6, 2d6, d100');
// 					return;
// 				}
// 			}
			
// 			this.captureState();
// 			// Insert dice column at the beginning
// 			this.state.columns.unshift({ 
// 				id: this.generateColumnId(),
// 				name: diceType, 
// 				type: 'dice',
// 				diceNotation: diceType
// 			});
// 			this.markUnsaved();
// 			this.leftPanel.empty();
// 			this.buildLeftPanel();
// 			this.schedulePreviewUpdate();
// 			modal.close();
// 		});
		
// 		modal.open();
// 	}

// 	private addColumn(type: 'regular' | 'reroll'): void {
// 		// Only allow one reroll column
// 		if (type === 'reroll' && this.state.columns.some(c => c.type === 'reroll')) {
// 			new Notice('Only one reroll column is allowed');
// 			return;
// 		}
		
// 		this.captureState();
// 		const name = type === 'reroll' ? 'reroll' : `Column ${this.state.columns.length}`;
// 		const id = this.generateColumnId();
// 		this.state.columns.push({ id, name, type });
// 		this.markUnsaved();
// 		this.leftPanel.empty();
// 		this.buildLeftPanel();
// 		this.schedulePreviewUpdate();
// 	}

// 	private deleteColumn(index: number): void {
// 		if (this.state.columns.length <= 1) {
// 			new Notice('Cannot delete the last column');
// 			return;
// 		}
		
// 		this.captureState();
// 		const col = this.state.columns[index];
// 		this.state.columns.splice(index, 1);
		
// 		// Remove data from rows using stable ID
// 		const key = col.type === 'dice' ? 'range' : col.id;
// 		this.state.rows.forEach(row => {
// 			delete row[key];
// 		});
		
// 		this.markUnsaved();
// 		this.leftPanel.empty();
// 		this.buildLeftPanel();
// 		this.schedulePreviewUpdate();
// 	}

// 	// Row operations
// 	private addRow(): void {
// 		this.captureState();
// 		this.state.rows.push({});
// 		this.markUnsaved();
// 		this.buildRowGrid();
// 		this.schedulePreviewUpdate();
// 	}

// 	private duplicateRowAt(index: number): void {
// 		if (this.state.rows.length === 0) return;
		
// 		this.captureState();
// 		const row = this.state.rows[index];
// 		const copy = JSON.parse(JSON.stringify(row));
// 		// Insert below the current row
// 		this.state.rows.splice(index + 1, 0, copy);
// 		this.selectedRowIndex = index + 1;
// 		this.markUnsaved();
// 		this.buildRowGrid();
// 		this.schedulePreviewUpdate();
// 	}

// 	private deleteRowAt(index: number): void {
// 		if (this.state.rows.length === 0) return;
		
// 		this.captureState();
// 		this.state.rows.splice(index, 1);
// 		if (this.selectedRowIndex >= this.state.rows.length && this.selectedRowIndex > 0) {
// 			this.selectedRowIndex--;
// 		}
// 		// If we deleted the selected row, update selection
// 		if (index === this.selectedRowIndex && this.state.rows.length > 0) {
// 			this.selectedRowIndex = Math.min(index, this.state.rows.length - 1);
// 		}
// 		this.markUnsaved();
// 		this.buildRowGrid();
// 		this.schedulePreviewUpdate();
// 	}

// 	private clearResults(): void {
// 		this.captureState();
// 		this.state.rows.forEach(row => {
// 			this.state.columns.forEach(col => {
// 				if (col.type === 'regular') {
// 					row[col.id] = ''; // Use stable ID
// 				}
// 			});
// 		});
// 		this.markUnsaved();
// 		this.buildRowGrid();
// 		this.schedulePreviewUpdate();
// 	}

// 	private deleteAllRows(): void {
// 		// Show confirmation modal
// 		const modal = new Modal(this.app);
// 		modal.titleEl.setText('Delete All Rows?');
// 		modal.contentEl.setText('This will delete all rows. Do you want to proceed?.');
		
// 		const btnContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });
// 		const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
// 		cancelBtn.addEventListener('click', () => modal.close());
		
// 		const confirmBtn = btnContainer.createEl('button', { text: 'Delete All', cls: 'mod-warning' });
// 		confirmBtn.addEventListener('click', () => {
// 			this.captureState();
// 			this.state.rows = [];
// 			this.selectedRowIndex = 0;
// 			this.markUnsaved();
// 			this.buildRowGrid();
// 			this.schedulePreviewUpdate();
// 			modal.close();
// 		});
		
// 		modal.open();
// 	}

// 	// Keyboard navigation
// 	private handleCellKeydown(e: KeyboardEvent, rowIndex: number, colIndex: number): void {
// 		const rows = this.state.rows.length;
// 		const cols = this.state.columns.length;
		
// 		let newRow = rowIndex;
// 		let newCol = colIndex;
// 		let shouldMove = false;
		
// 		if (e.key === 'Tab') {
// 			e.preventDefault();
// 			if (e.shiftKey) {
// 				// Move left
// 				newCol--;
// 				if (newCol < 0) {
// 					newCol = cols - 1;
// 					newRow--;
// 				}
// 			} else {
// 				// Move right
// 				newCol++;
// 				if (newCol >= cols) {
// 					newCol = 0;
// 					newRow++;
// 				}
// 			}
// 			shouldMove = true;
// 		} else if (e.key === 'Enter') {
// 			e.preventDefault();
// 			if (e.shiftKey) {
// 				// Move up
// 				newRow--;
// 			} else {
// 				// Move down
// 				newRow++;
// 			}
// 			shouldMove = true;
// 		}
		
// 		if (shouldMove && newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
// 			this.selectedRowIndex = newRow;
// 			// Focus the new cell
// 			setTimeout(() => {
// 				const rowEls = this.rowGrid.querySelectorAll('.row-grid-row');
// 				const rowEl = rowEls[newRow] as HTMLElement;
// 				const inputs = rowEl.querySelectorAll('input');
// 				const input = inputs[newCol] as HTMLInputElement;
// 				if (input) {
// 					input.focus();
// 					input.select();
// 				}
// 			}, 0);
// 		}
// 	}

// 	private updateRowSelection(): void {
// 		// Update row selection visuals without rebuilding
// 		const rowEls = this.rowGrid.querySelectorAll('.row-grid-row');
// 		rowEls.forEach((el, idx) => {
// 			if (idx === this.selectedRowIndex) {
// 				el.addClass('selected');
// 			} else {
// 				el.removeClass('selected');
// 			}
// 		});
// 	}

// 	// Drag and drop for columns
// 	private draggedColumnIndex: number = -1;

// 	private onColumnDragStart(e: DragEvent, index: number): void {
// 		this.draggedColumnIndex = index;
// 		if (e.dataTransfer) {
// 			e.dataTransfer.effectAllowed = 'move';
// 		}
// 	}

// 	private onColumnDragOver(e: DragEvent): void {
// 		e.preventDefault();
// 		if (e.dataTransfer) {
// 			e.dataTransfer.dropEffect = 'move';
// 		}
// 	}

// 	private onColumnDrop(e: DragEvent, targetIndex: number): void {
// 		e.preventDefault();
		
// 		if (this.draggedColumnIndex === targetIndex) return;
		
// 		this.captureState();
		
// 		// Reorder columns
// 		const [moved] = this.state.columns.splice(this.draggedColumnIndex, 1);
// 		this.state.columns.splice(targetIndex, 0, moved);
		
// 		this.draggedColumnIndex = -1;
// 		this.markUnsaved();
		
// 		this.leftPanel.empty();
// 		this.buildLeftPanel();
// 		this.schedulePreviewUpdate();
// 	}

// 	// Column operations
// 	private showColumnContextMenu(e: MouseEvent, colIndex: number): void {
// 		// Close any existing menu and remove its event listener
// 		if (this.activeMenuCloseListener) {
// 			document.removeEventListener('click', this.activeMenuCloseListener);
// 			this.activeMenuCloseListener = null;
// 		}
		
// 		if (this.activeContextMenu) {
// 			try {
// 				if (this.activeContextMenu.parentNode) {
// 					this.activeContextMenu.parentNode.removeChild(this.activeContextMenu);
// 				}
// 			} catch (e) {
// 				// Menu already removed, ignore
// 			}
// 			this.activeContextMenu = null;
// 		}
		
// 		const menu = document.createElement('div');
// 		menu.className = 'column-context-menu';
// 		menu.style.position = 'fixed';
// 		menu.style.left = `${e.clientX}px`;
// 		menu.style.top = `${e.clientY}px`;
// 		menu.style.zIndex = '10000';
// 		menu.style.background = 'var(--background-secondary)';
// 		menu.style.border = '1px solid var(--background-modifier-border)';
// 		menu.style.borderRadius = '4px';
// 		menu.style.padding = '4px';
// 		menu.style.minWidth = '150px';
		
// 		const pasteOption = menu.createEl('div', { 
// 			text: 'Paste into column',
// 			cls: 'context-menu-item'
// 		});
// 		pasteOption.style.padding = '6px 12px';
// 		pasteOption.style.cursor = 'pointer';
// 		pasteOption.addEventListener('mouseenter', () => {
// 			pasteOption.style.background = 'var(--background-modifier-hover)';
// 		});
// 		pasteOption.addEventListener('mouseleave', () => {
// 			pasteOption.style.background = '';
// 		});
// 		pasteOption.addEventListener('click', async () => {
// 			// Remove the close listener first to prevent it from interfering
// 			if (this.activeMenuCloseListener) {
// 				document.removeEventListener('click', this.activeMenuCloseListener);
// 				this.activeMenuCloseListener = null;
// 			}
			
// 			await this.pasteIntoColumn(colIndex);
			
// 			// Safely remove the menu
// 			if (menu.parentNode && document.body.contains(menu)) {
// 				try {
// 					menu.parentNode.removeChild(menu);
// 				} catch (e) {
// 					// Menu already removed, ignore
// 				}
// 			}
			
// 			this.activeContextMenu = null;
// 		});
		
// 		document.body.appendChild(menu);
// 		this.activeContextMenu = menu;
		
// 		// Close menu on click outside
// 		const closeMenu = (event: MouseEvent) => {
// 			if (!menu.contains(event.target as Node)) {
// 				// Remove event listener first to prevent re-entry
// 				document.removeEventListener('click', closeMenu);
// 				this.activeMenuCloseListener = null;
				
// 				// Cleanup the menu safely - check if it still exists in DOM
// 				if (document.body.contains(menu)) {
// 					try {
// 						document.body.removeChild(menu);
// 					} catch (error) {
// 						// Ignore if already removed
// 					}
// 				}
				
// 				// Clear reference
// 				if (this.activeContextMenu === menu) {
// 					this.activeContextMenu = null;
// 				}
// 			}
// 		};
		
// 		// Track the listener so we can clean it up
// 		this.activeMenuCloseListener = closeMenu;
		
// 		// Add the event listener on next tick to avoid immediate trigger
// 		setTimeout(() => {
// 			// Only add listener if view hasn't been closed
// 			if (this.activeContextMenu === menu) {
// 				document.addEventListener('click', closeMenu);
// 			}
// 		}, 0);
// 	}
	
// 	private async pasteIntoColumn(colIndex: number): Promise<void> {
// 		try {
// 			const text = await navigator.clipboard.readText();
			
// 			if (!text.trim()) {
// 				new Notice('Clipboard is empty');
// 				return;
// 			}
			
// 			// Parse clipboard data - support comma, tab (Excel), or newline separation
// 			let values: string[];
			
// 			// Check if it's tab-separated (Excel copy)
// 			if (text.includes('\t')) {
// 				// Split by newlines first, then take first column if multiple columns
// 				const rows = text.split(/\r?\n/).filter(r => r.trim());
// 				values = rows.map(row => row.split('\t')[0].trim());
// 			} 
// 			// Check if it's comma-separated
// 			else if (text.includes(',') && !text.includes('\n')) {
// 				values = text.split(',').map(v => v.trim()).filter(v => v);
// 			}
// 			// Otherwise split by newlines
// 			else {
// 				values = text.split(/\r?\n/).map(v => v.trim()).filter(v => v);
// 			}
			
// 			if (values.length === 0) {
// 				new Notice('No valid data to paste');
// 				return;
// 			}
			
// 			this.captureState();
			
// 			const col = this.state.columns[colIndex];
// 		const cellKey = col.type === 'dice' ? 'range' : col.id; // Use stable ID
// 		const rowsNeeded = values.length;
		
// 		// Add more rows if needed
			
// 			this.markUnsaved();
// 			this.buildRowGrid();
// 			this.schedulePreviewUpdate();
			
// 			new Notice(`Pasted ${values.length} values into ${col.name}`);
// 		} catch (error) {
// 			console.error('Error pasting into column:', error);
// 			new Notice('Failed to paste from clipboard');
// 		}
// 	}

// 	// Examples
// 	private applyExample(diceNotation: string, rowCount: number): void {
// 		this.captureState();
		
// 		// Update first column to be dice column
// 		this.state.columns[0] = {
// 			id: this.state.columns[0]?.id || this.generateColumnId(),
// 			name: diceNotation,
// 			type: 'dice',
// 			diceNotation: diceNotation
// 		};
		
// 		// Generate rows
// 		this.state.rows = this.generateDefaultRows(diceNotation, rowCount);
		
// 		this.markUnsaved();
// 		this.leftPanel.empty();
// 		this.buildLeftPanel();
// 		this.schedulePreviewUpdate();
		
// 		new Notice(`Applied ${diceNotation} with ${rowCount} rows`);
// 	}
	
// 	private generateRows(diceNotation: string, rowCount: number, groupSize?: number, remainder?: 'expand-first' | 'expand-last' | 'row-first' | 'row-last'): void {
// 		this.captureState();
		
// 		// Generate rows for existing dice column
// 		this.state.rows = this.generateDefaultRows(diceNotation, rowCount, groupSize, remainder);
		
// 		this.markUnsaved();
// 		this.buildRowGrid();
// 		this.schedulePreviewUpdate();
		
// 		new Notice(`Generated ${rowCount} rows for ${diceNotation}`);
// 	}
	
// 	private showGenerateRowsModal(diceNotation: string): void {
// 		const modal = new Modal(this.app);
// 		modal.titleEl.setText(`Generate Rows for ${diceNotation}`);
		
// 		// Parse dice to determine good row counts
// 		const match = diceNotation.match(/^(\d*)d(\d+)$/i);
// 		if (!match) {
// 			new Notice('Invalid dice notation');
// 			return;
// 		}
		
// 		const numDice = match[1] ? parseInt(match[1]) : 1;
// 		const sides = parseInt(match[2]);
// 		const minValue = numDice;
// 		const maxValue = numDice * sides;
// 		const totalRange = maxValue - minValue + 1;
		
// 		const generateOptions: Array<{name: string, count: number, groupSize?: number}> = [];
		
// 		// Always offer individual rows
// 		generateOptions.push({ name: `All values (${totalRange} rows)`, count: totalRange });
		
// 		// Offer common group sizes (2, 3, 5, 10) if less than total range
// 		const commonGroupSizes = [2, 3, 5, 10];
// 		for (const groupSize of commonGroupSizes) {
// 			if (groupSize < totalRange) {
// 				const rowCount = Math.ceil(totalRange / groupSize);
// 				generateOptions.push({ name: `Every ${groupSize} (~${rowCount} rows)`, count: rowCount, groupSize: groupSize });
// 			}
// 		}
		
// 		// Create unified form
// 		const formContainer = modal.contentEl.createDiv();
// 		formContainer.style.marginBottom = '12px';
		
// 		// Range option dropdown
// 		const optionLabel = formContainer.createEl('label', { text: 'Range option:' });
// 		optionLabel.style.display = 'block';
// 		optionLabel.style.marginBottom = '4px';
		
// 		const optionSelect = formContainer.createEl('select');
// 		optionSelect.style.width = '100%';
// 		optionSelect.style.padding = '8px';
// 		optionSelect.style.marginBottom = '12px';
		
// 		// Add preset options
// 		generateOptions.forEach(option => {
// 			optionSelect.createEl('option', { 
// 				text: option.name, 
// 				value: option.groupSize ? option.groupSize.toString() : 'all'
// 			});
// 		});
		
// 		// Add custom option
// 		optionSelect.createEl('option', { text: 'Custom', value: 'custom' });
		
// 		// Custom input (hidden by default)
// 		const customInputContainer = formContainer.createDiv();
// 		customInputContainer.style.display = 'none';
// 		customInputContainer.style.marginBottom = '12px';
		
// 		const customLabel = customInputContainer.createEl('label', { text: 'Range (values per row):' });
// 		customLabel.style.display = 'block';
// 		customLabel.style.marginBottom = '4px';
		
// 		const customInput = customInputContainer.createEl('input', {
// 			type: 'number',
// 			placeholder: '2',
// 			attr: { min: '2', max: totalRange.toString() }
// 		});
// 		customInput.style.width = '100%';
// 		customInput.style.padding = '8px';
		
// 		// Show/hide custom input based on selection
// 		optionSelect.addEventListener('change', () => {
// 			customInputContainer.style.display = optionSelect.value === 'custom' ? 'block' : 'none';
// 		});
		
// 		// Remainder handling dropdown (always visible for grouped options)
// 		const remainderContainer = formContainer.createDiv();
// 		remainderContainer.style.marginBottom = '12px';
		
// 		const remainderLabel = remainderContainer.createEl('label', { text: 'Handle remainder:' });
// 		remainderLabel.style.display = 'block';
// 		remainderLabel.style.marginBottom = '4px';
		
// 		const remainderSelect = remainderContainer.createEl('select');
// 		remainderSelect.style.width = '100%';
// 		remainderSelect.style.padding = '8px';
// 		remainderSelect.createEl('option', { text: 'Expand first row (add to first range)', value: 'expand-first' });
// 		remainderSelect.createEl('option', { text: 'Expand last row (add to last range)', value: 'expand-last', attr: { selected: 'selected' } });
// 		remainderSelect.createEl('option', { text: 'Additional row at start', value: 'row-first' });
// 		remainderSelect.createEl('option', { text: 'Additional row at end', value: 'row-last' });
		
// 		// Generate button
// 		const generateBtn = formContainer.createEl('button', { 
// 			text: 'Generate',
// 			cls: 'table-builder-btn'
// 		});
// 		generateBtn.style.width = '100%';
// 		generateBtn.addEventListener('click', () => {
// 			const selectedValue = optionSelect.value;
// 			let groupSize: number | undefined;
			
// 			if (selectedValue === 'all') {
// 				// All values - no grouping
// 				groupSize = undefined;
// 			} else if (selectedValue === 'custom') {
// 				// Custom group size
// 				groupSize = parseInt(customInput.value);
// 				if (!groupSize || groupSize < 2) {
// 					new Notice('Range must be at least 2');
// 					return;
// 				}
// 				if (groupSize > totalRange) {
// 					new Notice(`Range cannot exceed total range (${totalRange})`);
// 					return;
// 				}
// 			} else {
// 				// Preset group size
// 				groupSize = parseInt(selectedValue);
// 			}
			
// 			const remainder = remainderSelect.value as 'expand-first' | 'expand-last' | 'row-first' | 'row-last';
// 			const rowCount = groupSize ? Math.ceil(totalRange / groupSize) : totalRange;
// 			this.generateRows(diceNotation, rowCount, groupSize, remainder);
// 			modal.close();
// 		});
		
// 		modal.open();
// 	}

// 	// Template operations
// 	private async saveAsTemplate(): Promise<void> {
// 		const modal = new Modal(this.app);
// 		modal.titleEl.setText('Save as Template');
		
// 		const input = modal.contentEl.createEl('input', {
// 			type: 'text',
// 			placeholder: 'Template name',
// 			value: this.state.tableName + ' Template'
// 		});
// 		input.style.width = '100%';
// 		input.style.padding = '8px';
// 		input.style.marginBottom = '12px';
		
// 		const btnContainer = modal.contentEl.createDiv();
// 		btnContainer.style.display = 'flex';
// 		btnContainer.style.justifyContent = 'flex-end';
// 		btnContainer.style.gap = '8px';
		
// 		const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
// 		cancelBtn.addEventListener('click', () => modal.close());
		
// 		const saveBtn = btnContainer.createEl('button', { text: 'Save' });
// 		saveBtn.addEventListener('click', async () => {
// 			const templateName = input.value.trim();
// 			if (!templateName) {
// 				new Notice('Template name cannot be empty');
// 				return;
// 			}
			
// 			await this.saveTemplate(templateName);
// 			modal.close();
// 		});
		
// 		input.addEventListener('keypress', (e) => {
// 			if (e.key === 'Enter') {
// 				saveBtn.click();
// 			}
// 		});
		
// 		modal.open();
// 		input.focus();
// 	}

// 	private async saveTemplate(templateName: string): Promise<void> {
// 		try {
// 			// Ensure .table-templates folder exists
// 			const templatesFolder = '.table-templates';
// 			const folder = this.app.vault.getAbstractFileByPath(templatesFolder);
// 			if (!folder) {
// 				await this.app.vault.createFolder(templatesFolder);
// 			}
			
// 			// Create template content (structure only, no row data)
// 			const templateState: TableState = {
// 				tableName: templateName,
// 				columns: JSON.parse(JSON.stringify(this.state.columns)),
// 				rows: this.state.rows.map(() => ({})), // Empty rows with same count
// 				isPrivate: this.state.isPrivate,
// 				tableReroll: this.state.tableReroll
// 			};
			
// 			const lines: string[] = [];
// 			lines.push('---');
// 			lines.push('table-roller-template: true');
// 			lines.push('---');
// 			lines.push('');
// 			lines.push(`# ${templateName}`);
// 			lines.push('');
// 			lines.push('```json');
// 			lines.push(JSON.stringify(templateState, null, 2));
// 			lines.push('```');
			
// 			const filename = `${templatesFolder}/${templateName}.md`;
// 			await this.app.vault.create(filename, lines.join('\n'));
			
// 			new Notice(`Template saved: ${templateName}`);
// 		} catch (error) {
// 			console.error('Error saving template:', error);
// 			new Notice('Failed to save template');
// 		}
// 	}

// 	// Import/Export
// 	private async importFromClipboard(): Promise<void> {
// 		try {
// 			const text = await navigator.clipboard.readText();
			
// 			// Parse as markdown table
// 			const lines = text.split('\n').filter(l => l.trim().includes('|'));
// 			if (lines.length < 2) {
// 				new Notice('No valid table found in clipboard');
// 				return;
// 			}
			
// 			// Parse similar to TableParser
// 			const headerLine = lines[0];
// 			const headers = headerLine.split('|')
// 				.map(h => h.trim())
// 				.filter(h => h.length > 0);
			
// 			if (headers.length === 0) {
// 				new Notice('Could not parse table headers');
// 				return;
// 			}
			
// 			// Detect columns
// 			const columns: ColumnConfig[] = headers.map((h, idx) => {
// 				const id = this.generateColumnId();
// 				if (/^\d*d\d+$/i.test(h.trim())) {
// 					return { id, name: h, type: 'dice' as const, diceNotation: h.toLowerCase() };
// 				} else if (/^reroll$/i.test(h.trim())) {
// 					return { id, name: h, type: 'reroll' as const };
// 				} else {
// 					return { id, name: h, type: 'regular' as const };
// 				}
// 			});
			
// 			// Parse rows (skip separator line)
// 			const rows: RowData[] = [];
// 			for (let i = 2; i < lines.length; i++) {
// 				const cells = lines[i].split('|')
// 					.map(c => c.trim())
// 					.filter((_, idx) => idx > 0 && idx <= headers.length);
				
// 				if (cells.length > 0) {
// 					const row: RowData = {};
// 					headers.forEach((header, idx) => {
// 						const col = columns[idx];
// 						const key = col.type === 'dice' ? 'range' : col.id; // Use stable ID
// 						row[key] = cells[idx] || '';
// 					});
// 					rows.push(row);
// 				}
// 			}
			
// 			// Update state
// 			this.captureState();
// 			this.state.columns = columns;
// 			this.state.rows = rows;
// 			this.markUnsaved();
			
// 			this.leftPanel.empty();
// 			this.buildLeftPanel();
// 			this.schedulePreviewUpdate();
			
// 			new Notice('Table imported from clipboard');
// 		} catch (error) {
// 			console.error('Import error:', error);
// 			new Notice('Failed to import from clipboard');
// 		}
// 	}

// 	private async copyToClipboard(): Promise<void> {
// 		const markdown = this.generateMarkdown();
// 		await navigator.clipboard.writeText(markdown);
// 		new Notice('Copied to clipboard');
// 	}

// 	private async save(): Promise<void> {
// 		if (!await this.validate()) {
// 			return;
// 		}
		
// 		// If we have a current file, save directly to it
// 		if (this.currentFile) {
// 			await this.saveToCurrentFile();
// 			return;
// 		}
		
// 		// Otherwise, show save options
// 		await this.saveAs();
// 	}
	
// 	private async saveAs(): Promise<void> {
// 		// Validate first
// 		if (!await this.validate()) {
// 			return;
// 		}
		
// 		// Show save options modal
// 		const modal = new Modal(this.app);
// 		modal.titleEl.setText('Save Table As');
		
// 		const createNewBtn = modal.contentEl.createEl('button', { 
// 			text: 'Create New File',
// 			cls: 'table-builder-btn'
// 		});
// 		createNewBtn.style.width = '100%';
// 		createNewBtn.style.marginBottom = '8px';
// 		createNewBtn.addEventListener('click', () => {
// 			modal.close();
// 			this.saveToNewFile();
// 		});
		
// 		const appendBtn = modal.contentEl.createEl('button', { 
// 			text: 'Append to Existing File',
// 			cls: 'table-builder-btn'
// 		});
// 		appendBtn.style.width = '100%';
// 		appendBtn.addEventListener('click', () => {
// 			modal.close();
// 			this.appendToFile();
// 		});
		
// 		modal.open();
// 	}

// 	private async saveToNewFile(): Promise<void> {
// 		const modal = new Modal(this.app);
// 		modal.titleEl.setText('Save to New File');
		
// 		const input = modal.contentEl.createEl('input', {
// 			type: 'text',
// 			placeholder: 'Filename (without .md)',
// 			value: this.state.tableName
// 		});
// 		input.style.width = '100%';
// 		input.style.padding = '8px';
// 		input.style.marginBottom = '12px';
		
// 		const btnContainer = modal.contentEl.createDiv();
// 		btnContainer.style.display = 'flex';
// 		btnContainer.style.justifyContent = 'flex-end';
// 		btnContainer.style.gap = '8px';
		
// 		const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
// 		cancelBtn.addEventListener('click', () => modal.close());
		
// 		const saveBtn = btnContainer.createEl('button', { text: 'Save' });
// 		saveBtn.addEventListener('click', async () => {
// 			const filename = input.value.trim();
// 			if (!filename) {
// 				new Notice('Filename cannot be empty');
// 				return;
// 			}
			
// 			const fullFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
// 			const markdown = this.generateMarkdown();
			
// 			try {
// 				const file = await this.app.vault.create(fullFilename, markdown);
// 				new Notice(`Saved to ${fullFilename}`);
// 				this.currentFile = file; // Remember this file
// 				this.hasUnsavedChanges = false;
// 				await this.roller.loadTables(); // Reload tables to include new one
// 				modal.close();
// 			} catch (error) {
// 				console.error('Error saving file:', error);
// 				new Notice('Failed to save file');
// 			}
// 		});
		
// 		input.addEventListener('keypress', (e) => {
// 			if (e.key === 'Enter') {
// 				saveBtn.click();
// 			}
// 		});
		
// 		modal.open();
// 		input.focus();
// 	}

// 	private async appendToFile(): Promise<void> {
// 		const files = this.app.vault.getMarkdownFiles()
// 			.filter(f => !f.path.startsWith('.table-templates/'));
		
// 		if (files.length === 0) {
// 			new Notice('No markdown files found');
// 			return;
// 		}
		
// 		// File picker modal with search
// 		const modal = new Modal(this.app);
// 		modal.titleEl.setText('Select File to Append To');
		
// 		// Search input
// 		const searchInput = modal.contentEl.createEl('input', {
// 			type: 'text',
// 			placeholder: 'Search files...'
// 		});
// 		searchInput.style.width = '100%';
// 		searchInput.style.padding = '8px';
// 		searchInput.style.marginBottom = '12px';
// 		searchInput.style.fontSize = '14px';
		
// 		// File list container
// 		const fileList = modal.contentEl.createDiv({ cls: 'file-list' });
// 		fileList.style.maxHeight = '400px';
// 		fileList.style.overflowY = 'auto';
		
// 		let fileButtons: Array<{ button: HTMLElement, file: TFile }> = [];
		
// 		// Function to render file list
// 		const renderFiles = (searchTerm: string = '') => {
// 			fileList.empty();
// 			fileButtons = [];
			
// 			// Filter and sort files
// 			let filteredFiles = files;
// 			if (searchTerm) {
// 				const lower = searchTerm.toLowerCase();
// 				filteredFiles = files
// 					.filter(f => f.path.toLowerCase().includes(lower))
// 					.sort((a, b) => {
// 						// Prioritize files that start with the search term
// 						const aStarts = a.basename.toLowerCase().startsWith(lower);
// 						const bStarts = b.basename.toLowerCase().startsWith(lower);
// 						if (aStarts && !bStarts) return -1;
// 						if (!aStarts && bStarts) return 1;
						
// 						// Then sort by how early the match appears
// 						const aIndex = a.path.toLowerCase().indexOf(lower);
// 						const bIndex = b.path.toLowerCase().indexOf(lower);
// 						if (aIndex !== bIndex) return aIndex - bIndex;
						
// 						// Finally alphabetical
// 						return a.path.localeCompare(b.path);
// 					});
// 			} else {
// 				filteredFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
// 			}
			
// 			if (filteredFiles.length === 0) {
// 				const noResults = fileList.createDiv({ text: 'No files match your search' });
// 				noResults.style.padding = '16px';
// 				noResults.style.textAlign = 'center';
// 				noResults.style.color = 'var(--text-muted)';
// 				return;
// 			}
			
// 			filteredFiles.forEach(file => {
// 				const fileBtn = fileList.createEl('button', { 
// 					text: file.path,
// 					cls: 'file-option'
// 				});
// 				fileBtn.style.display = 'block';
// 				fileBtn.style.width = '100%';
// 				fileBtn.style.textAlign = 'left';
// 				fileBtn.style.padding = '8px';
// 				fileBtn.style.marginBottom = '4px';
// 				fileBtn.style.border = '1px solid var(--background-modifier-border)';
// 				fileBtn.style.background = 'var(--background-secondary)';
// 				fileBtn.style.cursor = 'pointer';
				
// 				fileBtn.addEventListener('click', async () => {
// 					modal.close();
// 					await this.appendToSpecificFile(file);
// 				});
				
// 				fileBtn.addEventListener('mouseenter', () => {
// 					fileBtn.style.background = 'var(--background-modifier-hover)';
// 				});
// 				fileBtn.addEventListener('mouseleave', () => {
// 					fileBtn.style.background = 'var(--background-secondary)';
// 				});
				
// 				fileButtons.push({ button: fileBtn, file });
// 			});
// 		};
		
// 		// Initial render
// 		renderFiles();
		
// 		// Search input handler
// 		searchInput.addEventListener('input', () => {
// 			renderFiles(searchInput.value);
// 		});
		
// 		// Focus search input and select first result on Enter
// 		searchInput.addEventListener('keydown', (e) => {
// 			if (e.key === 'Enter' && fileButtons.length > 0) {
// 				modal.close();
// 				this.appendToSpecificFile(fileButtons[0].file);
// 			}
// 		});
		
// 		modal.open();
		
// 		// Auto-focus search input
// 		setTimeout(() => searchInput.focus(), 50);
// 	}

// 	private async appendToSpecificFile(file: TFile): Promise<void> {
// 		try {
// 			const currentContent = await this.app.vault.read(file);
// 			const markdown = this.generateMarkdown();
			
// 			// Extract just the table part (without frontmatter)
// 			const lines = markdown.split('\n');
// 			const tableStartIndex = lines.findIndex(l => l.startsWith('#'));
// 			const tableContent = lines.slice(tableStartIndex).join('\n');
			
// 			// Append to file
// 			const newContent = currentContent + '\n\n' + tableContent;
// 			await this.app.vault.modify(file, newContent);
			
// 			new Notice(`Appended to ${file.path}`);
// 			this.currentFile = file; // Remember this file
// 			this.hasUnsavedChanges = false;
// 			await this.roller.loadTables(); // Reload tables
// 		} catch (error) {
// 			console.error('Error appending to file:', error);
// 			new Notice('Failed to append to file');
// 		}
// 	}

// 	private async loadTable(): Promise<void> {
// 		const files = this.app.vault.getMarkdownFiles()
// 			.filter(f => !f.path.startsWith('.table-templates/'));
		
// 		if (files.length === 0) {
// 			new Notice('No markdown files found');
// 			return;
// 		}
		
// 		// Simple file picker modal
// 		const modal = new Modal(this.app);
// 		modal.titleEl.setText('Load Table from File');
		
// 		const fileList = modal.contentEl.createDiv({ cls: 'file-list' });
// 		fileList.style.maxHeight = '400px';
// 		fileList.style.overflowY = 'auto';
		
// 		files.forEach(file => {
// 			const fileBtn = fileList.createEl('button', { 
// 				text: file.path,
// 				cls: 'file-option'
// 			});
// 			fileBtn.style.display = 'block';
// 			fileBtn.style.width = '100%';
// 			fileBtn.style.textAlign = 'left';
// 			fileBtn.style.padding = '8px';
// 			fileBtn.style.marginBottom = '4px';
// 			fileBtn.style.border = '1px solid var(--background-modifier-border)';
// 			fileBtn.style.background = 'var(--background-secondary)';
// 			fileBtn.style.cursor = 'pointer';
			
// 			fileBtn.addEventListener('click', async () => {
// 				modal.close();
// 				await this.loadFromFile(file);
// 			});
			
// 			fileBtn.addEventListener('mouseenter', () => {
// 				fileBtn.style.background = 'var(--background-modifier-hover)';
// 			});
// 			fileBtn.addEventListener('mouseleave', () => {
// 				fileBtn.style.background = 'var(--background-secondary)';
// 			});
// 		});
		
// 		modal.open();
// 	}

// 	private async loadFromFile(file: TFile): Promise<void> {
// 		try {
// 			this.currentFile = file; // Remember which file we're loading from
// 			const content = await this.app.vault.read(file);
// 			const parsed = TableParser.parseTables(content, file.basename);
			
// 			const tableNames = Object.keys(parsed.tables);
			
// 			if (tableNames.length === 0) {
// 				new Notice('No tables found in file');
// 				return;
// 			}
			
// 			// If there's only one table and its name matches the file basename, load it
// 			// Otherwise, always show the picker so user can see what's available
// 			if (tableNames.length === 1 && tableNames[0] === file.basename) {
// 				await this.loadParsedTable(tableNames[0], parsed.tables[tableNames[0]], parsed);
// 			} else {
// 				// Show table picker (even for single tables if name doesn't match file)
// 				this.showTablePicker(tableNames, parsed, file);
// 			}
// 		} catch (error) {
// 			console.error('Error loading table:', error);
// 			new Notice('Failed to load table');
// 		}
// 	}

// 	private showTablePicker(tableNames: string[], parsed: any, file: TFile): void {
// 		const modal = new Modal(this.app);
// 		modal.titleEl.setText(`Select Table from ${file.basename}`);
		
// 		modal.contentEl.createEl('p', { 
// 			text: `This file contains ${tableNames.length} table${tableNames.length > 1 ? 's' : ''}:`,
// 			cls: 'table-picker-hint'
// 		});
		
// 		const tableList = modal.contentEl.createDiv({ cls: 'table-list' });
// 		tableList.style.maxHeight = '500px';
// 		tableList.style.overflowY = 'auto';
// 		tableList.style.minWidth = '400px';
		
// 		tableNames.forEach(name => {
// 			const table = parsed.tables[name];
// 			const isDiceTable = 'dice' in table;
// 			const entryCount = isDiceTable ? table.entries.length : table.rows.length;
// 			const tableType = isDiceTable ? `Dice (${table.dice})` : 'Simple';
			
// 			const btn = tableList.createEl('button', { 
// 				cls: 'table-option'
// 			});
// 			btn.style.display = 'block';
// 			btn.style.width = '100%';
// 			btn.style.textAlign = 'left';
// 			btn.style.padding = '12px';
// 			btn.style.marginBottom = '8px';
// 			btn.style.border = '1px solid var(--background-modifier-border)';
// 			btn.style.background = 'var(--background-secondary)';
// 			btn.style.cursor = 'pointer';
// 			btn.style.minHeight = '60px';
			
// 			const nameEl = btn.createEl('div', { text: name });
// 			nameEl.style.fontWeight = 'bold';
// 			nameEl.style.marginBottom = '4px';
// 			nameEl.style.overflow = 'hidden';
// 			nameEl.style.textOverflow = 'ellipsis';
// 			nameEl.style.whiteSpace = 'normal';
// 			nameEl.style.wordBreak = 'break-word';
// 			nameEl.style.marginBottom = '4px';
			
// 			const infoEl = btn.createEl('div', { 
// 				text: `${tableType} • ${entryCount} rows`,
// 				cls: 'table-info'
// 			});
// 			infoEl.style.fontSize = '0.9em';
// 			infoEl.style.opacity = '0.7';
			
// 			btn.addEventListener('click', async () => {
// 				modal.close();
// 				await this.loadParsedTable(name, table, parsed);
// 			});
			
// 			btn.addEventListener('mouseenter', () => {
// 				btn.style.background = 'var(--background-modifier-hover)';
// 			});
// 			btn.addEventListener('mouseleave', () => {
// 				btn.style.background = 'var(--background-secondary)';
// 			});
// 		});
		
// 		modal.open();
// 	}

// 	private async loadParsedTable(tableName: string, table: any, parsed: any): Promise<void> {
// 		// Convert parsed table back to state
// 		const columns: ColumnConfig[] = [];
// 		const rows: RowData[] = [];
		
// 		// Map to track old column name -> new column ID for data migration
// 		const nameToIdMap = new Map<string, string>();
		
// 		if ('dice' in table) {
// 			// Dice table
// 			const diceColId = this.generateColumnId();
// 			columns.push({
// 				id: diceColId,
// 				name: table.dice,
// 				type: 'dice',
// 				diceNotation: table.dice
// 			});
			
// 			// Check if any entry has a reroll directive
// 			const hasRerollColumn = table.entries.some((e: any) => e.reroll);
			
// 			// Get other columns from first entry
// 			if (table.entries.length > 0) {
// 				const firstEntry = table.entries[0];
// 				if (firstEntry.columns) {
// 					for (const colName of Object.keys(firstEntry.columns)) {
// 						const colId = this.generateColumnId();
// 						nameToIdMap.set(colName, colId);
// 						if (colName.toLowerCase() === 'reroll') {
// 							columns.push({ id: colId, name: colName, type: 'reroll' });
// 						} else {
// 							columns.push({ id: colId, name: colName, type: 'regular' });
// 						}
// 					}
// 				}
// 			}
			
// 			// Add reroll column if needed and not already in columns
// 			if (hasRerollColumn && !columns.some(c => c.type === 'reroll')) {
// 				const rerollColId = this.generateColumnId();
// 				columns.push({ id: rerollColId, name: 'Reroll', type: 'reroll' });
// 				nameToIdMap.set('reroll', rerollColId);
// 			}
			
// 			// Convert entries to rows, migrating keys from names to IDs
// 			for (const entry of table.entries) {
// 				// Preserve "X+" notation when max is 999
// 				let rangeStr: string;
// 				if (entry.max === 999 && entry.min > 1) {
// 					rangeStr = `${entry.min}+`;
// 				} else if (entry.min === entry.max) {
// 					rangeStr = `${entry.min}`;
// 				} else {
// 					rangeStr = `${entry.min}-${entry.max}`;
// 				}
				
// 				const row: RowData = {
// 					range: rangeStr
// 				};
				
// 				if (entry.columns) {
// 					for (const [key, value] of Object.entries(entry.columns)) {
// 						const newKey = nameToIdMap.get(key) || key;
// 						row[newKey] = value as string;
// 					}
// 				}
				
// 				if (entry.reroll) {
// 					const rerollColId = nameToIdMap.get('reroll') || 'reroll';
// 					row[rerollColId] = entry.reroll;
// 				}
				
// 				rows.push(row);
// 			}
// 		} else {
// 			// Simple table
// 			for (const header of table.headers) {
// 				const colId = this.generateColumnId();
// 				nameToIdMap.set(header, colId);
// 				if (header.toLowerCase() === 'reroll') {
// 					columns.push({ id: colId, name: header, type: 'reroll' });
// 				} else {
// 					columns.push({ id: colId, name: header, type: 'regular' });
// 				}
// 			}
			
// 			// Migrate row keys from names to IDs
// 			for (const row of table.rows) {
// 				const migratedRow: RowData = {};
// 				for (const [key, value] of Object.entries(row)) {
// 					const newKey = nameToIdMap.get(key) || key;
// 					migratedRow[newKey] = value as string;
// 				}
// 				rows.push(migratedRow);
// 			}
// 		}
		
// 		// Update state
// 		this.state = {
// 			tableName: tableName,
// 			columns: columns,
// 			rows: rows,
// 			isPrivate: table.private || false,
// 			tableReroll: table.reroll
// 		};
		
// 		// Clear history
// 		this.history = [];
// 		this.historyIndex = -1;
// 		this.hasUnsavedChanges = false;
		
// 		// Rebuild UI
// 		this.leftPanel.empty();
// 		this.buildLeftPanel();
// 		this.updatePreview();
		
// 		new Notice(`Loaded table: ${tableName}`);
// 	}
	
// 	private async saveToCurrentFile(): Promise<void> {
// 		if (!this.currentFile) return;
		
// 		try {
// 			const currentContent = await this.app.vault.read(this.currentFile);
// 			const markdown = this.generateMarkdown();
			
// 			// Try to find and replace the existing table in the file
// 			const tableName = this.state.tableName;
// 			const tableHeading = `# ${tableName}`;
			
// 			// Find the table section
// 			const lines = currentContent.split('\n');
// 			let tableStartIndex = -1;
// 			let tableEndIndex = -1;
			
// 			// Find the heading for this table (more robust matching)
// 			for (let i = 0; i < lines.length; i++) {
// 				const line = lines[i].trim();
				
// 				// Match heading with any number of # symbols
// 				const headingMatch = line.match(/^#+\s*(.+)$/);
// 				if (headingMatch && headingMatch[1].trim() === tableName.trim()) {
// 					tableStartIndex = i;
// 					break;
// 				}
// 			}
			
// 			if (tableStartIndex !== -1) {
// 				// Find the end of this table (next heading or end of file)
// 				// We need to include the entire table section including directives and blank lines
// 				tableEndIndex = tableStartIndex;
				
// 				for (let i = tableStartIndex + 1; i < lines.length; i++) {
// 					const line = lines[i].trim();
// 					// Stop if we hit another heading (any number of # symbols)
// 					if (line.match(/^#+\s+/)) {
// 						break;
// 					}
// 					// Include this line as part of the table
// 					tableEndIndex = i;
// 				}
				
// 				// Trim trailing empty lines from the table section
// 				while (tableEndIndex > tableStartIndex && lines[tableEndIndex].trim() === '') {
// 					tableEndIndex--;
// 				}
				
// 				// Extract just the table content (without frontmatter)
// 				const markdownLines = markdown.split('\n');
// 				const tableContentStart = markdownLines.findIndex(l => l.match(/^#+\s+/));
// 				const newTableContent = markdownLines.slice(tableContentStart).join('\n');
				
// 				// Replace the old table with the new one
// 				const before = lines.slice(0, tableStartIndex);
// 				const after = lines.slice(tableEndIndex + 1);
				
// 				// Clean up empty lines
// 				while (before.length > 0 && before[before.length - 1].trim() === '') {
// 					before.pop();
// 				}
// 				while (after.length > 0 && after[0].trim() === '') {
// 					after.shift();
// 				}
				
// 				const newContent = [...before, '', newTableContent, '', ...after].join('\n');
				
// 				await this.app.vault.modify(this.currentFile, newContent);
				
// 				new Notice(`Saved to ${this.currentFile.path}`);
// 			} else {
// 				// Table not found, append to end
// 				const markdownLines = markdown.split('\n');
// 				const tableContentStart = markdownLines.findIndex(l => l.startsWith('#'));
// 				const newTableContent = markdownLines.slice(tableContentStart).join('\n');
				
// 				const newContent = currentContent + '\n\n' + newTableContent;
// 				await this.app.vault.modify(this.currentFile, newContent);
				
// 				new Notice(`Table added to ${this.currentFile.path}`);
// 			}
			
// 			this.hasUnsavedChanges = false;
// 			await this.roller.loadTables();
// 		} catch (error) {
// 			console.error('Error saving to current file:', error);
// 			new Notice('Failed to save to file');
// 		}
// 	}

// 	private async exportAs(format: 'md' | 'csv' | 'json'): Promise<void> {
// 		let content = '';
// 		let extension = '';
		
// 		if (format === 'md') {
// 			content = this.generateMarkdown();
// 			extension = 'md';
// 		} else if (format === 'csv') {
// 			content = this.generateCSV();
// 			extension = 'csv';
// 		} else if (format === 'json') {
// 			content = this.generateJSON();
// 			extension = 'json';
// 		}
		
// 		// Copy to clipboard for now
// 		await navigator.clipboard.writeText(content);
// 		new Notice(`${format.toUpperCase()} copied to clipboard`);
// 	}

// 	private generateCSV(): string {
// 		const headers = this.state.columns.map(col => col.name);
// 		const lines = [headers.join(',')];
		
// 		this.state.rows.forEach(row => {
// 			const cells = this.state.columns.map(col => {
// 				const key = col.type === 'dice' ? 'range' : col.name;
// 				const value = row[key] || '';
// 				// Escape commas and quotes
// 				return value.includes(',') || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value;
// 			});
// 			lines.push(cells.join(','));
// 		});
		
// 		return lines.join('\n');
// 	}

// 	private generateJSON(): string {
// 		return JSON.stringify({
// 			tableName: this.state.tableName,
// 			isPrivate: this.state.isPrivate,
// 			tableReroll: this.state.tableReroll,
// 			columns: this.state.columns,
// 			rows: this.state.rows
// 		}, null, 2);
// 	}

// 	// Validation
// 	private async validate(): Promise<boolean> {
// 		const errors: string[] = [];
		
// 		// Validate table name
// 		if (!this.state.tableName.trim()) {
// 			errors.push('Table name cannot be empty');
// 		}
		
// 		// Validate reroll references
// 		if (this.state.tableReroll) {
// 			const valid = await this.validateRerollReference(this.state.tableReroll, true);
// 			if (!valid) {
// 				errors.push(`Invalid table-level reroll reference: ${this.state.tableReroll}`);
// 			}
// 		}

// 		// Validate row rerolls
// 		const rerollCol = this.state.columns.find(c => c.type === 'reroll');
// 		if (rerollCol) {
// 			for (const row of this.state.rows) {
// 				const rerollValue = row[rerollCol.id];
// 				if (rerollValue && rerollValue !== '—' && rerollValue !== '-') {
// 					const valid = await this.validateRerollReference(rerollValue, true);
// 					if (!valid) {
// 						errors.push(`Invalid reroll reference: ${rerollValue}`);
// 					}
// 				}
// 			}
// 		}

// 		// Validate dice ranges
// 		const diceCol = this.state.columns.find(c => c.type === 'dice');
// 		if (diceCol) {
// 			const ranges: Array<{min: number, max: number, raw: string}> = [];
			
// 			for (const row of this.state.rows) {
// 				const range = row.range;
// 				if (range) {
// 					const parsed = TableParser['parseRange'](range);
// 					if (parsed.min === 0 && parsed.max === 0) {
// 						errors.push(`Invalid range format: ${range}`);
// 					} else {
// 						ranges.push({min: parsed.min, max: parsed.max, raw: range});
// 					}
// 				}
// 			}
			
// 			// Check for duplicate or overlapping ranges
// 			for (let i = 0; i < ranges.length; i++) {
// 				for (let j = i + 1; j < ranges.length; j++) {
// 					const r1 = ranges[i];
// 					const r2 = ranges[j];
					
// 					// Check if ranges overlap
// 					if (r1.min <= r2.max && r2.min <= r1.max) {
// 						errors.push(`Duplicate or overlapping ranges: ${r1.raw} and ${r2.raw}`);
// 					}
// 				}
// 			}
			
// 			// Check if ranges cover expected dice values
// 			if (diceCol.diceNotation && ranges.length > 0) {
// 				const match = diceCol.diceNotation.match(/(\d*)d(\d+)/i);
// 				if (match) {
// 					const numDice = match[1] ? parseInt(match[1]) : 1;
// 					const sides = parseInt(match[2]);
					
// 					// For single dice (1dX), check coverage
// 					if (numDice === 1) {
// 						// Sort ranges by min value
// 						const sortedRanges = [...ranges].sort((a, b) => a.min - b.min);
						
// 						// Check if we start at 1
// 						if (sortedRanges[0].min !== 1) {
// 							errors.push(`Dice ranges should start at 1 (found: ${sortedRanges[0].min})`);
// 						}
						
// 						// Check if we end at or above the max dice value
// 						// Allow higher values to account for modifiers and "X+" notation
// 						const lastRange = sortedRanges[sortedRanges.length - 1];
// 						if (lastRange.max < sides) {
// 							errors.push(`Dice ranges should cover up to ${sides} for ${diceCol.diceNotation} (highest range ends at: ${lastRange.max})`);
// 						}
						
// 						// Check for gaps (only if no overlaps detected, since overlaps will cause false gap warnings)
// 						const hasOverlaps = ranges.some((r1, i) => 
// 							ranges.some((r2, j) => i !== j && r1.min <= r2.max && r2.min <= r1.max)
// 						);
						
// 						if (!hasOverlaps) {
// 							for (let i = 0; i < sortedRanges.length - 1; i++) {
// 								const current = sortedRanges[i];
// 								const next = sortedRanges[i + 1];
// 								if (current.max + 1 !== next.min) {
// 									errors.push(`Gap in dice ranges between ${current.raw} and ${next.raw}`);
// 								}
// 							}
// 						}
// 					}
// 				}
// 			}
// 		}
		
// 		if (errors.length > 0) {
// 			const modal = new Modal(this.app);
// 			modal.titleEl.setText('Validation Errors');
// 			modal.contentEl.createEl('p', { text: 'Please fix the following errors:' });
// 			const list = modal.contentEl.createEl('ul');
// 			errors.forEach(error => {
// 				list.createEl('li', { text: error });
// 			});
			
// 			const closeBtn = modal.contentEl.createEl('button', { text: 'OK' });
// 			closeBtn.addEventListener('click', () => modal.close());
			
// 			modal.open();
// 			return false;
// 		}
		
// 		return true;
// 	}

// 	private async validateRerollReference(reference: string, silent: boolean = false): Promise<boolean> {
// 		const tableNames = reference.split(',').map(t => t.trim()).filter(t => t);
		
// 		for (const name of tableNames) {
// 			// Handle multi-roll syntax
// 			const multiRollMatch = name.match(/^(\d*d\d+)\s+(.+)$/i);
// 			const actualTableName = multiRollMatch ? multiRollMatch[2].trim() : name;
			
// 			// Allow self-reference to the table being edited
// 			if (actualTableName === this.state.tableName) {
// 				continue;
// 			}
			
// 			try {
// 				const tableFile = this.roller.getTableFile(actualTableName);
// 				if (!tableFile) {
// 					if (!silent) {
// 						new Notice(`Table not found: ${actualTableName}`);
// 					}
// 					return false;
// 				}
// 			} catch (error) {
// 				if (!silent) {
// 					const errorMsg = error instanceof Error ? error.message : String(error);
// 					new Notice(errorMsg);
// 				}
// 				return false;
// 			}
// 		}
		
// 		return true;
// 	}

// 	// Utility
// 	private markUnsaved(): void {
// 		this.hasUnsavedChanges = true;
// 	}

// 	private applyStyles(): void {
// 		const styleEl = document.createElement('style');
// 		styleEl.textContent = `
// 			.table-builder-view {
// 				height: 100%;
// 				overflow: hidden;
// 			}
			
// 			.table-builder-split {
// 				display: flex;
// 				height: 100%;
// 				gap: 16px;
// 				padding: 16px;
// 			}
			
// 			.table-builder-left-panel {
// 				flex: 1;
// 				overflow-y: auto;
// 				padding-right: 8px;
// 			}
			
// 			.table-builder-right-panel {
// 				flex: 1;
// 				display: flex;
// 				flex-direction: column;
// 				overflow: hidden;
// 			}
			
// 			.table-builder-toolbar {
// 				display: flex;
// 				gap: 8px;
// 				margin-bottom: 16px;
// 				flex-wrap: wrap;
// 			}
			
// 			.table-builder-btn {
// 				padding: 6px 12px;
// 				border-radius: 4px;
// 				border: 1px solid var(--background-modifier-border);
// 				background: var(--interactive-normal);
// 				cursor: pointer;
// 				font-size: 13px;
// 			}
			
// 			.table-builder-btn:hover {
// 				background: var(--interactive-hover);
// 			}
			
// 			.table-builder-section {
// 				margin-bottom: 24px;
// 			}
			
// 			.table-builder-section h3 {
// 				margin: 0 0 12px 0;
// 				font-size: 14px;
// 				font-weight: 600;
// 			}
			
// 			.table-builder-section label {
// 				display: block;
// 				margin-bottom: 6px;
// 				font-size: 13px;
// 			}
			
// 			.table-builder-section input[type="text"] {
// 				width: 100%;
// 				padding: 6px 8px;
// 				border: 1px solid var(--background-modifier-border);
// 				border-radius: 4px;
// 				background: var(--background-primary);
// 			}
			
// 			.columns-list {
// 				display: flex;
// 				flex-direction: column;
// 				gap: 8px;
// 				margin-bottom: 12px;
// 			}
			
// 			.column-item {
// 				display: flex;
// 				align-items: center;
// 				gap: 8px;
// 				padding: 8px;
// 				border: 1px solid var(--background-modifier-border);
// 				border-radius: 4px;
// 				background: var(--background-secondary);
// 			}
			
// 			.drag-handle {
// 				cursor: move;
// 				color: var(--text-muted);
// 				user-select: none;
// 			}
			
// 			.column-item input {
// 				flex: 1;
// 				padding: 4px 8px;
// 				border: 1px solid var(--background-modifier-border);
// 				border-radius: 3px;
// 			}
			
// 			.column-type {
// 				font-size: 11px;
// 				color: var(--text-muted);
// 			}
			
// 			.delete-btn {
// 				padding: 2px 8px;
// 				border: none;
// 				background: var(--background-modifier-error);
// 				color: var(--text-on-accent);
// 				border-radius: 3px;
// 				cursor: pointer;
// 				font-size: 16px;
// 				line-height: 1;
// 			}
			
// 			.add-column-btns {
// 				display: flex;
// 				gap: 8px;
// 			}
			
// 			.directive-item {
// 				margin-bottom: 12px;
// 			}
			
// 			.directive-item label {
// 				display: flex;
// 				align-items: center;
// 				gap: 8px;
// 			}
			
// 			.directive-item input[type="checkbox"] {
// 				margin: 0;
// 			}
			
// 			.row-grid-header, .row-grid-row {
// 				display: grid;
// 				grid-template-columns: 40px repeat(auto-fit, minmax(100px, 1fr));
// 				gap: 4px;
// 				margin-bottom: 4px;
// 			}
			
// 			.row-grid-header {
// 				font-weight: 600;
// 				border-bottom: 2px solid var(--background-modifier-border);
// 				padding-bottom: 4px;
// 			}
			
// 			.row-number {
// 				text-align: center;
// 				padding: 6px;
// 				color: var(--text-muted);
// 				cursor: pointer;
// 			}
			
// 			.row-grid-row.selected {
// 				background: var(--background-modifier-hover);
// 			}
			
// 			.grid-cell {
// 				padding: 2px;
// 			}
			
// 			.grid-cell input {
// 				width: 100%;
// 				padding: 4px 6px;
// 				border: 1px solid var(--background-modifier-border);
// 				border-radius: 3px;
// 				background: var(--background-primary);
// 			}
			
// 			.examples-sidebar {
// 				margin-top: 24px;
// 				padding-top: 16px;
// 				border-top: 1px solid var(--background-modifier-border);
// 			}
			
// 			.examples-sidebar details {
// 				cursor: pointer;
// 			}
			
// 			.examples-content {
// 				padding: 12px 0;
// 			}
			
// 			.examples-content h4 {
// 				margin: 8px 0;
// 				font-size: 13px;
// 			}
			
// 			.example-btn {
// 				display: block;
// 				width: 100%;
// 				text-align: left;
// 				padding: 6px 12px;
// 				margin-bottom: 4px;
// 				border: 1px solid var(--background-modifier-border);
// 				border-radius: 4px;
// 				background: var(--background-secondary);
// 				cursor: pointer;
// 				font-size: 12px;
// 			}
			
// 			.example-btn:hover {
// 				background: var(--background-modifier-hover);
// 			}
			
// 			.placeholder-text {
// 				font-size: 12px;
// 				color: var(--text-muted);
// 				font-style: italic;
// 			}
			
// 			.preview-tabs {
// 				display: flex;
// 				gap: 4px;
// 				margin-bottom: 12px;
// 				border-bottom: 1px solid var(--background-modifier-border);
// 			}
			
// 			.tab-btn {
// 				padding: 8px 16px;
// 				border: none;
// 				background: transparent;
// 				cursor: pointer;
// 				border-bottom: 2px solid transparent;
// 			}
			
// 			.tab-btn.active {
// 				border-bottom-color: var(--interactive-accent);
// 			}
			
// 			.preview-container {
// 				flex: 1;
// 				overflow-y: auto;
// 				position: relative;
// 			}
			
// 			.markdown-preview, .html-preview {
// 				display: none;
// 				padding: 12px;
// 			}
			
// 			.markdown-preview.active, .html-preview.active {
// 				display: block;
// 			}
			
// 			.markdown-preview pre {
// 				background: var(--background-secondary);
// 				padding: 12px;
// 				border-radius: 4px;
// 				overflow-x: auto;
// 			}
			
// 			.markdown-preview code {
// 				font-family: var(--font-monospace);
// 				font-size: 12px;
// 				white-space: pre;
// 			}
			
// 			.preview-table {
// 				width: 100%;
// 				border-collapse: collapse;
// 			}
			
// 			.preview-table th, .preview-table td {
// 				border: 1px solid var(--background-modifier-border);
// 				padding: 8px;
// 				text-align: left;
// 			}
			
// 			.preview-table th {
// 				background: var(--background-secondary);
// 				font-weight: 600;
// 			}
			
// 			.directives-info {
// 				margin-bottom: 12px;
// 				display: flex;
// 				gap: 8px;
// 			}
			
// 			.badge {
// 				padding: 4px 8px;
// 				border-radius: 4px;
// 				background: var(--background-secondary);
// 				font-size: 11px;
// 			}
			
// 			.export-buttons {
// 				display: flex;
// 				gap: 8px;
// 				flex-wrap: wrap;
// 				padding: 12px;
// 				border-top: 1px solid var(--background-modifier-border);
// 			}
			
// 			.export-format {
// 				padding: 6px 12px;
// 				border: 1px solid var(--background-modifier-border);
// 				border-radius: 4px;
// 				background: var(--background-primary);
// 			}
// 		`;
// 		document.head.appendChild(styleEl);
// 	}
// }
