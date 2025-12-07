import fs from 'fs';
import { TableHelper } from './tableHelper.js';

const helper = new TableHelper();

// Example usage
if (process.argv.length > 2) {
  const command = process.argv[2];

  if (command === 'load') {
    // Load all tables from tables/ directory
    const tablesDir = process.argv[3] || './tables';
    try {
      helper.loadTablesSync(tablesDir);
      console.log('Loaded tables:', helper.getTableNames().join(', '));
    } catch (error) {
      console.error('Error:', error.message);
    }
  } else if (command === 'roll') {
    // Load tables and roll
    const expression = process.argv[3];
    
    if (!expression) {
      console.error('Error: No roll expression provided');
      printUsage();
      process.exit(1);
    }
    
    // Check for modifier in expression or as separate argument
    let modifier = 0;
    let tableExpression = expression;
    
    // Check if expression contains a modifier (e.g., "TableName +5")
    const modMatch = expression.match(/^(.+?)\s*([+\-]\d+)$/);
    if (modMatch) {
      tableExpression = modMatch[1].trim();
      modifier = parseInt(modMatch[2], 10);
    } else if (process.argv[4] && /^[+\-]\d+$/.test(process.argv[4])) {
      // Check if next argument is a modifier
      modifier = parseInt(process.argv[4], 10);
    }
    
    try {
      helper.loadTablesSync('./tables');
      const result = helper.roll(tableExpression, 'default', 100, modifier);
      console.log('\nRoll Result:');
      console.log(helper.formatResult(result));
    } catch (error) {
      console.error('Error:', error.message);
    }
  } else if (command === 'dice') {
    // Roll simple dice
    const notation = process.argv[3] || '1d6';
    const result = helper.rollDice(notation);
    console.log(`${notation}: ${result}`);
  } else {
    printUsage();
  }
} else {
  printUsage();
}

function printUsage() {
  console.log(`
Table Helper - Markdown Table Manager with Random Rolling

Usage:
  node index.js load [tablesDir]            Load all tables from directory
  node index.js roll <expression> [+/-mod]  Roll on tables
  node index.js dice <notation>             Roll dice

Examples:
  node index.js load                        Load from ./tables/
  node index.js load ./my-tables            Load from ./my-tables/
  node index.js roll "Encounters"           Roll on Encounters table
  node index.js roll "Encounters" +5        Roll with +5 modifier
  node index.js roll "Encounters,Treasure"  Roll on multiple tables
  node index.js roll "Encounters>Details"   Chain tables together
  node index.js dice 2d6+3                  Roll dice

Roll Expression Syntax:
  - Simple: "TableName"
  - Sequential: "Table1,Table2,Table3"  (independent rolls)
  - Chained: "Table1>Table2>Table3"     (chained/related rolls)
  - With modifier: "TableName" +5       (adds modifier to dice roll)

Tables are loaded from .md files in the tables/ directory.
Each filename (without .md) becomes the table name.
`);
}

export { TableHelper };
