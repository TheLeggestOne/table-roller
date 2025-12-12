import { App, TFile } from 'obsidian';
import { Table, DiceTable, RollResult } from '../types';
import { TableParser } from './TableParser';
import { DiceRoller } from './DiceRoller';

/**
 * Core table rolling logic with namespace support
 */
export class TableRollerCore {
	private tables: Map<string, { table: Table, namespace: string }> = new Map();
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Load all tables from vault files with frontmatter
	 */
	async loadTables(): Promise<void> {
		this.tables.clear();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			await this.loadTableFromFile(file);
		}

		console.log(`Loaded ${this.tables.size} tables from ${files.length} files`);
	}

	/**
	 * Load tables from a single file
	 */
	private async loadTableFromFile(file: TFile): Promise<void> {
		const content = await this.app.vault.read(file);
		const namespace = file.basename;
		const parsed = TableParser.parseTables(content, namespace);

		// Only load files with table-roller frontmatter
		if (!parsed.isTableFile) {
			return;
		}

		// Store tables with both short name and namespaced name
		for (const [name, table] of Object.entries(parsed.tables)) {
			// Store with short name (for same-file references)
			this.tables.set(name, { table, namespace });
			
			// Also store with full namespace (for cross-file references)
			const fullName = `${namespace}.${name}`;
			this.tables.set(fullName, { table, namespace });
		}
	}

	/**
	 * Get list of all available table names
	 */
	getTableNames(): string[] {
		// Return only non-namespaced names for the picker
		const names = new Set<string>();
		for (const key of this.tables.keys()) {
			if (!key.includes('.')) {
				names.add(key);
			}
		}
		return Array.from(names).sort();
	}

	/**
	 * Roll on a table by name
	 */
	roll(tableName: string, contextNamespace?: string, modifier: number = 0): RollResult {
		const tableData = this.findTable(tableName, contextNamespace);
		if (!tableData) {
			throw new Error(`Table not found: ${tableName}`);
		}

		return this.rollOnTable(tableName, tableData.table, tableData.namespace, modifier);
	}

	/**
	 * Roll on a specific table
	 */
	private rollOnTable(tableName: string, table: Table, namespace: string, modifier: number = 0): RollResult {
		let result: RollResult;

		if (this.isDiceTable(table)) {
			result = this.rollDiceTable(tableName, table, namespace, modifier);
		} else {
			result = this.rollSimpleTable(tableName, table, namespace);
		}

		// Handle table-level reroll (applies to all results)
		if (table.reroll) {
			const tableRerolls = this.resolveRerolls(table.reroll, namespace, modifier);
			if (result.nestedRolls) {
				result.nestedRolls.push(...tableRerolls);
			} else {
				result.nestedRolls = tableRerolls;
			}
		}

		return result;
	}

	/**
	 * Roll on a dice-based table
	 */
	private rollDiceTable(tableName: string, table: DiceTable, namespace: string, modifier: number = 0): RollResult {
		const baseRoll = DiceRoller.roll(table.dice);
		let rollValue = baseRoll + modifier;

		// Clamp rollValue to table bounds when modifier causes out-of-bounds results
		const minBound = Math.min(...table.entries.map(e => e.min));
		const maxBound = Math.max(...table.entries.map(e => e.max));
		rollValue = Math.max(minBound, Math.min(maxBound, rollValue));

		const entry = table.entries.find(e => rollValue >= e.min && rollValue <= e.max);

		if (!entry) {
			throw new Error(`No entry found for roll ${rollValue} on table ${tableName}`);
		}

		const result: RollResult = {
			tableName,
			namespace,
			roll: rollValue,
			result: entry.result,
			details: entry.details
		};

		// Handle per-row reroll
		if (entry.reroll) {
			result.nestedRolls = this.resolveRerolls(entry.reroll, namespace, modifier);
		}

		return result;
	}

	/**
	 * Roll on a simple table (random row selection)
	 */
	private rollSimpleTable(tableName: string, table: any, namespace: string): RollResult {
		const randomIndex = Math.floor(Math.random() * table.rows.length);
		const row = table.rows[randomIndex];

		// Format the row data as result
		const resultParts: string[] = [];
		for (const [key, value] of Object.entries(row)) {
			if (value && typeof value === 'string' && value.trim()) {
				resultParts.push(`**${key}:** ${value}`);
			}
		}

		return {
			tableName,
			namespace,
			result: resultParts.join('\n')
		};
	}

	/**
	 * Resolve reroll references (comma-delimited table names)
	 */
	private resolveRerolls(rerollString: string, contextNamespace: string, modifier: number = 0): RollResult[] {
		const tableNames = rerollString.split(',').map(t => t.trim()).filter(t => t);
		const results: RollResult[] = [];

		for (const name of tableNames) {
			const tableData = this.findTable(name, contextNamespace);
			if (tableData) {
				try {
					results.push(this.rollOnTable(name, tableData.table, tableData.namespace, modifier));
				} catch (error) {
					console.warn(`Failed to roll on ${name}:`, error);
				}
			} else {
				console.warn(`Table not found for reroll: ${name}`);
			}
		}

		return results;
	}

	/**
	 * Find a table by name with namespace resolution
	 * Supports:
	 * - Short name (within same namespace)
	 * - Full name (Namespace.TableName)
	 * - Case-insensitive matching
	 */
	private findTable(searchName: string, contextNamespace?: string): { table: Table, namespace: string } | null {
		// Try exact match first
		let tableData = this.tables.get(searchName);
		if (tableData) return tableData;

		// If there's a context namespace and no dot in search name, try namespaced version
		if (contextNamespace && !searchName.includes('.')) {
			const namespacedName = `${contextNamespace}.${searchName}`;
			tableData = this.tables.get(namespacedName);
			if (tableData) return tableData;
		}

		// Try case-insensitive match
		const lower = searchName.toLowerCase();
		for (const [key, data] of this.tables.entries()) {
			if (key.toLowerCase() === lower) {
				return data;
			}
		}

		return null;
	}

	/**
	 * Check if a table is dice-based
	 */
	private isDiceTable(table: Table): table is DiceTable {
		return 'dice' in table && 'entries' in table;
	}
}
