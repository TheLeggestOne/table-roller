import { TableParser } from './tableParser.js';
import { DiceRoller } from './diceRoller.js';
import { SessionTracker } from './sessionTracker.js';
import fs from 'fs';
import path from 'path';

/**
 * Main TableHelper class for managing and rolling on tables
 */
export class TableHelper {
  constructor() {
    this.tables = {};
    this.tracker = new SessionTracker();
  }

  /**
   * Load all tables from the tables/ directory
   * Each .md file becomes a table with the filename (without .md) as the table name
   * @param {string} tablesDir - Path to tables directory (default: './tables')
   */
  async loadTables(tablesDir = './tables') {
    if (!fs.existsSync(tablesDir)) {
      throw new Error(`Tables directory not found: ${tablesDir}`);
    }

    const mdFiles = this.findMarkdownFiles(tablesDir);

    for (const filePath of mdFiles) {
      const tableName = path.basename(filePath, '.md');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Parse the table with the filename as the default name
      const parsed = TableParser.parseTables(content, tableName);
      const tableData = parsed[tableName];
      
      if (tableData) {
        this.tables[tableName] = tableData;
      }
    }
  }

  /**
   * Load all tables from the tables/ directory (sync version)
   * @param {string} tablesDir - Path to tables directory (default: './tables')
   */
  loadTablesSync(tablesDir = './tables') {
    if (!fs.existsSync(tablesDir)) {
      throw new Error(`Tables directory not found: ${tablesDir}`);
    }

    const mdFiles = this.findMarkdownFiles(tablesDir);

    for (const filePath of mdFiles) {
      const tableName = path.basename(filePath, '.md');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Parse the table with the filename as the default name
      const parsed = TableParser.parseTables(content, tableName);
      const tableData = parsed[tableName];
      
      if (tableData) {
        this.tables[tableName] = tableData;
      }
    }
  }

  /**
   * Recursively find all .md files in a directory
   * @param {string} dir - Directory to search
   * @returns {string[]} Array of file paths
   */
  findMarkdownFiles(dir) {
    let results = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursively search subdirectories
        results = results.concat(this.findMarkdownFiles(fullPath));
      } else if (item.endsWith('.md')) {
        results.push(fullPath);
      }
    }

    return results;
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
    // Find table with case-insensitive matching
    const actualTableName = this.findTableName(tableName);
    const table = this.tables[actualTableName];
    if (!table) {
      throw new Error(`Table "${tableName}" not found`);
    }

    // Determine dice notation from table
    const diceColumn = this.getDiceColumn(table);
    
    // Roll with duplicate prevention
    let attempts = 0;
    let rollResult;
    
    do {
      rollResult = DiceRoller.rollOnTable(table.rows, diceColumn, modifier);
      attempts++;
    } while (
      this.tracker.isDuplicate(sessionId, actualTableName, rollResult) &&
      attempts < maxAttempts &&
      table.rows.length > this.tracker.getResults(sessionId, actualTableName).length
    );

    if (attempts >= maxAttempts && this.tracker.isDuplicate(sessionId, actualTableName, rollResult)) {
      console.warn(`Max reroll attempts reached for table "${actualTableName}". Returning duplicate.`);
    }

    this.tracker.addResult(sessionId, actualTableName, rollResult);
    rollResult._tableName = actualTableName;
    
    // Check for reroll column (case-insensitive)
    const rerollKey = Object.keys(rollResult).find(key => key.toLowerCase() === 'reroll');
    if (rerollKey) {
      const rerollExpression = rollResult[rerollKey];
      // Skip empty values, dashes, and whitespace
      if (rerollExpression && 
          rerollExpression.trim() !== '' && 
          rerollExpression.trim() !== '—' && 
          rerollExpression.trim() !== '-') {
        // Recursively roll on the reroll expression
        const rerollResults = this.roll(rerollExpression, sessionId, maxAttempts);
        rollResult._rerolls = rerollResults;
      }
    }
    
    return rollResult;
  }

  /**
   * Roll on multiple tables sequentially (independent rolls)
   * @param {string[]} tableNames - Array of table names
   * @param {string} sessionId - Session ID for tracking
   * @param {number} modifier - Modifier to add to dice rolls
   * @returns {Array} Array of results
   */
  rollSequence(tableNames, sessionId = 'default', modifier = 0) {
    const results = [];
    for (const tableName of tableNames) {
      const result = this.rollSingle(tableName, sessionId, 100, modifier);
      results.push(result);
    }
    return results;
  }

  /**
   * Roll on a table with duplicate prevention (backwards compatible)
   * @param {string} expression - Roll expression (e.g., "Encounters", "Encounters>Details")
   * @param {string} sessionId - Session ID for tracking
   * @param {number} maxAttempts - Maximum reroll attempts
   * @param {number} modifier - Modifier to add to dice rolls (global)
   * @returns {Object|Array} Result object or array of results
   */
  roll(expression, sessionId = 'default', maxAttempts = 100, modifier = 0) {
    // Check if it's a sequence (comma-separated) or chain (>-separated)
    if (expression.includes(',')) {
      // Sequential independent rolls
      const tableNames = expression.split(',').map(s => s.trim());
      const results = [];
      for (const tableName of tableNames) {
        // Parse per-table modifier
        const { name, mod } = this.parseTableNameWithModifier(tableName);
        const finalModifier = modifier + mod;
        const result = this.rollSingle(name, sessionId, maxAttempts, finalModifier);
        results.push(result);
      }
      return results;
    } else if (expression.includes('>')) {
      // Chained rolls (for backwards compatibility)
      const chain = expression.split('>').map(s => s.trim());
      let result = null;

      for (const tableName of chain) {
        // Parse per-table modifier
        const { name, mod } = this.parseTableNameWithModifier(tableName);
        const finalModifier = modifier + mod;
        const rollResult = this.rollSingle(name, sessionId, maxAttempts, finalModifier);
        
        // Chain the result
        if (result) {
          rollResult._chain = result;
        }
        result = rollResult;
      }

      return result;
    } else {
      // Single table roll
      const { name, mod } = this.parseTableNameWithModifier(expression);
      const finalModifier = modifier + mod;
      return this.rollSingle(name, sessionId, maxAttempts, finalModifier);
    }
  }

  /**
   * Parse a table name that may include a modifier
   * @param {string} tableExpression - Table name possibly with modifier (e.g., "TableName+5", "Table-3")
   * @returns {Object} Object with name and modifier
   */
  parseTableNameWithModifier(tableExpression) {
    const match = tableExpression.match(/^(.+?)([+\-]\d+)$/);
    if (match) {
      return {
        name: match[1].trim(),
        mod: parseInt(match[2], 10)
      };
    }
    return { name: tableExpression.trim(), mod: 0 };
  }

  /**
   * Roll a simple dice expression
   * @param {string} notation - Dice notation (e.g., "1d6", "2d10+5")
   * @returns {number} Roll result
   */
  rollDice(notation) {
    return DiceRoller.roll(notation);
  }

  /**
   * Get available table names
   * @returns {string[]} Array of table names
   */
  getTableNames() {
    return Object.keys(this.tables);
  }

  /**
   * Get a table by name
   * @param {string} name - Table name
   * @returns {Object} Table object
   */
  getTable(name) {
    const actualName = this.findTableName(name);
    return this.tables[actualName];
  }

  /**
   * Find the actual table name with case-insensitive matching
   * @param {string} name - Table name to search for
   * @returns {string} Actual table name or original name if not found
   */
  findTableName(name) {
    // First try exact match
    if (this.tables[name]) {
      return name;
    }
    
    // Try case-insensitive match
    const lowerName = name.toLowerCase();
    const found = Object.keys(this.tables).find(key => key.toLowerCase() === lowerName);
    return found || name;
  }

  /**
   * Get session history
   * @param {string} sessionId - Session ID
   * @returns {Array} History entries
   */
  getHistory(sessionId = 'default') {
    return this.tracker.getHistory(sessionId);
  }

  /**
   * Clear session
   * @param {string} sessionId - Session ID
   */
  clearSession(sessionId = 'default') {
    this.tracker.clearSession(sessionId);
  }

  /**
   * Determine the dice column from table headers
   * @param {Object} table - Table object
   * @returns {string} Column name for dice rolling
   */
  getDiceColumn(table) {
    // Look for columns that match dice notation
    for (const header of table.headers) {
      if (/^d\d+$/i.test(header)) {
        return header;
      }
    }
    // Default to first column
    return table.headers[0];
  }

  /**
   * Format a result for display
   * @param {Object|Array} result - Result object or array of results
   * @returns {string} Formatted string
   */
  formatResult(result) {
    // Handle array of results (sequential rolls)
    if (Array.isArray(result)) {
      return result.map((r, idx) => {
        const tableName = r._tableName || `Table ${idx + 1}`;
        const formatted = this.formatSingleResult(r, 1);
        return `# ${tableName}\n${formatted}`;
      }).join('\n\n');
    }
    // Handle single result or chained results
    return this.formatSingleResult(result, 1);
  }

  /**
   * Format a single result (with optional chain)
   * @param {Object} result - Result object
   * @returns {string} Formatted string
   */
  /**
   * Format a single result (with optional chain) as markdown
   * @param {Object} result - Result object
   * @param {number} headingLevel - Markdown heading level (1 = #, 2 = ##, ...)
   * @returns {string} Formatted markdown string
   */
  formatSingleResult(result, headingLevel = 1) {
    let current = result;
    const chainedResults = [];
    while (current) {
      chainedResults.unshift(current);
      current = current._chain;
    }

    let output = '';
    for (let i = 0; i < chainedResults.length; i++) {
      const item = chainedResults[i];
      const tableName = item._tableName || `Result`;
      const heading = `${'#'.repeat(headingLevel + i)} ${tableName}`;

      // Gather visible keys
      const visibleEntries = Object.entries(item)
        .filter(([key]) => !key.startsWith('_'))
        .filter(([key]) => key.toLowerCase() !== 'reroll');

      // Decide if we should use a table or bullet points
      if (visibleEntries.length > 1) {
        // Markdown table
        const headers = visibleEntries.map(([key]) => key);
        const values = visibleEntries.map(([_, value]) => value);
        output += `${heading}\n| ${headers.join(' | ')} |\n|${headers.map(() => '---').join('|')}|\n| ${values.join(' | ')} |\n`;
      } else if (visibleEntries.length === 1) {
        // Single value as bullet point
        const [key, value] = visibleEntries[0];
        output += `${heading}\n- ${key}: ${value}\n`;
      } else {
        output += `${heading}\n(No details)\n`;
      }

      // Add reroll results if they exist
      if (item._rerolls) {
        if (Array.isArray(item._rerolls)) {
          // Group rerolls by table name
          const groupedRerolls = new Map();
          item._rerolls.forEach(reroll => {
            const rerollTable = reroll._tableName || 'Reroll';
            if (!groupedRerolls.has(rerollTable)) {
              groupedRerolls.set(rerollTable, []);
            }
            groupedRerolls.get(rerollTable).push(reroll);
          });
          groupedRerolls.forEach((rerolls, rerollTable) => {
            output += `\n${'#'.repeat(headingLevel + i + 1)} ${rerollTable}\n`;
            rerolls.forEach(reroll => {
              output += this.formatSingleResult(reroll, headingLevel + i + 2) + '\n';
            });
          });
        } else {
          const rerollTable = item._rerolls._tableName || 'Reroll';
          output += `\n${'#'.repeat(headingLevel + i + 1)} ${rerollTable}\n`;
          output += this.formatSingleResult(item._rerolls, headingLevel + i + 2) + '\n';
        }
      }
    }
    return output.trim();
  }
}
