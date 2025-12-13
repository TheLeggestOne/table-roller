import { App, Modal, Notice } from 'obsidian';
import { ColumnConfig, TableState } from '../utils/TableBuilderUtils';

/**
 * Custom events dispatched by ColumnsEditor
 */
export interface ColumnAddedEvent extends CustomEvent {
	detail: {
		column: ColumnConfig;
		index: number;
	};
}

export interface ColumnRemovedEvent extends CustomEvent {
	detail: {
		columnName: string;
		index: number;
	};
}

export interface ColumnReorderedEvent extends CustomEvent {
	detail: {
		fromIndex: number;
		toIndex: number;
	};
}

export interface ColumnUpdatedEvent extends CustomEvent {
	detail: {
		index: number;
		column: ColumnConfig;
	};
}

export interface GenerateRowsRequestedEvent extends CustomEvent {
	detail: {
		diceNotation: string;
	};
}

/**
 * ColumnsEditor component - manages column configuration UI
 * 
 * Renders column list with drag-drop reordering, add/remove columns,
 * column name editing, and context menu for paste operations.
 * 
 * Dispatches CustomEvents for all user interactions.
 */
export class ColumnsEditor {
	private app: App;
	private container: HTMLElement;
	private state: TableState;
	private columnsList: HTMLElement | null = null;
	private draggedColumnIndex: number = -1;

	constructor(app: App, container: HTMLElement, initialState: TableState) {
		this.app = app;
		this.container = container;
		this.state = initialState;
	}

	/**
	 * Updates the component state and re-renders
	 */
	public updateState(newState: TableState): void {
		this.state = newState;
		this.render();
	}

	/**
	 * Renders the columns editor UI
	 */
	public render(): void {
		this.container.empty();
		
		// Columns list
		this.columnsList = this.container.createDiv({ cls: 'columns-list' });
		
		this.state.columns.forEach((col, index) => {
			this.renderColumnItem(col, index);
		});
		
		// Add column buttons
		this.renderAddButtons();
	}

	/**
	 * Renders a single column item
	 */
	private renderColumnItem(col: ColumnConfig, index: number): void {
		if (!this.columnsList) return;
		
		const colItem = this.columnsList.createDiv({ cls: 'column-item' });
		
		// Drag handle
		const dragHandle = colItem.createDiv({ cls: 'drag-handle', text: '⋮⋮' });
		dragHandle.draggable = true;
		dragHandle.addEventListener('dragstart', (e) => this.onColumnDragStart(e, index));
		dragHandle.addEventListener('dragover', (e) => this.onColumnDragOver(e));
		dragHandle.addEventListener('drop', (e) => this.onColumnDrop(e, index));
		
		// Column name input
		const nameInput = colItem.createEl('input', { 
			type: 'text', 
			value: col.name,
			placeholder: 'Column name'
		});
		
		// Disable renaming for reroll columns
		if (col.type === 'reroll') {
			nameInput.disabled = true;
			nameInput.style.opacity = '0.6';
			nameInput.style.cursor = 'not-allowed';
		}
		
		nameInput.addEventListener('input', () => {
			const updatedColumn: ColumnConfig = {
				...col,
				name: nameInput.value
			};
			
			// Update diceNotation if this is a dice column
			if (col.type === 'dice') {
				updatedColumn.diceNotation = nameInput.value;
			}
			
			this.dispatchColumnUpdated(index, updatedColumn);
		});
		
		// Column type indicator
		colItem.createSpan({ text: `(${col.type})`, cls: 'column-type' });
		
		// Generate button for dice columns
		if (col.type === 'dice' && col.diceNotation) {
			const generateBtn = colItem.createEl('button', { 
				text: 'Generate Rows...', 
				cls: 'table-builder-btn-small' 
			});
			generateBtn.style.marginLeft = '8px';
			generateBtn.addEventListener('click', () => {
				this.dispatchGenerateRowsRequested(col.diceNotation!);
			});
		}
		
		// Delete button
		if (this.state.columns.length > 1) {
			const deleteBtn = colItem.createEl('button', { text: '×', cls: 'delete-btn' });
			deleteBtn.addEventListener('click', () => this.deleteColumn(index));
		}
	}

	/**
	 * Renders add column buttons
	 */
	private renderAddButtons(): void {
		const addBtns = this.container.createDiv({ cls: 'add-column-btns' });
		
		// Only show dice column button if there isn't already one
		const hasDiceColumn = this.state.columns.some(c => c.type === 'dice');
		if (!hasDiceColumn) {
			const addDiceBtn = addBtns.createEl('button', { 
				text: '+ Dice Column', 
				cls: 'table-builder-btn' 
			});
			addDiceBtn.addEventListener('click', () => this.showAddDiceColumnModal());
		}
		
		const addRegularBtn = addBtns.createEl('button', { 
			text: '+ Regular Column', 
			cls: 'table-builder-btn' 
		});
		addRegularBtn.addEventListener('click', () => this.addColumn('regular'));
		
		// Only show reroll column button if there isn't already one
		const hasRerollColumn = this.state.columns.some(c => c.type === 'reroll');
		if (!hasRerollColumn) {
			const addRerollBtn = addBtns.createEl('button', { 
				text: '+ Reroll Column', 
				cls: 'table-builder-btn' 
			});
			addRerollBtn.addEventListener('click', () => this.addColumn('reroll'));
		}
	}

	/**
	 * Shows modal for adding a dice column
	 */
	private showAddDiceColumnModal(): void {
		// Check if dice column already exists
		if (this.state.columns.some(c => c.type === 'dice')) {
			new Notice('Only one dice column is allowed');
			return;
		}
		
		const modal = new Modal(this.app);
		modal.titleEl.setText('Add Dice Column');
		
		modal.contentEl.createEl('label', { text: 'Select dice type:' });
		const select = modal.contentEl.createEl('select');
		select.style.width = '100%';
		select.style.padding = '8px';
		select.style.marginTop = '8px';
		select.style.marginBottom = '12px';
		
		const diceOptions = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100', 'custom'];
		diceOptions.forEach(dice => {
			select.createEl('option', { 
				text: dice === 'custom' ? 'Custom...' : dice, 
				value: dice 
			});
		});
		
		// Custom input field (hidden by default)
		const customContainer = modal.contentEl.createDiv();
		customContainer.style.marginBottom = '12px';
		customContainer.style.display = 'none';
		
		customContainer.createEl('label', { text: 'Custom dice notation (e.g., d6, 2d6, d100):' });
		const customInput = customContainer.createEl('input', {
			type: 'text',
			placeholder: 'd6'
		});
		customInput.style.width = '100%';
		customInput.style.padding = '8px';
		customInput.style.marginTop = '4px';
		
		// Show/hide custom input based on selection
		select.addEventListener('change', () => {
			if (select.value === 'custom') {
				customContainer.style.display = 'block';
				customInput.focus();
			} else {
				customContainer.style.display = 'none';
			}
		});
		
		const btnContainer = modal.contentEl.createDiv();
		btnContainer.style.display = 'flex';
		btnContainer.style.justifyContent = 'flex-end';
		btnContainer.style.gap = '8px';
		
		const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => modal.close());
		
		const addBtn = btnContainer.createEl('button', { text: 'Add' });
		addBtn.addEventListener('click', () => {
			let diceType = select.value;
			
			// If custom, validate and use custom input
			if (diceType === 'custom') {
				diceType = customInput.value.trim().toLowerCase();
				if (!diceType) {
					new Notice('Please enter a dice notation');
					return;
				}
				// Validate dice notation format
				if (!/^\d*d\d+$/.test(diceType)) {
					new Notice('Invalid dice notation. Use format like: d6, 2d6, d100');
					return;
				}
			}
			
			// Insert dice column at the beginning
			const newColumn: ColumnConfig = {
				name: diceType,
				type: 'dice',
				diceNotation: diceType
			};
			
			this.dispatchColumnAdded(newColumn, 0);
			modal.close();
		});
		
		modal.open();
	}

	/**
	 * Adds a regular or reroll column
	 */
	private addColumn(type: 'regular' | 'reroll'): void {
		// Only allow one reroll column
		if (type === 'reroll' && this.state.columns.some(c => c.type === 'reroll')) {
			new Notice('Only one reroll column is allowed');
			return;
		}
		
		const name = type === 'reroll' ? 'reroll' : `Column ${this.state.columns.length}`;
		const newColumn: ColumnConfig = { name, type };
		
		this.dispatchColumnAdded(newColumn, this.state.columns.length);
	}

	/**
	 * Deletes a column
	 */
	private deleteColumn(index: number): void {
		if (this.state.columns.length <= 1) {
			new Notice('Cannot delete the last column');
			return;
		}
		
		const col = this.state.columns[index];
		this.dispatchColumnRemoved(col.name, index);
	}

	// Drag and drop handlers
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
		
		this.dispatchColumnReordered(this.draggedColumnIndex, targetIndex);
		this.draggedColumnIndex = -1;
	}

	// Event dispatchers
	private dispatchColumnAdded(column: ColumnConfig, index: number): void {
		const event = new CustomEvent('column-added', {
			detail: { column, index },
			bubbles: true
		});
		this.container.dispatchEvent(event);
	}

	private dispatchColumnRemoved(columnName: string, index: number): void {
		const event = new CustomEvent('column-removed', {
			detail: { columnName, index },
			bubbles: true
		});
		this.container.dispatchEvent(event);
	}

	private dispatchColumnReordered(fromIndex: number, toIndex: number): void {
		const event = new CustomEvent('column-reordered', {
			detail: { fromIndex, toIndex },
			bubbles: true
		});
		this.container.dispatchEvent(event);
	}

	private dispatchColumnUpdated(index: number, column: ColumnConfig): void {
		const event = new CustomEvent('column-updated', {
			detail: { index, column },
			bubbles: true
		});
		this.container.dispatchEvent(event);
	}

	private dispatchGenerateRowsRequested(diceNotation: string): void {
		const event = new CustomEvent('generate-rows-requested', {
			detail: { diceNotation },
			bubbles: true
		});
		this.container.dispatchEvent(event);
	}

	/**
	 * Cleanup method to remove event listeners
	 */
	public destroy(): void {
		this.container.empty();
		this.columnsList = null;
	}
}
