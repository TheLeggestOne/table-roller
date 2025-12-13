/**
 * Types for table rolling system
 */

export interface DiceTableEntry {
	min: number;
	max: number;
	result: string; // Kept for backward compatibility
	details?: string; // Kept for backward compatibility
	columns?: Record<string, string>; // All column values with headers as keys
	reroll?: string; // Per-row reroll (from Reroll column)
}

export interface DiceTable {
	dice: string;
	entries: DiceTableEntry[];
	reroll?: string; // Table-level reroll (applies to all results)
	private?: boolean; // Hide from main table picker
}

export interface SimpleTable {
	headers: string[];
	rows: Record<string, string>[];
	reroll?: string; // Table-level reroll (applies to all results)
	private?: boolean; // Hide from main table picker
}

export type Table = DiceTable | SimpleTable;

export interface RollResult {
	tableName: string;
	namespace?: string;
	roll?: number;
	result: string; // Kept for backward compatibility
	details?: string; // Kept for backward compatibility
	columns?: Record<string, string>; // Dynamic column data with headers as keys
	nestedRolls?: RollResult[];
	sourceFile?: string; // Path to the source markdown file
}

export interface ParsedTable {
	tables: Record<string, Table>;
	frontmatter: Record<string, any>;
	isTableFile: boolean;
	namespace: string;
}