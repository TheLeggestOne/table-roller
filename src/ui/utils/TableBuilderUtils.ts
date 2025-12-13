/**
 * Utility functions for TableBuilder
 * Pure functions with no side effects for state management and formatting
 */

/**
 * Configuration for a column in the table builder
 */
export interface ColumnConfig {
	name: string;
	type: 'dice' | 'regular' | 'reroll';
	diceNotation?: string; // e.g., 'd6', '2d6', 'd100'
}

/**
 * Data for a single row in the table
 */
export interface RowData {
	range?: string; // For dice columns
	[columnName: string]: string | undefined;
}

/**
 * Complete state of a table being built
 */
export interface TableState {
	tableName: string;
	columns: ColumnConfig[];
	rows: RowData[];
	isPrivate: boolean;
	tableReroll?: string;
}

/**
 * Options for generating default rows
 */
export interface GenerateRowsOptions {
	diceNotation: string;
	count: number;
	groupSize?: number;
	remainder?: 'expand-first' | 'expand-last' | 'row-first' | 'row-last';
}

/**
 * Generates default rows for a dice column
 * 
 * @param diceNotation - The dice notation (e.g., 'd6', '2d6', 'd100')
 * @param count - Number of rows to generate
 * @param groupSize - Optional number of dice values to group per row
 * @param remainder - How to handle remainder values when grouping
 * @returns Array of row data with appropriate ranges
 */
export function generateDefaultRows(
	diceNotation: string,
	count: number,
	groupSize?: number,
	remainder?: 'expand-first' | 'expand-last' | 'row-first' | 'row-last'
): RowData[] {
	const rows: RowData[] = [];

	// Parse dice notation
	const match = diceNotation.match(/^(\d*)d(\d+)$/i);
	if (!match) return rows;

	const numDice = match[1] ? parseInt(match[1]) : 1;
	const sides = parseInt(match[2]);

	// Calculate min and max for the dice notation
	const minValue = numDice; // minimum is n (e.g., 2d4 = 2)
	const maxValue = numDice * sides; // maximum is n * sides (e.g., 2d4 = 8)

	const totalRange = maxValue - minValue + 1;

	// If groupSize is specified, create ranges with that many values per row
	if (groupSize && groupSize >= 2) {
		const extraValues = totalRange % groupSize; // remainder
		let currentValue = minValue;

		// Default remainder handling if not specified
		const remainderStrategy = remainder || 'expand-last';

		// Handle 'row-first' - create a small row at the beginning
		if (remainderStrategy === 'row-first' && extraValues > 0) {
			const end = minValue + extraValues - 1;
			if (minValue === end) {
				rows.push({ range: `${minValue}` });
			} else {
				rows.push({ range: `${minValue}-${end}` });
			}
			currentValue = end + 1;
		}

		// Create the main grouped rows
		const mainRowCount = Math.floor(totalRange / groupSize);
		for (let i = 0; i < mainRowCount; i++) {
			let rangeSize = groupSize;

			// Handle 'expand-first' or 'expand-last'
			if (extraValues > 0) {
				if (remainderStrategy === 'expand-first' && i === 0) {
					rangeSize = groupSize + extraValues;
				} else if (remainderStrategy === 'expand-last' && i === mainRowCount - 1) {
					rangeSize = groupSize + extraValues;
				}
			}

			const start = currentValue;
			const end = Math.min(currentValue + rangeSize - 1, maxValue);

			if (start === end) {
				rows.push({ range: `${start}` });
			} else {
				rows.push({ range: `${start}-${end}` });
			}

			currentValue = end + 1;
		}

		// Handle 'row-last' - create a small row at the end
		if (remainderStrategy === 'row-last' && extraValues > 0 && currentValue <= maxValue) {
			if (currentValue === maxValue) {
				rows.push({ range: `${maxValue}` });
			} else {
				rows.push({ range: `${currentValue}-${maxValue}` });
			}
		}
	}
	// Otherwise, calculate appropriate groupSize based on count
	else if (count < totalRange) {
		// Need to distribute totalRange values across count rows
		const calculatedGroupSize = Math.floor(totalRange / count);
		const extraValues = totalRange % count;
		let currentValue = minValue;

		for (let i = 0; i < count; i++) {
			let rangeSize = calculatedGroupSize;

			// Distribute extra values across rows (expand last row for simplicity)
			if (i === count - 1 && extraValues > 0) {
				rangeSize = calculatedGroupSize + extraValues;
			}

			const start = currentValue;
			const end = Math.min(currentValue + rangeSize - 1, maxValue);

			if (start === end) {
				rows.push({ range: `${start}` });
			} else {
				rows.push({ range: `${start}-${end}` });
			}

			currentValue = end + 1;
		}
	} else {
		// count >= totalRange, so create individual rows
		for (let i = minValue; i <= Math.min(maxValue, minValue + count - 1); i++) {
			rows.push({ range: `${i}` });
		}
	}

	return rows;
}

/**
 * Generates markdown format from table state
 * 
 * @param state - The current table state
 * @returns Markdown string representation
 */
export function generateMarkdown(state: TableState): string {
	const lines: string[] = [];

	// Frontmatter
	lines.push('---');
	lines.push('table-roller: true');
	lines.push('---');
	lines.push('');

	// Table heading
	lines.push(`# ${state.tableName}`);
	lines.push('');

	// Directives
	if (state.isPrivate) {
		lines.push('private: true');
	}
	if (state.tableReroll) {
		lines.push(`reroll: ${state.tableReroll}`);
	}
	if (state.isPrivate || state.tableReroll) {
		lines.push('');
	}

	// Table headers
	const headers = state.columns.map(col => col.name);
	lines.push('| ' + headers.join(' | ') + ' |');
	lines.push('|' + headers.map(() => '----').join('|') + '|');

	// Table rows
	state.rows.forEach(row => {
		const cells = state.columns.map(col => {
			const key = col.type === 'dice' ? 'range' : col.name;
			return row[key] || '';
		});
		lines.push('| ' + cells.join(' | ') + ' |');
	});

	return lines.join('\n');
}

/**
 * Generates CSV format from table state
 * 
 * @param state - The current table state
 * @returns CSV string representation
 */
export function generateCSV(state: TableState): string {
	const headers = state.columns.map(col => col.name);
	const lines = [headers.join(',')];

	state.rows.forEach(row => {
		const cells = state.columns.map(col => {
			const key = col.type === 'dice' ? 'range' : col.name;
			const value = row[key] || '';
			// Escape commas and quotes
			return value.includes(',') || value.includes('"')
				? `"${value.replace(/"/g, '""')}"`
				: value;
		});
		lines.push(cells.join(','));
	});

	return lines.join('\n');
}

/**
 * Generates JSON format from table state
 * 
 * @param state - The current table state
 * @returns JSON string representation
 */
export function generateJSON(state: TableState): string {
	return JSON.stringify(
		{
			tableName: state.tableName,
			isPrivate: state.isPrivate,
			tableReroll: state.tableReroll,
			columns: state.columns,
			rows: state.rows,
		},
		null,
		2
	);
}

/**
 * Creates a deep clone of an object using JSON serialization
 * Safe for plain objects but will not preserve functions, dates, etc.
 * 
 * @param obj - The object to clone
 * @returns Deep copy of the object
 */
export function deepClone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}

/**
 * Creates a new table state with updated table name
 * Immutably updates the state
 * 
 * @param state - Current table state
 * @param tableName - New table name
 * @returns New state object with updated table name
 */
export function updateTableName(state: TableState, tableName: string): TableState {
	return {
		...state,
		tableName,
	};
}

/**
 * Creates a new table state with updated private flag
 * Immutably updates the state
 * 
 * @param state - Current table state
 * @param isPrivate - New private flag value
 * @returns New state object with updated private flag
 */
export function updatePrivateFlag(state: TableState, isPrivate: boolean): TableState {
	return {
		...state,
		isPrivate,
	};
}

/**
 * Creates a new table state with updated table reroll
 * Immutably updates the state
 * 
 * @param state - Current table state
 * @param tableReroll - New table reroll value (undefined to clear)
 * @returns New state object with updated table reroll
 */
export function updateTableReroll(
	state: TableState,
	tableReroll: string | undefined
): TableState {
	return {
		...state,
		tableReroll,
	};
}

/**
 * Creates a new table state with an added column
 * Immutably updates the state
 * 
 * @param state - Current table state
 * @param column - Column to add
 * @returns New state object with added column
 */
export function addColumn(state: TableState, column: ColumnConfig): TableState {
	return {
		...state,
		columns: [...state.columns, column],
	};
}

/**
 * Creates a new table state with a column inserted at a specific position
 * Immutably updates the state
 * 
 * @param state - Current table state
 * @param column - Column to insert
 * @param index - Position to insert at (0 = beginning)
 * @returns New state object with inserted column
 */
export function insertColumn(
	state: TableState,
	column: ColumnConfig,
	index: number
): TableState {
	const columns = [...state.columns];
	columns.splice(index, 0, column);
	return {
		...state,
		columns,
	};
}

/**
 * Creates a new table state with a column removed
 * Also removes column data from all rows
 * Immutably updates the state
 * 
 * @param state - Current table state
 * @param index - Index of column to remove
 * @returns New state object with removed column
 */
export function removeColumn(state: TableState, index: number): TableState {
	const columns = [...state.columns];
	const removedColumn = columns[index];
	columns.splice(index, 1);

	// Remove data from rows
	const key = removedColumn.type === 'dice' ? 'range' : removedColumn.name;
	const rows = state.rows.map(row => {
		const newRow = { ...row };
		delete newRow[key];
		return newRow;
	});

	return {
		...state,
		columns,
		rows,
	};
}

/**
 * Creates a new table state with columns reordered
 * Immutably updates the state
 * 
 * @param state - Current table state
 * @param fromIndex - Current index of column to move
 * @param toIndex - Target index for column
 * @returns New state object with reordered columns
 */
export function reorderColumns(
	state: TableState,
	fromIndex: number,
	toIndex: number
): TableState {
	const columns = [...state.columns];
	const [moved] = columns.splice(fromIndex, 1);
	columns.splice(toIndex, 0, moved);

	return {
		...state,
		columns,
	};
}

/**
 * Creates a new table state with an added row
 * Immutably updates the state
 * 
 * @param state - Current table state
 * @param row - Row to add (defaults to empty row)
 * @returns New state object with added row
 */
export function addRow(state: TableState, row: RowData = {}): TableState {
	return {
		...state,
		rows: [...state.rows, row],
	};
}

/**
 * Creates a new table state with a row inserted at a specific position
 * Immutably updates the state
 * 
 * @param state - Current table state
 * @param row - Row to insert
 * @param index - Position to insert at
 * @returns New state object with inserted row
 */
export function insertRow(state: TableState, row: RowData, index: number): TableState {
	const rows = [...state.rows];
	rows.splice(index, 0, row);
	return {
		...state,
		rows,
	};
}

/**
 * Creates a new table state with a row removed
 * Immutably updates the state
 * 
 * @param state - Current table state
 * @param index - Index of row to remove
 * @returns New state object with removed row
 */
export function removeRow(state: TableState, index: number): TableState {
	const rows = [...state.rows];
	rows.splice(index, 1);
	return {
		...state,
		rows,
	};
}

/**
 * Creates a new table state with a duplicated row
 * Inserts the duplicate below the original
 * Immutably updates the state
 * 
 * @param state - Current table state
 * @param index - Index of row to duplicate
 * @returns New state object with duplicated row
 */
export function duplicateRow(state: TableState, index: number): TableState {
	const row = state.rows[index];
	const duplicatedRow = deepClone(row);
	return insertRow(state, duplicatedRow, index + 1);
}

/**
 * Creates a new table state with a cell value updated
 * Immutably updates the state
 * 
 * @param state - Current table state
 * @param rowIndex - Index of row to update
 * @param columnKey - Key of column to update
 * @param value - New value for the cell
 * @returns New state object with updated cell
 */
export function updateCell(
	state: TableState,
	rowIndex: number,
	columnKey: string,
	value: string
): TableState {
	const rows = [...state.rows];
	rows[rowIndex] = {
		...rows[rowIndex],
		[columnKey]: value,
	};
	return {
		...state,
		rows,
	};
}

/**
 * Creates a new table state with all regular column values cleared
 * Keeps dice ranges and reroll columns intact
 * Immutably updates the state
 * 
 * @param state - Current table state
 * @returns New state object with cleared results
 */
export function clearResults(state: TableState): TableState {
	const rows = state.rows.map(row => {
		const newRow = { ...row };
		state.columns.forEach(col => {
			if (col.type === 'regular') {
				newRow[col.name] = '';
			}
		});
		return newRow;
	});

	return {
		...state,
		rows,
	};
}

/**
 * Creates a new table state with all rows removed
 * Immutably updates the state
 * 
 * @param state - Current table state
 * @returns New state object with no rows
 */
export function clearAllRows(state: TableState): TableState {
	return {
		...state,
		rows: [],
	};
}

/**
 * Creates a new table state with rows replaced by generated defaults
 * Immutably updates the state
 * 
 * @param state - Current table state
 * @param options - Options for row generation
 * @returns New state object with generated rows
 */
export function replaceWithGeneratedRows(
	state: TableState,
	options: GenerateRowsOptions
): TableState {
	const rows = generateDefaultRows(
		options.diceNotation,
		options.count,
		options.groupSize,
		options.remainder
	);

	return {
		...state,
		rows,
	};
}

/**
 * Parses clipboard data into array of values
 * Supports comma-separated, tab-separated (Excel), and newline-separated formats
 * 
 * @param text - Clipboard text content
 * @returns Array of parsed values
 */
export function parseClipboardData(text: string): string[] {
	if (!text.trim()) {
		return [];
	}

	let values: string[];

	// Check if it's tab-separated (Excel copy)
	if (text.includes('\t')) {
		// Split by newlines first, then take first column if multiple columns
		const rows = text.split(/\r?\n/).filter(r => r.trim());
		values = rows.map(row => row.split('\t')[0].trim());
	}
	// Check if it's comma-separated
	else if (text.includes(',') && !text.includes('\n')) {
		values = text
			.split(',')
			.map(v => v.trim())
			.filter(v => v);
	}
	// Otherwise split by newlines
	else {
		values = text
			.split(/\r?\n/)
			.map(v => v.trim())
			.filter(v => v);
	}

	return values;
}

/**
 * Creates a new table state with a column filled from clipboard values
 * Will add rows if needed to accommodate all values
 * Immutably updates the state
 * 
 * @param state - Current table state
 * @param columnIndex - Index of column to fill
 * @param values - Array of values to paste
 * @returns New state object with filled column
 */
export function pasteIntoColumn(
	state: TableState,
	columnIndex: number,
	values: string[]
): TableState {
	if (values.length === 0) {
		return state;
	}

	const col = state.columns[columnIndex];
	const cellKey = col.type === 'dice' ? 'range' : col.name;

	// Create enough rows
	const rows = [...state.rows];
	while (rows.length < values.length) {
		rows.push({});
	}

	// Fill the column with values
	for (let i = 0; i < values.length; i++) {
		rows[i] = {
			...rows[i],
			[cellKey]: values[i],
		};
	}

	return {
		...state,
		rows,
	};
}

/**
 * Escapes a CSV cell value
 * Wraps in quotes if contains comma or quote, and escapes internal quotes
 * 
 * @param value - Cell value to escape
 * @returns Escaped CSV cell value
 */
export function escapeCsvCell(value: string): string {
	if (value.includes(',') || value.includes('"')) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

/**
 * Checks if a column type allows multiple instances
 * 
 * @param type - Column type to check
 * @param existingColumns - Current columns
 * @returns True if another column of this type can be added
 */
export function canAddColumnType(
	type: 'dice' | 'regular' | 'reroll',
	existingColumns: ColumnConfig[]
): boolean {
	if (type === 'regular') {
		return true; // Can have multiple regular columns
	}

	// Only one dice or reroll column allowed
	return !existingColumns.some(col => col.type === type);
}

/**
 * Gets a default column name for a new column
 * 
 * @param type - Type of column being created
 * @param existingColumns - Current columns
 * @returns Suggested name for the new column
 */
export function getDefaultColumnName(
	type: 'dice' | 'regular' | 'reroll',
	existingColumns: ColumnConfig[]
): string {
	if (type === 'dice') {
		return 'd6'; // Default dice type
	}

	if (type === 'reroll') {
		return 'reroll';
	}

	// For regular columns, generate numbered name
	return `Column ${existingColumns.length}`;
}
