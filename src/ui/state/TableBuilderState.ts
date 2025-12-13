/**
 * State management and history system for TableBuilder
 * Manages state snapshots, undo/redo operations, and state change notifications
 */

import { TableState, deepClone } from '../utils/TableBuilderUtils';

/**
 * History entry containing a state snapshot and timestamp
 */
interface HistoryEntry {
	state: TableState;
	timestamp: number;
}

/**
 * Event detail for state change notifications
 */
export interface StateChangeEvent extends CustomEvent {
	detail: TableState;
}

/**
 * StateManager class manages table state with history and undo/redo capabilities
 * 
 * Features:
 * - Immutable state updates
 * - History stack with configurable max size
 * - Undo/redo operations
 * - State change event notifications
 * - Deep cloning for state snapshots
 */
export class StateManager extends EventTarget {
	private currentState: TableState;
	private history: HistoryEntry[] = [];
	private historyIndex: number = -1;
	private readonly MAX_HISTORY = 50;

	/**
	 * Creates a new StateManager with the given initial state
	 * @param initialState - The initial table state
	 */
	constructor(initialState: TableState) {
		super();
		this.currentState = deepClone(initialState);
		// Initialize history with the initial state
		this.captureState();
	}

	/**
	 * Captures the current state to the history stack
	 * Removes any forward history if we're not at the end
	 * Maintains history size limit
	 */
	captureState(): void {
		// Remove any states after current index (if we've undone)
		if (this.historyIndex < this.history.length - 1) {
			this.history = this.history.slice(0, this.historyIndex + 1);
		}
		
		// Add new state snapshot
		const stateCopy = deepClone(this.currentState);
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

	/**
	 * Undoes the last state change
	 * Returns true if undo was successful, false if at beginning of history
	 */
	undo(): boolean {
		if (!this.canUndo()) {
			return false;
		}

		this.historyIndex--;
		this.currentState = deepClone(this.history[this.historyIndex].state);
		this.dispatchStateChange();
		return true;
	}

	/**
	 * Redoes the previously undone state change
	 * Returns true if redo was successful, false if at end of history
	 */
	redo(): boolean {
		if (!this.canRedo()) {
			return false;
		}

		this.historyIndex++;
		this.currentState = deepClone(this.history[this.historyIndex].state);
		this.dispatchStateChange();
		return true;
	}

	/**
	 * Gets the current state
	 * Returns a deep clone to prevent external mutations
	 */
	getState(): TableState {
		return deepClone(this.currentState);
	}

	/**
	 * Sets a new state and captures it to history
	 * @param newState - The new state to set
	 * @param captureHistory - Whether to capture this change in history (default: true)
	 */
	setState(newState: TableState, captureHistory: boolean = true): void {
		this.currentState = deepClone(newState);
		
		if (captureHistory) {
			this.captureState();
		}
		
		this.dispatchStateChange();
	}

	/**
	 * Checks if undo operation is available
	 * @returns True if there are states to undo to
	 */
	canUndo(): boolean {
		return this.historyIndex > 0;
	}

	/**
	 * Checks if redo operation is available
	 * @returns True if there are states to redo to
	 */
	canRedo(): boolean {
		return this.historyIndex < this.history.length - 1;
	}

	/**
	 * Gets the number of available undo operations
	 */
	getUndoCount(): number {
		return this.historyIndex;
	}

	/**
	 * Gets the number of available redo operations
	 */
	getRedoCount(): number {
		return this.history.length - 1 - this.historyIndex;
	}

	/**
	 * Clears all history and resets to the current state
	 */
	clearHistory(): void {
		this.history = [];
		this.historyIndex = -1;
		this.captureState();
	}

	/**
	 * Dispatches a custom event notifying listeners of state changes
	 * Event name: 'state-changed'
	 * Event detail: Current table state
	 */
	private dispatchStateChange(): void {
		const event = new CustomEvent('state-changed', {
			detail: deepClone(this.currentState)
		});
		this.dispatchEvent(event);
	}

	/**
	 * Updates the current state without capturing to history
	 * Useful for temporary state changes or during initialization
	 * @param newState - The new state to set
	 */
	updateStateWithoutHistory(newState: TableState): void {
		this.currentState = deepClone(newState);
		this.dispatchStateChange();
	}

	/**
	 * Gets the current history index
	 * Useful for debugging or displaying history position
	 */
	getHistoryIndex(): number {
		return this.historyIndex;
	}

	/**
	 * Gets the total history length
	 * Useful for debugging or displaying history information
	 */
	getHistoryLength(): number {
		return this.history.length;
	}
}
