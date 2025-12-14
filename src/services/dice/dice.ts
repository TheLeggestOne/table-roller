export class Dice {
    /**
	 * Check if a number falls within a range string (e.g., "1-3", "4", "5+")
	 */
	static isInRange(value: number, rangeStr: string): boolean {
		const trimmed = rangeStr.trim();

		// Single number
		if (/^\d+$/.test(trimmed)) {
			return value === parseInt(trimmed);
		}

		// Range (e.g., "1-3")
		const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
		if (rangeMatch) {
			const min = parseInt(rangeMatch[1]);
			const max = parseInt(rangeMatch[2]);
			return value >= min && value <= max;
		}

		// Open-ended (e.g., "41+")
		const openMatch = trimmed.match(/^(\d+)\+$/);
		if (openMatch) {
			const min = parseInt(openMatch[1]);
			return value >= min;
		}

		return false;
	}

	/**
	 * Roll dice using standard notation (e.g., "2d6+3", "d20", "1d100-5")
	 */
	static roll(notation: string): number {
		const match = notation.match(/(\d*)d(\d+)([+-]\d+)?/i);
		
		if (!match) {
			throw new Error(`Invalid dice notation: ${notation}`);
		}

		const count = match[1] ? parseInt(match[1]) : 1;
		const sides = parseInt(match[2]);
		const modifier = match[3] ? parseInt(match[3]) : 0;

		let total = 0;
		for (let i = 0; i < count; i++) {
			total += Math.floor(Math.random() * sides) + 1;
		}

		return total + modifier;
	}

	/**
	 * Validate dice notation
	 */
	static isValidNotation(notation: string): boolean {
		return /^(\d*)d(\d+)([+-]\d+)?$/i.test(notation);
	}
}