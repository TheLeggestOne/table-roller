import { Notice } from 'obsidian';
import { ColumnConfig, RowData, TableState } from '../utils/TableBuilderUtils';

/**
 * Custom events dispatched by RowGridEditor
 */
export interface RowAddedEvent extends CustomEvent {
	detail: {
		index: number;
	};
}

export interface RowDuplicatedEvent extends CustomEvent {
	detail: {
		sourceIndex: number;
		newIndex: number;
	};
}

export interface RowDeletedEvent extends CustomEvent {
	detail: {
		index: number;
	};
}

export interface RowUpdatedEvent extends CustomEvent {
	detail: {
		rowIndex: number;
		columnKey: string;
		value: string;
	};
}

export interface RowSelectionChangedEvent extends CustomEvent {
	detail: {
		rowIndex: number;
	};
}

export interface ColumnPasteRequestedEvent extends CustomEvent {
	detail: {
		columnIndex: number;
		clientX: number;
		clientY: number;
	};
}

/**
 * RowGridEditor component - manages row data grid UI
 * 
 * Renders grid with editable cells, row add/duplicate/delete actions,
 * keyboard navigation (Tab, Enter), row selection, and column paste context menu.
 * 
 * Dispatches CustomEvents for all user interactions.
 */
export class RowGridEditor {
	private container: HTMLElement;
	private state: TableState;
	private selectedRowIndex: number = 0;
	private activeContextMenu: HTMLElement | null = null;
	private activeMenuCloseListener: ((event: MouseEvent) => void) | null = null;

	constructor(container: HTMLElement, initialState: TableState) {
		this.container = container;
		this.state = initialState;
	}

	/**
	 * Updates the component state and re-renders
	 */
	public updateState(newState: TableState, selectedRowIndex?: number): void {
		this.state = newState;
		if (selectedRowIndex !== undefined) {
			this.selectedRowIndex = selectedRowIndex;
		}
		this.render();
	}

	/**
	 * Gets the currently selected row index
	 */
	public getSelectedRowIndex(): number {
		return this.selectedRowIndex;
	}

	/**
	 * Renders the row grid UI
	 */
	public render(): void {
		this.container.empty();
		
		if (this.state.rows.length === 0) {
			this.container.createDiv({ 
				text: 'No rows yet. Click "+ Add Row" to start.',
				cls: 'empty-state' 
			});
			return;
		}
		
		// Header row
		this.renderHeaderRow();
		
		// Data rows
		this.state.rows.forEach((row, rowIndex) => {
			this.renderDataRow(row, rowIndex);
		});
	}

	/**
	 * Renders the header row with column names
	 */
	private renderHeaderRow(): void {
		const headerRow = this.container.createDiv({ cls: 'row-grid-header' });
		headerRow.createDiv({ text: '', cls: 'row-number' }); // Empty cell for row numbers
		
		this.state.columns.forEach((col, colIndex) => {
			const headerCell = headerRow.createDiv({ text: col.name, cls: 'grid-cell' });
			
			// Add right-click context menu for paste
			headerCell.addEventListener('contextmenu', (e) => {
				e.preventDefault();
				this.dispatchColumnPasteRequested(colIndex, e.clientX, e.clientY);
			});
			
			// Make it clear it's interactive
			headerCell.style.cursor = 'context-menu';
		});
		
		// Empty space for action buttons column
		headerRow.createDiv({ cls: 'row-actions' });
	}

	/**
	 * Renders a single data row
	 */
	private renderDataRow(row: RowData, rowIndex: number): void {
		const rowEl = this.container.createDiv({ cls: 'row-grid-row' });
		if (rowIndex === this.selectedRowIndex) {
			rowEl.addClass('selected');
		}
		
		// Row number
		const rowNum = rowEl.createDiv({ text: `${rowIndex + 1}`, cls: 'row-number' });
		rowNum.addEventListener('click', () => {
			this.selectedRowIndex = rowIndex;
			this.updateRowSelection();
			this.dispatchRowSelectionChanged(rowIndex);
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
				// Update selection when focusing on a cell
				if (this.selectedRowIndex !== rowIndex) {
					this.selectedRowIndex = rowIndex;
					this.updateRowSelection();
					this.dispatchRowSelectionChanged(rowIndex);
				}
			});
			
			input.addEventListener('input', () => {
				this.dispatchRowUpdated(rowIndex, cellKey, input.value);
			});
			
			// Keyboard navigation
			input.addEventListener('keydown', (e) => {
				this.handleCellKeydown(e, rowIndex, colIndex);
			});
		});
		
		// Action buttons container
		const actionsCell = rowEl.createDiv({ cls: 'row-actions' });
		
		// Duplicate button
		const duplicateBtn = actionsCell.createEl('button', { 
			text: '📋',
			cls: 'row-action-btn',
			attr: { 'aria-label': 'Duplicate row', 'title': 'Duplicate row' }
		});
		duplicateBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.dispatchRowDuplicated(rowIndex, rowIndex + 1);
		});
		
		// Delete button
		const deleteBtn = actionsCell.createEl('button', { 
			text: '✕',
			cls: 'row-action-btn row-delete-btn',
			attr: { 'aria-label': 'Delete row', 'title': 'Delete row' }
		});
		deleteBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.dispatchRowDeleted(rowIndex);
		});
	}

	/**
	 * Handles keyboard navigation in grid cells
	 */
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
			this.dispatchRowSelectionChanged(newRow);
			
			// Focus the new cell
			setTimeout(() => {
				const rowEls = this.container.querySelectorAll('.row-grid-row');
				const rowEl = rowEls[newRow] as HTMLElement;
				if (rowEl) {
					const inputs = rowEl.querySelectorAll('input');
					const input = inputs[newCol] as HTMLInputElement;
					if (input) {
						input.focus();
						input.select();
					}
				}
			}, 0);
		}
	}

	/**
	 * Updates row selection visuals without rebuilding
	 */
	private updateRowSelection(): void {
		const rowEls = this.container.querySelectorAll('.row-grid-row');
		rowEls.forEach((el, idx) => {
			if (idx === this.selectedRowIndex) {
				el.addClass('selected');
			} else {
				el.removeClass('selected');
			}
		});
	}

	// Event dispatchers
	private dispatchRowAdded(index: number): void {
		const event = new CustomEvent('row-added', {
			detail: { index },
			bubbles: true
		});
		this.container.dispatchEvent(event);
	}

	private dispatchRowDuplicated(sourceIndex: number, newIndex: number): void {
		const event = new CustomEvent('row-duplicated', {
			detail: { sourceIndex, newIndex },
			bubbles: true
		});
		this.container.dispatchEvent(event);
	}

	private dispatchRowDeleted(index: number): void {
		const event = new CustomEvent('row-deleted', {
			detail: { index },
			bubbles: true
		});
		this.container.dispatchEvent(event);
	}

	private dispatchRowUpdated(rowIndex: number, columnKey: string, value: string): void {
		const event = new CustomEvent('row-updated', {
			detail: { rowIndex, columnKey, value },
			bubbles: true
		});
		this.container.dispatchEvent(event);
	}

	private dispatchRowSelectionChanged(rowIndex: number): void {
		const event = new CustomEvent('row-selection-changed', {
			detail: { rowIndex },
			bubbles: true
		});
		this.container.dispatchEvent(event);
	}

	private dispatchColumnPasteRequested(columnIndex: number, clientX: number, clientY: number): void {
		const event = new CustomEvent('column-paste-requested', {
			detail: { columnIndex, clientX, clientY },
			bubbles: true
		});
		this.container.dispatchEvent(event);
	}

	/**
	 * Cleanup method to remove event listeners
	 */
	public destroy(): void {
		// Clean up active context menu and event listeners
		if (this.activeContextMenu && this.activeContextMenu.parentNode) {
			try {
				this.activeContextMenu.parentNode.removeChild(this.activeContextMenu);
			} catch (e) {
				// Ignore if already removed
			}
		}
		
		if (this.activeMenuCloseListener) {
			document.removeEventListener('click', this.activeMenuCloseListener);
			this.activeMenuCloseListener = null;
		}
		
		this.container.empty();
	}
}
