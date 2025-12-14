import { randomUUID } from "node:crypto";
import { 
	FRONTMATTER_DICE_COLUMN_KEY, 
	FRONTMATTER_IS_HIDDEN_KEY, 
	FRONTMATTER_NAME_KEY, 
	FRONTMATTER_REROLL_TABLE_KEY,
	FRONTMATTER_TABLEPARSER_KEY } from "./constants";
import type { TableColumn } from "src/types/tables/table-column";
import type { TableRow } from "src/types/tables/table-row";
import type { Table } from "src/types/tables/table";

export class TableParser {
	static isTableParserTable(filePath: string, fileContent: string): boolean {
		let { frontmatter } = this.extractFrontmatterAndBody(filePath, fileContent);
		let frontMatterKeyValues = this.parseFrontMatter(frontmatter);
		return frontMatterKeyValues[FRONTMATTER_TABLEPARSER_KEY] === true;
	}

	static parseTable(filePath: string, fileContent: string){
		let { frontmatter, content } = this.extractFrontmatterAndBody(filePath, fileContent);
		let frontMatterKeyValues = this.parseFrontMatter(frontmatter);
		let {columns, rows} = this.parseTableBody(content);

		let table: Table = {
			name: frontMatterKeyValues[FRONTMATTER_NAME_KEY] || 'Unnamed Table',
			rerollTable: frontMatterKeyValues[FRONTMATTER_REROLL_TABLE_KEY] || undefined,
			isHidden: frontMatterKeyValues[FRONTMATTER_IS_HIDDEN_KEY] || false,
			diceColumn: frontMatterKeyValues[FRONTMATTER_DICE_COLUMN_KEY] || undefined,
			columns: columns,
			rows: rows,
		};

		return table;
	}

	private static extractFrontmatterAndBody(filePath: string, content: string): { frontmatter: string, content: string } {
		console.debug(`Parsing file: ${filePath}`);
		const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
		const match = content.match(frontmatterRegex);

		if (!match) {
			console.debug(`Content with no frontmatter found in file: ${filePath}`);
			return { frontmatter: "", content };
		}

		const frontmatterText = match[1];
		const bodyContent = match[2];

			console.debug(`Frontmatter extracted from file: ${filePath}\n${frontmatterText}`);
		return { frontmatter: frontmatterText, content: bodyContent };
	}

	private static parseFrontMatter(content: string): Record<string, any> {
		let keyValues: Record<string, any> = {};
		
		// Parse YAML-like frontmatter
		for (const line of content.split('\n')) {
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

				keyValues[key] = value;
			}
		}
		return keyValues;
	}

	private static parseTableBody(content: string, diceColumn?: string): { columns: TableColumn[], rows: TableRow[] } {
		const lines = content.split('\n').filter(line => line.trim().length > 0);
		if (lines.length < 2) {
			return { columns: [], rows: [] };
		}
		const headerLine = lines[0];
		const separatorLine = lines[1];
		const dataLines = lines.slice(2);

		const headers = headerLine.split('|').map(h => h.trim()).filter(h => h.length > 0);
		const columns: TableColumn[] = headers.map((header, index) => ({
			id: `${randomUUID()}`,
			name: header,
			type: this.determineColumnType(header, diceColumn),
		}));

		const rows: TableRow[] = [];
		for (let i = 2; i < lines.length; i++) {

			// Remove leading/trailing pipes and split
			let cells = lines[i].replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

			// Pad cells to match headers length
			while (cells.length < headers.length) cells.push('');
			const row: Record<string, string> = {};
			headers.forEach((header, idx) => {
				row[header] = cells[idx] ?? '';
			});
			rows.push(row);
		}


		return { columns, rows };
	}


	private static determineColumnType(columnName: string, diceColumn? : string): 'dice' | 'regular' | 'reroll' {
		if (diceColumn && columnName === diceColumn) {
			return 'dice';
		}

		if (columnName.toLowerCase() === 'reroll') {
			return 'reroll';
		}

		return 'regular';
	}
}
