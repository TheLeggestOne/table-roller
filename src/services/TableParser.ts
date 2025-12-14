import { Table, DiceTable, ParsedTable } from '../types';

/**
 * Parses markdown files to extract table data with namespace support
 */
export class TableParser {
	/**
	 * Extract YAML frontmatter from markdown content
	 */
	static extractFrontmatter(content: string): { frontmatter: Record<string, any>, content: string } {
		const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
		const match = content.match(frontmatterRegex);

		if (!match) {
			return { frontmatter: {}, content };
		}

		const frontmatterText = match[1];
		const bodyContent = match[2];
		const frontmatter: Record<string, any> = {};

		// Parse YAML-like frontmatter
		for (const line of frontmatterText.split('\n')) {
			const keyValue = line.match(/^(\w+(?:-\w+)*)\s*:\s*(.+)$/);
			if (keyValue) {
				const key = keyValue[1].trim();
				let value: any = keyValue[2].trim();

				// Handle boolean values
				if (value === 'true') value = true;
				else if (value === 'false') value = false;
				// Remove quotes
				else if ((value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))) {
					value = value.slice(1, -1);
				}

				frontmatter[key] = value;
			}
		}

		return { frontmatter, content: bodyContent };
	}

	/**
	 * Parse all tables from markdown content
	 */
	static parseTables(content: string, namespace: string): ParsedTable {
		const { frontmatter, content: bodyContent } = this.extractFrontmatter(content);
		const isTableFile = frontmatter['table-roller'] === true;

		const tables: Record<string, Table> = {};
		const lines = bodyContent.split('\n');
		let currentTableName: string | null = null;
		let currentTableReroll: string | undefined = undefined;
		let currentTablePrivate: boolean = false;
		let currentTable: string[] = [];
		let inTable = false;
		let tableCount = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();

			// Check for heading (table name)
			const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
			if (headingMatch) {
				// Save any open table first
				if (inTable && currentTable.length > 0) {
					const parsed = this.parseTable(currentTable);
					if (parsed && currentTableName) {
						tables[currentTableName] = this.processTable(parsed, currentTableReroll, currentTablePrivate);
					}
					inTable = false;
					currentTable = [];
					currentTableReroll = undefined;
					currentTablePrivate = false;
				}
				currentTableName = headingMatch[1].trim();
			console.log(`Found heading: "${currentTableName}"`);
			continue;
		}

		// Check for table-level reroll directive (line after heading)
		const rerollMatch = line.match(/^reroll:\s*(.+)$/i);
		if (rerollMatch && currentTableName && !inTable) {
			currentTableReroll = rerollMatch[1].trim();
			continue;
		}

		// Check for private directive (line after heading)
		const privateMatch = line.match(/^private:\s*(true|yes|1)$/i);
		if (privateMatch && currentTableName && !inTable) {
			currentTablePrivate = true;
			continue;
		}

		// Check if line is part of a table
			if (line.includes('|')) {
				if (!inTable) {
					inTable = true;
					currentTable = [];
					// If no heading was set, use numbered default name
					if (!currentTableName) {
						tableCount++;
						currentTableName = `${namespace}${tableCount}`;
					}
				}
				currentTable.push(line);
			} else if (inTable && currentTable.length > 0) {
				// End of table
				const parsed = this.parseTable(currentTable);
				if (parsed && currentTableName) {
					tables[currentTableName] = this.processTable(parsed, currentTableReroll, currentTablePrivate);
				}
				inTable = false;
				currentTable = [];
				currentTableName = null;
				currentTableReroll = undefined;
				currentTablePrivate = false;
				currentTablePrivate = false;
			}
		}

		// Handle last table
		if (inTable && currentTable.length > 0 && currentTableName) {
			const parsed = this.parseTable(currentTable);
			if (parsed) {
				tables[currentTableName] = this.processTable(parsed, currentTableReroll, currentTablePrivate);
			}
		}

		return { tables, frontmatter, isTableFile, namespace };
	}

	/**
	 * Parse a single markdown table into structured data
	 */
	private static parseTable(lines: string[]): { headers: string[], rows: Record<string, string>[] } | null {
		if (lines.length < 3) return null;

		// Parse header row
		const headerLine = lines[0];
		const headers = headerLine.split('|')
			.map(h => h.trim())
			.filter(h => h.length > 0);

		if (headers.length === 0) return null;

		// Skip separator row (line 1)
		// Parse data rows
		const rows: Record<string, string>[] = [];
		for (let i = 2; i < lines.length; i++) {
			const cells = lines[i].split('|')
				.map(c => c.trim())
				.filter((_, idx) => idx > 0 && idx <= headers.length);

			if (cells.length > 0) {
				const row: Record<string, string> = {};
				headers.forEach((header, idx) => {
					row[header] = cells[idx] || '';
				});
				rows.push(row);
			}
		}

		return { headers, rows };
	}

	/**
	 * Process parsed table into dice or simple format
	 */
	private static processTable(parsed: { headers: string[], rows: Record<string, string>[] }, tableReroll?: string, tablePrivate?: boolean): Table {
		// Check if table has a dice column (supports both dX and ndX formats)
		const diceHeader = parsed.headers.find(h => /^\d*d\d+$/i.test(h.trim()));

		if (diceHeader) {
			// Convert to dice table format
			return this.processDiceTable(parsed, diceHeader, tableReroll, tablePrivate);
		} else {
			// Keep as simple table
			const table: any = {
				headers: parsed.headers,
				rows: parsed.rows
			};
			if (tableReroll) {
				table.reroll = tableReroll;
			}
			if (tablePrivate) {
				table.private = tablePrivate;
			}
			return table;
		}
	}

	/**
	 * Process a dice-based table
	 */
	private static processDiceTable(parsed: { headers: string[], rows: Record<string, string>[] }, diceHeader: string, tableReroll?: string, tablePrivate?: boolean): DiceTable {
		const entries: any[] = [];
		const rerollHeader = parsed.headers.find(h => /^reroll$/i.test(h.trim()));

		for (const row of parsed.rows) {
			const range = row[diceHeader];
			const { min, max } = this.parseRange(range);

			let result = '';
			let details = '';
			let reroll: string | undefined;
			const columns: Record<string, string> = {};

			for (const [key, value] of Object.entries(row)) {
				if (key === diceHeader) continue;

				// Check if this is the reroll column (case-insensitive)
				const isRerollColumn = rerollHeader && key.toLowerCase().trim() === rerollHeader.toLowerCase().trim();
				
				if (isRerollColumn) {
					const trimmed = value.trim();
					if (trimmed && trimmed !== '—' && trimmed !== '-') {
						reroll = trimmed;
					}
					continue; // Don't include reroll column in display columns
				}
				
				// Skip empty values for display columns
				if (!value || !value.trim()) continue;
				
				// Store all non-dice, non-reroll columns
				columns[key] = value;
				
				// Maintain backward compatibility
				if (!result) {
					result = value;
				} else if (!details) {
					details = value;
				} else {
					details += ' | ' + value;
				}
			}

			const entry: any = { min, max, result, columns };
			if (details) entry.details = details;
		if (reroll) entry.reroll = reroll;
			entries.push(entry);
		}

		const table: DiceTable = {
			dice: diceHeader.toLowerCase(),
			entries
		};

		if (tableReroll) {
			table.reroll = tableReroll;
		}
		
		if (tablePrivate) {
			table.private = tablePrivate;
		}

		return table;
	}

	/**
	 * Parse a range string into min/max values
	 */
	private static parseRange(rangeStr: string): { min: number, max: number } {
		if (!rangeStr) return { min: 0, max: 0 };

		const trimmed = rangeStr.trim();

		// Single number
		if (/^\d+$/.test(trimmed)) {
			const num = parseInt(trimmed);
			return { min: num, max: num };
		}

		// Range (e.g., "1-3", "1–3" with en-dash, or "1—3" with em-dash)
		const rangeMatch = trimmed.match(/^(\d+)[\-\u2013\u2014](\d+)$/);
		if (rangeMatch) {
			return {
				min: parseInt(rangeMatch[1]),
				max: parseInt(rangeMatch[2])
			};
		}

		// Open-ended (e.g., "41+")
		const openMatch = trimmed.match(/^(\d+)\+$/);
		if (openMatch) {
			return {
				min: parseInt(openMatch[1]),
				max: 999
			};
		}

		return { min: 0, max: 0 };
	}
}
