
import fs from 'fs';
import { TableHelper } from './tableHelper.js';
import { DiceRoller } from './diceRoller.js';

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
    // Support: pnpm roll 10 dnd.race, pnpm roll 1d2 dnd.race, or pnpm roll dnd.race 10
    let times = 1;
    let tableExpression = process.argv[3];
    let modifier = 0;
    let argIdx = 4;
    // If the first argument is a number or dice notation, treat as times
    if (/^\d+$/.test(tableExpression) || /^(\d*)d\d+([+\-]\d+)?$/i.test(tableExpression)) {
      try {
        times = /^\d+$/.test(tableExpression)
          ? parseInt(tableExpression, 10)
          : DiceRoller.roll(tableExpression);
      } catch (e) {
        console.error('Invalid dice notation for number of rolls:', tableExpression);
        process.exit(1);
      }
      tableExpression = process.argv[4];
      argIdx = 5;
    }
    // Or if the next argument is a number or dice notation, treat as times
    else if (process.argv[4] && (/^\d+$/.test(process.argv[4]) || /^(\d*)d\d+([+\-]\d+)?$/i.test(process.argv[4]))) {
      try {
        times = /^\d+$/.test(process.argv[4])
          ? parseInt(process.argv[4], 10)
          : DiceRoller.roll(process.argv[4]);
      } catch (e) {
        console.error('Invalid dice notation for number of rolls:', process.argv[4]);
        process.exit(1);
      }
      argIdx = 5;
    }
    // Check for modifier in expression or as separate argument
    const modMatch = tableExpression.match(/^(.+?)\s*([+\-]\d+)$/);
    if (modMatch) {
      tableExpression = modMatch[1].trim();
      modifier = parseInt(modMatch[2], 10);
    } else if (process.argv[argIdx] && /^[+\-]\d+$/.test(process.argv[argIdx])) {
      modifier = parseInt(process.argv[argIdx], 10);
    }
    try {
      helper.loadTablesSync('./tables');
      let result;
      if (times > 1) {
        // Roll N times on the same table
        result = Array.from({ length: times }, () => helper.roll(tableExpression, 'default', 100, modifier));
      } else {
        result = helper.roll(tableExpression, 'default', 100, modifier);
      }
      console.log('\nRoll Result:');
      if (Array.isArray(result)) {
        result.forEach((r, i) => {
          console.log(`\n# Roll ${i + 1}\n${helper.formatResult(r)}`);
        });
      } else {
        console.log(helper.formatResult(result));
      }
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
