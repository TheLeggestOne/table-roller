// /**
//  * Types for table rolling system
//  */

// export interface DiceTableEntry {
// 	min: number;
// 	max: number;
// 	result: string; // Kept for backward compatibility
// 	details?: string; // Kept for backward compatibility
// 	columns?: Record<string, string>; // All column values with headers as keys
// 	reroll?: string; // Per-row reroll (from Reroll column)
// }

// export interface DiceTable {
// 	dice: string;
// 	entries: DiceTableEntry[];
// 	reroll?: string; // Table-level reroll (applies to all results)
// 	hidden?: boolean; // Hide from main table picker
// }

// export interface SimpleTable {
// 	headers: string[];
// 	rows: Record<string, string>[];
// 	reroll?: string; // Table-level reroll (applies to all results)
// 	hidden?: boolean; // Hide from main table picker
// }

// export type Table = DiceTable | SimpleTable;

// export interface RollResult {
// 	tableName: string;
// 	namespace?: string;
// 	roll?: number;
// 	columns?: Record<string, string>; // Dynamic column data with headers as keys
// 	nestedRolls?: RollResult[];
// 	sourceFile?: string; // Path to the source markdown file
// }

// export interface ParsedTable {
// 	tables: Record<string, Table>;
// 	frontmatter: Record<string, any>;
// 	isTableFile: boolean;
// 	namespace: string;
// }

// /**
//  * Configuration for a column in the table builder
//  */
// export interface ColumnConfig {
// 	name: string;
// 	type: 'dice' | 'regular' | 'reroll';
// 	diceNotation?: string; // e.g., 'd6', '2d6', 'd100'
// }

// /**
//  * Data for a single row in the table builder
//  */
// export interface RowData {
// 	range?: string; // For dice columns
// 	[columnName: string]: string | undefined;
// }

// /**
//  * Complete state of the table builder
//  */
// export interface TableState {
// 	tableName: string;
// 	columns: ColumnConfig[];
// 	rows: RowData[];
// 	isPrivate: boolean;
// 	tableReroll?: string;
// }

// /**
//  * History entry for undo/redo functionality
//  */
// export interface HistoryEntry {
// 	state: TableState;
// 	timestamp: number;
// }

// /**
//  * Event detail types for table builder custom events
//  */
// export interface ColumnAddedEventDetail {
// 	column: ColumnConfig;
// 	index: number;
// }

// export interface ColumnRemovedEventDetail {
// 	columnName: string;
// 	index: number;
// }

// export interface ColumnReorderedEventDetail {
// 	fromIndex: number;
// 	toIndex: number;
// }

// export interface RowAddedEventDetail {
// 	row: RowData;
// 	index: number;
// }

// export interface RowRemovedEventDetail {
// 	index: number;
// }

// export interface RowUpdatedEventDetail {
// 	index: number;
// 	row: RowData;
// }

// export interface RowSelectedEventDetail {
// 	index: number;
// }

// export interface CellEditedEventDetail {
// 	rowIndex: number;
// 	columnName: string;
// 	value: string;
// }

// export interface StateChangedEventDetail {
// 	state: TableState;
// }

// export interface PreviewRequestEventDetail {
// 	debounce: boolean;
// }