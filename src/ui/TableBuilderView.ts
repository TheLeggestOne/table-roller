import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { TableRollerCore } from '../services/TableRollerCore';
import { TableParser } from '../services/TableParser';
import { StateManager } from './state/TableBuilderState';
import { TableIO } from './io/TableBuilderIO';
import { TableValidator } from './validation/TableBuilderValidation';
import { ColumnsEditor } from './components/ColumnsEditor';
import { RowGridEditor } from './components/RowGridEditor';
import { PreviewPanel } from './components/PreviewPanel';
import {
	DiceColumnModal,
	GenerateRowsModal,
	ConfirmModal,
	SaveToNewFileModal,
	FileSelectionModal
} from './modals/TableBuilderModals';
import { TableState, ColumnConfig, generateDefaultRows } from './utils/TableBuilderUtils';

export const VIEW_TYPE_TABLE_BUILDER = 'table-builder';

/**
 * Gets the default state for a new table
 */
function getDefaultState(): TableState {
	return {
		tableName: 'New Table',
		columns: [
			{ name: 'd6', type: 'dice', diceNotation: 'd6' },
			{ name: 'Result', type: 'regular' }
		],
		rows: generateDefaultRows('d6', 6),
		isPrivate: false
	};
}

/**
 * TableBuilderView - Orchestrator for the table builder UI
 * 
 * Responsibilities:
 * - Lifecycle management (onOpen, onClose)
 * - Component instantiation and coordination
 * - Event listening and state propagation
 * - View metadata (type, display text, icon)
 * 
 * Delegates to:
 * - StateManager: state management, history, undo/redo
 * - TableIO: file operations (save, load, export, import)
 * - TableValidator: validation logic
 * - ColumnsEditor: column configuration UI
 * - RowGridEditor: row data grid UI
 * - PreviewPanel: preview and export UI
 * - Modals: modal dialogs
 * - TableBuilderUtils: utility functions
 */
export class TableBuilderView extends ItemView {
	private roller: TableRollerCore;
	
	// State and services
	private stateManager: StateManager;
	private tableIO: TableIO;
	private validator: TableValidator;
	private parser: TableParser;
	
	// UI components
	private columnsEditor: ColumnsEditor | null = null;
	private rowGridEditor: RowGridEditor | null = null;
	private previewPanel: PreviewPanel | null = null;
	
	// UI containers
	private leftPanel: HTMLElement | null = null;
	private rightPanel: HTMLElement | null = null;
	private tableNameInput: HTMLInputElement | null = null;
	
	// State flags
	private hasUnsavedChanges: boolean = false;
	private currentFile: TFile | null = null;
	private previewDebounceTimer: NodeJS.Timeout | null = null;

	constructor(leaf: WorkspaceLeaf, roller: TableRollerCore) {
		super(leaf);
		this.roller = roller;
		this.parser = new TableParser();
		
		// Initialize state manager with default state
		this.stateManager = new StateManager(getDefaultState());
		
		// Initialize table I/O
		this.tableIO = new TableIO(this.app, this.currentFile, this.parser);
		
		// Initialize validator
		this.validator = new TableValidator(this.roller);
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

		// Build UI
		this.buildLeftPanel();
		this.buildRightPanel();
		
		// Setup event listeners for state changes
		this.setupEventListeners();
	}

	async onClose(): Promise<void> {
		// Check for unsaved changes
		if (this.hasUnsavedChanges) {
			console.warn('TableBuilder: Closing with unsaved changes');
		}
		
		// Cleanup components
		this.columnsEditor = null;
		this.rowGridEditor = null;
		this.previewPanel = null;
		
		// Clear debounce timer
		if (this.previewDebounceTimer) {
			clearTimeout(this.previewDebounceTimer);
			this.previewDebounceTimer = null;
		}
	}

	/**
	 * Builds the left panel with toolbar, table name, columns, directives, and rows
	 */
	private buildLeftPanel(): void {
		if (!this.leftPanel) return;
		
		// Toolbar
		const toolbar = this.leftPanel.createDiv({ cls: 'table-builder-toolbar' });
		this.buildToolbar(toolbar);
		
		// Table name section
		const nameSection = this.leftPanel.createDiv({ cls: 'table-builder-section' });
		nameSection.createEl('label', { text: 'Table Name:' });
		this.tableNameInput = nameSection.createEl('input', { 
			type: 'text', 
			value: this.stateManager.getState().tableName,
			cls: 'table-builder-input'
		});
		this.tableNameInput.addEventListener('input', () => this.handleTableNameChange());
		
		// Columns section
		const columnsSection = this.leftPanel.createDiv({ cls: 'table-builder-section' });
		columnsSection.createEl('h3', { text: 'Columns' });
		const columnsContainer = columnsSection.createDiv();
		this.columnsEditor = new ColumnsEditor(this.app, columnsContainer, this.stateManager.getState());
		this.columnsEditor.render();
		
		// Directives section
		const directivesSection = this.leftPanel.createDiv({ cls: 'table-builder-section' });
		directivesSection.createEl('h3', { text: 'Directives' });
		this.buildDirectivesEditor(directivesSection);
		
		// Rows section
		const rowsSection = this.leftPanel.createDiv({ cls: 'table-builder-section' });
		rowsSection.createEl('h3', { text: 'Rows' });
		const rowsContainer = rowsSection.createDiv();
		this.rowGridEditor = new RowGridEditor(rowsContainer, this.stateManager.getState());
		this.rowGridEditor.render();
		
		// Add row button
		const addRowBtn = rowsSection.createEl('button', { 
			text: '+ Add Row', 
			cls: 'table-builder-btn' 
		});
		addRowBtn.addEventListener('click', () => this.handleAddRow());
	}

	/**
	 * Builds the toolbar with undo/redo and bulk operations
	 */
	private buildToolbar(toolbar: HTMLElement): void {
		// New Table button
		const newTableBtn = toolbar.createEl('button', { text: 'New Table', cls: 'table-builder-btn' });
		newTableBtn.addEventListener('click', () => this.handleNewTable());
		
		// Undo button
		const undoButton = toolbar.createEl('button', { text: 'Undo', cls: 'table-builder-btn' });
		undoButton.addEventListener('click', () => this.handleUndo());
		
		// Redo button
		const redoButton = toolbar.createEl('button', { text: 'Redo', cls: 'table-builder-btn' });
		redoButton.addEventListener('click', () => this.handleRedo());
		
		// Clear results button
		const clearResultsBtn = toolbar.createEl('button', { 
			text: 'Clear Results', 
			cls: 'table-builder-btn' 
		});
		clearResultsBtn.addEventListener('click', () => this.handleClearResults());
		
		// Delete all rows button
		const deleteAllBtn = toolbar.createEl('button', { 
			text: 'Delete All Rows', 
			cls: 'table-builder-btn' 
		});
		deleteAllBtn.addEventListener('click', () => this.handleDeleteAllRows());
	}

	/**
	 * Builds the directives editor (isPrivate and tableReroll)
	 */
	private buildDirectivesEditor(container: HTMLElement): void {
		const state = this.stateManager.getState();
		
		// Private checkbox
		const privateContainer = container.createDiv({ cls: 'directive-item' });
		const privateCheckbox = privateContainer.createEl('input', { 
			type: 'checkbox',
			cls: 'table-builder-checkbox'
		});
		privateCheckbox.checked = state.isPrivate;
		privateCheckbox.addEventListener('change', () => this.handlePrivateChange(privateCheckbox.checked));
		privateContainer.createEl('label', { text: 'Private (hidden from table picker)' });
		
		// Table reroll
		const rerollContainer = container.createDiv({ cls: 'directive-item' });
		rerollContainer.createEl('label', { text: 'Table Reroll:' });
		const rerollInput = rerollContainer.createEl('input', { 
			type: 'text',
			value: state.tableReroll || '',
			placeholder: 'e.g., TableName',
			cls: 'table-builder-input'
		});
		rerollInput.addEventListener('input', () => this.handleTableRerollChange(rerollInput.value));
	}

	/**
	 * Builds the right panel with preview and export
	 */
	private buildRightPanel(): void {
		if (!this.rightPanel) return;
		
		this.previewPanel = new PreviewPanel(this.rightPanel, this.stateManager.getState());
		this.previewPanel.render();
	}

	/**
	 * Sets up event listeners for all components
	 */
	private setupEventListeners(): void {
		// Listen to StateManager state changes
		this.stateManager.addEventListener('state-changed', ((e: CustomEvent) => {
			this.handleStateChange(e.detail);
		}) as EventListener);
		
		// Listen to TableIO events
		this.tableIO.addEventListener('file-saved', ((e: CustomEvent) => {
			this.handleFileSaved(e.detail);
		}) as EventListener);
		
		this.tableIO.addEventListener('file-loaded', ((e: CustomEvent) => {
			this.handleFileLoaded(e.detail);
		}) as EventListener);
		
		// Listen to PreviewPanel events (they bubble from rightPanel)
		if (this.rightPanel) {
			this.rightPanel.addEventListener('load-requested', () => {
				this.tableIO.load();
			});
			
			this.rightPanel.addEventListener('save-requested', ((e: CustomEvent) => {
				// Ensure TableIO has latest state before saving
				this.tableIO.setState(this.stateManager.getState());
				if (e.detail.saveAs) {
					this.tableIO.saveAs();
				} else {
					this.tableIO.save();
				}
			}) as EventListener);
			
			this.rightPanel.addEventListener('export-requested', ((e: CustomEvent) => {
				// Ensure TableIO has latest state before exporting
				this.tableIO.setState(this.stateManager.getState());
				this.tableIO.exportAs(e.detail.format);
			}) as EventListener);
			
			this.rightPanel.addEventListener('copy-to-clipboard', () => {
				// Ensure TableIO has latest state before copying
				this.tableIO.setState(this.stateManager.getState());
				this.tableIO.copyToClipboard();
			});
			
			this.rightPanel.addEventListener('import-from-clipboard', () => {
				this.tableIO.importFromClipboard();
			});
		}
	}

	// ==================== Event Handlers ====================

	/**
	 * Handles state changes from StateManager
	 */
	private handleStateChange(state: TableState): void {
		// Keep TableIO in sync with latest state
		this.tableIO.setState(state);
		
		// Update all components with new state
		if (this.columnsEditor) {
			this.columnsEditor.updateState(state);
		}
		if (this.rowGridEditor) {
			const selectedRowIndex = this.rowGridEditor.getSelectedRowIndex();
			this.rowGridEditor.updateState(state, selectedRowIndex);
		}
		if (this.previewPanel) {
			this.previewPanel.updateState(state);
		}
		if (this.tableNameInput) {
			this.tableNameInput.value = state.tableName;
		}
		
		// Schedule preview update
		this.schedulePreviewUpdate();
	}

	/**
	 * Handles table name changes
	 */
	private handleTableNameChange(): void {
		if (!this.tableNameInput) return;
		
		const currentState = this.stateManager.getState();
		const newState = {
			...currentState,
			tableName: this.tableNameInput.value
		};
		this.stateManager.setState(newState);
		this.markUnsaved();
	}

	/**
	 * Handles private checkbox changes
	 */
	private handlePrivateChange(isPrivate: boolean): void {
		const currentState = this.stateManager.getState();
		const newState = {
			...currentState,
			isPrivate
		};
		this.stateManager.setState(newState);
		this.markUnsaved();
	}

	/**
	 * Handles table reroll input changes
	 */
	private handleTableRerollChange(tableReroll: string): void {
		const currentState = this.stateManager.getState();
		const newState = {
			...currentState,
			tableReroll: tableReroll || undefined
		};
		this.stateManager.setState(newState);
		this.markUnsaved();
	}

	/**
	 * Handles new table button click - resets to default state
	 */
	private handleNewTable(): void {
		if (this.hasUnsavedChanges) {
			// Confirm before resetting if there are unsaved changes
			const modal = new ConfirmModal(
				this.app,
				'Create New Table?',
				'You have unsaved changes. Creating a new table will discard them. Continue?',
				() => this.resetToDefaultState(),
				{ isDangerous: true }
			);
			modal.open();
		} else {
			this.resetToDefaultState();
		}
	}

	/**
	 * Resets the table to default state
	 */
	private resetToDefaultState(): void {
		const defaultState = getDefaultState();
		this.stateManager.setState(defaultState);
		this.currentFile = null;
		this.tableIO.setCurrentFile(null);
		this.hasUnsavedChanges = false;
		this.leaf.setViewState({ ...this.leaf.getViewState() });
		new Notice('Created new table');
	}

	/**
	 * Handles undo button click
	 */
	private handleUndo(): void {
		if (this.stateManager.canUndo()) {
			this.stateManager.undo();
			this.markUnsaved();
		} else {
			new Notice('Nothing to undo');
		}
	}

	/**
	 * Handles redo button click
	 */
	private handleRedo(): void {
		if (this.stateManager.canRedo()) {
			this.stateManager.redo();
			this.markUnsaved();
		} else {
			new Notice('Nothing to redo');
		}
	}

	/**
	 * Handles clear results button click
	 */
	private handleClearResults(): void {
		const currentState = this.stateManager.getState();
		const newRows = currentState.rows.map(row => {
			const newRow = { ...row };
			currentState.columns.forEach(col => {
				if (col.type === 'regular') {
					newRow[col.name] = '';
				}
			});
			return newRow;
		});
		
		const newState = {
			...currentState,
			rows: newRows
		};
		this.stateManager.setState(newState);
		this.markUnsaved();
	}

	/**
	 * Handles delete all rows button click
	 */
	private async handleDeleteAllRows(): Promise<void> {
		const confirmed = await new Promise<boolean>((resolve) => {
			const modal = new ConfirmModal(
				this.app,
				'Delete All Rows?',
				'This will delete all rows. Do you want to proceed?',
				() => resolve(true)
			);
			modal.open();
		});
		
		if (confirmed) {
			const currentState = this.stateManager.getState();
			const newState = {
				...currentState,
				rows: []
			};
			this.stateManager.setState(newState);
			this.markUnsaved();
		}
	}

	/**
	 * Handles add row button click
	 */
	private handleAddRow(): void {
		const currentState = this.stateManager.getState();
		const newRow = {};
		const newState = {
			...currentState,
			rows: [...currentState.rows, newRow]
		};
		this.stateManager.setState(newState);
		this.markUnsaved();
	}

	/**
	 * Handles file saved event from TableIO
	 */
	private handleFileSaved(detail: { file: TFile; tableName: string }): void {
		new Notice(`Saved ${detail.tableName}`);
		this.currentFile = detail.file;
		this.hasUnsavedChanges = false;
		this.leaf.setViewState({ ...this.leaf.getViewState() });
	}

	/**
	 * Handles file loaded event from TableIO
	 */
	private handleFileLoaded(detail: { file: TFile; tableName: string; state: TableState }): void {
		this.stateManager.setState(detail.state);
		this.currentFile = detail.file;
		this.hasUnsavedChanges = false;
		this.leaf.setViewState({ ...this.leaf.getViewState() });
	}

	// ==================== Helper Methods ====================

	/**
	 * Marks the view as having unsaved changes
	 */
	private markUnsaved(): void {
		this.hasUnsavedChanges = true;
		this.leaf.setViewState({ ...this.leaf.getViewState() });
	}

	/**
	 * Schedules a preview update with debouncing
	 */
	private schedulePreviewUpdate(): void {
		if (this.previewDebounceTimer) {
			clearTimeout(this.previewDebounceTimer);
		}
		
		this.previewDebounceTimer = setTimeout(() => {
			if (this.previewPanel) {
				this.previewPanel.updateState(this.stateManager.getState());
			}
			this.previewDebounceTimer = null;
		}, 300);
	}
}
