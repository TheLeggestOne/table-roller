import { TableRollerCore } from '../../services/TableRollerCore';
import { TableParser } from '../../services/TableParser';

/**
 * Interface for column configuration
 */
export interface ColumnConfig {
	name: string;
	type: 'dice' | 'regular' | 'reroll';
	diceNotation?: string;
}

/**
 * Interface for row data
 */
export interface RowData {
	range?: string;
	[columnName: string]: string | undefined;
}

/**
 * Interface for table state
 */
export interface TableState {
	tableName: string;
	columns: ColumnConfig[];
	rows: RowData[];
	isPrivate: boolean;
	tableReroll?: string;
}

/**
 * Interface for validation results
 */
export interface ValidationResult {
	isValid: boolean;
	errors: string[];
}

/**
 * TableValidator class for validating table configuration
 */
export class TableValidator {
	private roller: TableRollerCore;

	constructor(roller: TableRollerCore) {
		this.roller = roller;
	}

	/**
	 * Validate complete table state
	 */
	async validateTable(state: TableState): Promise<ValidationResult> {
		const errors: string[] = [];

		// Validate table name
		this.validateTableName(state, errors);

		// Validate reroll references
		await this.validateRerollReferences(state, errors);

		// Validate dice ranges
		await this.validateDiceRanges(state, errors);

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	/**
	 * Validate table name is not empty
	 */
	private validateTableName(state: TableState, errors: string[]): void {
		if (!state.tableName.trim()) {
			errors.push('Table name cannot be empty');
		}
	}

	/**
	 * Validate all reroll references (table-level and row-level)
	 */
	private async validateRerollReferences(state: TableState, errors: string[]): Promise<void> {
		// Validate table-level reroll reference
		if (state.tableReroll) {
			const valid = await this.validateRerollReference(state.tableReroll);
			if (!valid) {
				errors.push(`Invalid table-level reroll reference: ${state.tableReroll}`);
			}
		}

		// Validate row-level reroll references
		const rerollCol = state.columns.find(c => c.type === 'reroll');
		if (rerollCol) {
			for (const row of state.rows) {
				const rerollValue = row[rerollCol.name];
				if (rerollValue && rerollValue !== '—' && rerollValue !== '-') {
					const valid = await this.validateRerollReference(rerollValue);
					if (!valid) {
						errors.push(`Invalid reroll reference: ${rerollValue}`);
					}
				}
			}
		}
	}

	/**
	 * Validate a single reroll reference (can be comma-separated list)
	 */
	private async validateRerollReference(reference: string): Promise<boolean> {
		const tableNames = reference.split(',').map(t => t.trim()).filter(t => t);

		for (const name of tableNames) {
			// Handle multi-roll syntax (e.g., "2d6 TableName")
			const multiRollMatch = name.match(/^(\d*d\d+)\s+(.+)$/i);
			const actualTableName = multiRollMatch ? multiRollMatch[2].trim() : name;

			try {
				const tableFile = this.roller.getTableFile(actualTableName);
				if (!tableFile) {
					return false;
				}
			} catch (error) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Validate dice column ranges
	 */
	private async validateDiceRanges(state: TableState, errors: string[]): Promise<void> {
		const diceCol = state.columns.find(c => c.type === 'dice');
		if (!diceCol) {
			return;
		}

		const ranges: Array<{ min: number; max: number; raw: string }> = [];

		// Parse all ranges
		for (const row of state.rows) {
			const range = row.range;
			if (range) {
				const parsed = this.parseRange(range);
				if (parsed.min === 0 && parsed.max === 0) {
					errors.push(`Invalid range format: ${range}`);
				} else {
					ranges.push({ min: parsed.min, max: parsed.max, raw: range });
				}
			}
		}

		// Check for overlaps
		this.checkRangeOverlaps(ranges, errors);

		// Check for coverage and gaps
		if (diceCol.diceNotation && ranges.length > 0) {
			this.checkRangeCoverage(diceCol.diceNotation, ranges, errors);
		}
	}

	/**
	 * Parse a range string into min and max values
	 */
	private parseRange(rangeStr: string): { min: number; max: number } {
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

		return { min: 0, max: 0 };
	}

	/**
	 * Check for duplicate or overlapping ranges
	 */
	private checkRangeOverlaps(
		ranges: Array<{ min: number; max: number; raw: string }>,
		errors: string[]
	): void {
		for (let i = 0; i < ranges.length; i++) {
			for (let j = i + 1; j < ranges.length; j++) {
				const r1 = ranges[i];
				const r2 = ranges[j];

				// Check if ranges overlap
				if (r1.min <= r2.max && r2.min <= r1.max) {
					errors.push(`Duplicate or overlapping ranges: ${r1.raw} and ${r2.raw}`);
				}
			}
		}
	}

	/**
	 * Check if ranges properly cover the expected dice values
	 */
	private checkRangeCoverage(
		diceNotation: string,
		ranges: Array<{ min: number; max: number; raw: string }>,
		errors: string[]
	): void {
		const match = diceNotation.match(/(\d*)d(\d+)/i);
		if (!match) {
			return;
		}

		const numDice = match[1] ? parseInt(match[1]) : 1;
		const sides = parseInt(match[2]);

		// For single dice (1dX), check coverage
		if (numDice === 1) {
			// Sort ranges by min value
			const sortedRanges = [...ranges].sort((a, b) => a.min - b.min);

			// Check if we start at 1
			if (sortedRanges[0].min !== 1) {
				errors.push(`Dice ranges should start at 1 (found: ${sortedRanges[0].min})`);
			}

			// Check if we end at the max dice value
			const lastRange = sortedRanges[sortedRanges.length - 1];
			if (lastRange.max !== sides) {
				errors.push(
					`Dice ranges should end at ${sides} for ${diceNotation} (found: ${lastRange.max})`
				);
			}

			// Check for gaps (only if no overlaps detected, since overlaps will cause false gap warnings)
			const hasOverlaps = this.hasOverlaps(ranges);

			if (!hasOverlaps) {
				for (let i = 0; i < sortedRanges.length - 1; i++) {
					const current = sortedRanges[i];
					const next = sortedRanges[i + 1];
					if (current.max + 1 !== next.min) {
						errors.push(`Gap in dice ranges between ${current.raw} and ${next.raw}`);
					}
				}
			}
		}
	}

	/**
	 * Check if there are any overlapping ranges
	 */
	private hasOverlaps(ranges: Array<{ min: number; max: number; raw: string }>): boolean {
		return ranges.some((r1, i) =>
			ranges.some((r2, j) => i !== j && r1.min <= r2.max && r2.min <= r1.max)
		);
	}
}
