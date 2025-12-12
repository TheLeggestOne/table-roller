import { TableParser, SessionTracker } from '../tables/index.js';
import { DiceRoller } from '../dice/index.js';

/**
 * Core table roller logic - works in both standalone and plugin modes
 */
export class TableRollerCore {
  constructor(runtime) {
    this.runtime = runtime;
    this.tables = {};
    this.tracker = new SessionTracker();
  }

  /**
   * Load all tables from a directory
   * @param {string} tablesDir - Path to tables directory
   */
  async loadTables(tablesDir = './tables') {
    const exists = await this.runtime.exists(tablesDir);
    if (!exists) {
      throw new Error(`Tables directory not found: ${tablesDir}`);
    }

    const mdFiles = await this.runtime.findMarkdownFiles(tablesDir);

    for (const filePath of mdFiles) {
      const tableName = this.runtime.basename(filePath, '.md');
      const content = await this.runtime.readFile(filePath);
      
      // Parse the table with the filename as the default name
      const parsed = TableParser.parseTables(content, tableName);
      const tableData = parsed[tableName];
      
      if (tableData) {
        this.tables[tableName] = tableData;
      }
    }
  }

  /**
   * Roll on a single table with duplicate prevention
   * @param {string} tableName - Table name
   * @param {string} sessionId - Session ID for tracking
   * @param {number} maxAttempts - Maximum reroll attempts
   * @param {number} modifier - Modifier to add to dice roll
   * @returns {Object} Result object
   */
  rollSingle(tableName, sessionId = 'default', maxAttempts = 100, modifier = 0) {
    const normalizedName = this._findTableName(tableName);
    
    if (!normalizedName) {
      throw new Error(`Table not found: ${tableName}`);
    }

    const table = this.tables[normalizedName];
    let attempts = 0;
    let result;

    while (attempts < maxAttempts) {
      const roll = DiceRoller.roll(table.dice) + modifier;
      const entry = table.entries.find(e => roll >= e.min && roll <= e.max);

      if (!entry) {
        throw new Error(`No entry found for roll ${roll} on table ${normalizedName}`);
      }

      // Check if this result was already rolled in this session
      if (!this.tracker.hasBeenRolled(sessionId, normalizedName, entry.result)) {
        result = {
          table: normalizedName,
          dice: table.dice,
          roll: roll,
          modifier: modifier,
          rawRoll: roll - modifier,
          result: entry.result,
          details: entry.details,
          attempts: attempts + 1
        };

        this.tracker.recordRoll(sessionId, normalizedName, entry.result);
        break;
      }

      attempts++;
    }

    if (!result) {
      throw new Error(`Failed to get unique result after ${maxAttempts} attempts`);
    }

    return result;
  }

  /**
   * Roll with support for chained tables (e.g., "Table1 -> Table2")
   * @param {string} expression - Roll expression
   * @param {string} sessionId - Session ID
   * @param {number} maxAttempts - Max reroll attempts
   * @param {number} modifier - Modifier for dice rolls
   * @returns {Object} Combined result
   */
  roll(expression, sessionId = 'default', maxAttempts = 100, modifier = 0) {
    const tables = expression.split('->').map(t => t.trim());
    const results = [];

    for (const tableName of tables) {
      const result = this.rollSingle(tableName, sessionId, maxAttempts, modifier);
      results.push(result);
    }

    return {
      expression,
      results,
      sessionId
    };
  }

  /**
   * Format a roll result for display
   * @param {Object} result - Result from roll()
   * @returns {string}
   */
  formatResult(result) {
    let output = [];
    
    for (const r of result.results) {
      const modStr = r.modifier !== 0 ? ` (${r.rawRoll}${r.modifier >= 0 ? '+' : ''}${r.modifier})` : '';
      output.push(`[${r.table}] ${r.dice}: ${r.roll}${modStr}`);
      output.push(`Result: ${r.result}`);
      if (r.details) {
        output.push(`Details: ${r.details}`);
      }
      if (r.attempts > 1) {
        output.push(`(Required ${r.attempts} attempts for unique result)`);
      }
      output.push(''); // blank line
    }
    
    return output.join('\n');
  }

  /**
   * Get list of all loaded table names
   * @returns {string[]}
   */
  getTableNames() {
    return Object.keys(this.tables);
  }

  /**
   * Reset session tracking
   * @param {string} sessionId - Session ID to reset (or 'all')
   */
  resetSession(sessionId = 'all') {
    if (sessionId === 'all') {
      this.tracker = new SessionTracker();
    } else {
      this.tracker.clearSession(sessionId);
    }
  }

  // Private helper methods

  _findTableName(searchName) {
    const lower = searchName.toLowerCase();
    
    // Try exact match first
    if (this.tables[searchName]) {
      return searchName;
    }
    
    // Try case-insensitive match
    for (const name of Object.keys(this.tables)) {
      if (name.toLowerCase() === lower) {
        return name;
      }
    }
    
    return null;
  }
}
