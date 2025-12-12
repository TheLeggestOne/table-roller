/**
 * Types for table rolling system
 */

export interface DiceTableEntry {
	min: number;
	max: number;
	result: string;
	details?: string;
	reroll?: string; // Per-row reroll (from Reroll column)
}

export interface DiceTable {
	dice: string;
	entries: DiceTableEntry[];
	reroll?: string; // Table-level reroll (applies to all results)
}

export interface SimpleTable {
	headers: string[];
	rows: Record<string, string>[];
	reroll?: string; // Table-level reroll (applies to all results)
}

export type Table = DiceTable | SimpleTable;

export interface RollResult {
	tableName: string;
	namespace?: string;
	roll?: number;
	result: string;
	details?: string;
	nestedRolls?: RollResult[];
}

export interface ParsedTable {
	tables: Record<string, Table>;
	frontmatter: Record<string, any>;
	isTableFile: boolean;
	namespace: string;
}