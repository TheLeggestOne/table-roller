/**
 * Parses markdown tables from text
 */
export class TableParser {
  /**
   * Parse all tables from markdown text
   * @param {string} content - Markdown content
   * @param {string} defaultName - Default name if no heading found
   * @returns {Object} Map of table names to table data
   */
  static parseTables(content, defaultName = 'Table') {
    const tables = {};
    const lines = content.split('\n');
    let currentTableName = null;
    let currentTable = [];
    let inTable = false;
    let tableCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check for table name (heading before table)
      const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
      if (headingMatch) {
        currentTableName = headingMatch[1].trim();
        continue;
      }

      // Check if line is part of a table
      if (line.includes('|')) {
        if (!inTable) {
          inTable = true;
          currentTable = [];
          // If no heading was set, use default name
          if (!currentTableName) {
            tableCount++;
            currentTableName = tableCount === 1 ? defaultName : `${defaultName}${tableCount}`;
          }
        }
        currentTable.push(line);
      } else if (inTable && currentTable.length > 0) {
        // End of table
        const parsed = this.parseTable(currentTable);
        if (parsed && currentTableName) {
          tables[currentTableName] = parsed;
        }
        inTable = false;
        currentTable = [];
        currentTableName = null;
      }
    }

    // Handle last table
    if (inTable && currentTable.length > 0) {
      if (!currentTableName) {
        tableCount++;
        currentTableName = tableCount === 1 ? defaultName : `${defaultName}${tableCount}`;
      }
      const parsed = this.parseTable(currentTable);
      if (parsed) {
        tables[currentTableName] = parsed;
      }
    }

    return tables;
  }

  /**
   * Parse a single markdown table
   * @param {string[]} lines - Table lines
   * @returns {Object} Parsed table with headers and rows
   */
  static parseTable(lines) {
    if (lines.length < 2) return null;

    const headers = this.parseRow(lines[0]);
    const rows = [];

    // Skip separator line (line 1)
    for (let i = 2; i < lines.length; i++) {
      const row = this.parseRow(lines[i]);
      if (row.length > 0) {
        const rowObj = {};
        headers.forEach((header, idx) => {
          rowObj[header] = row[idx] || '';
        });
        rows.push(rowObj);
      }
    }

    return { headers, rows };
  }

  /**
   * Parse a single table row
   * @param {string} line - Table row line
   * @returns {string[]} Cell values
   */
  static parseRow(line) {
    return line
      .split('|')
      .map(cell => cell.trim())
      .filter((cell, idx, arr) => idx !== 0 && idx !== arr.length - 1);
  }
}
