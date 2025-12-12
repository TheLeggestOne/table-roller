/**
 * Dice rolling and random selection utilities
 */
export class DiceRoller {
  /**
   * Roll dice using standard notation (e.g., "1d6", "2d10+5", "d20")
   * @param {string} notation - Dice notation
   * @returns {number} Result of the roll
   */
  static roll(notation) {
    const match = notation.match(/^(\d*)d(\d+)([+\-]\d+)?$/i);
    if (!match) {
      throw new Error(`Invalid dice notation: ${notation}`);
    }

    const count = parseInt(match[1] || '1', 10);
    const sides = parseInt(match[2], 10);
    const modifier = parseInt(match[3] || '0', 10);

    let total = 0;
    for (let i = 0; i < count; i++) {
      total += Math.floor(Math.random() * sides) + 1;
    }

    return total + modifier;
  }

  /**
   * Roll on a table using range-based entries
   * @param {Array} rows - Table rows with range column
   * @param {string} rangeColumn - Name of the column with ranges (e.g., "d6", "d100")
   * @param {number} modifier - Modifier to add to the dice roll
   * @returns {Object} Selected row
   */
  static rollOnTable(rows, rangeColumn = 'd6', modifier = 0) {
    const baseRoll = this.roll(rangeColumn);
    const rollResult = baseRoll + modifier;
    
    for (const row of rows) {
      const range = row[rangeColumn];
      if (this.isInRange(rollResult, range)) {
        return { 
          ...row, 
          _roll: rollResult,
          _baseRoll: baseRoll,
          _modifier: modifier
        };
      }
    }

    // Fallback to random selection if no range matches
    const selected = this.randomSelect(rows);
    return { 
      ...selected, 
      _roll: rollResult,
      _baseRoll: baseRoll,
      _modifier: modifier
    };
  }

  /**
   * Check if a number is in a range string (e.g., "1-3", "4", "5-6", "41+")
   * @param {number} num - Number to check
   * @param {string} range - Range string
   * @returns {boolean} Whether number is in range
   */
  static isInRange(num, range) {
    if (!range) return false;
    
    const rangeStr = String(range).trim();
    
    // Single number
    if (/^\d+$/.test(rangeStr)) {
      return num === parseInt(rangeStr, 10);
    }

    // Range (e.g., "1-3", "1–3" with en-dash)
    const rangeMatch = rangeStr.match(/^(\d+)[-–](\d+)$/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      return num >= min && num <= max;
    }

    // Open-ended range (e.g., "41+")
    const openEndedMatch = rangeStr.match(/^(\d+)\+$/);
    if (openEndedMatch) {
      const min = parseInt(openEndedMatch[1], 10);
      return num >= min;
    }

    return false;
  }

  /**
   * Randomly select an item from an array
   * @param {Array} items - Items to select from
   * @returns {*} Random item
   */
  static randomSelect(items) {
    return items[Math.floor(Math.random() * items.length)];
  }
}
