# Table Helper

A Node.js program for managing markdown tables with random rolling, table chaining, and duplicate prevention.

## Features

- **Parse Markdown Tables**: Automatically extract tables from markdown files
- **Dice Notation**: Support for standard dice notation (1d6, 2d10+5, d20, etc.)
- **Range-based Rolling**: Tables with range columns (1-3, 4-6, etc.)
- **Table Chaining**: Chain multiple tables together for complex results
- **Session Tracking**: Prevent duplicate results within a session
- **Automatic Rerolling**: Automatically rerolls duplicates

## Installation

```bash
npm install
```

## Usage

### Command Line Interface

```bash
# Load and view tables from tables/ directory
node index.js load
npm run load

# Load from a custom directory
node index.js load ./my-tables

# Roll on a single table
node index.js roll "Encounters"
npm run roll "Encounters"

# Roll on multiple tables sequentially (independent rolls)
node index.js roll "BuildingType,Size,Occupants"
npm run roll "BuildingType,Size,Occupants"

# Roll on chained tables (related rolls)
node index.js roll "Encounters>WildBeasts"
npm run roll "Encounters>WildBeasts"

# Roll dice with standard notation
node index.js dice 1d6
npm run dice 1d6
npm run dice 2d10+5
```

### Programmatic Usage

```javascript
import { TableHelper } from './tableHelper.js';

const helper = new TableHelper();

// Load all tables from tables/ directory
helper.loadTablesSync('./tables');

// Roll on a single table
const result = helper.roll('Encounters');
console.log(helper.formatResult(result));

// Roll on multiple tables sequentially
const results = helper.roll('Encounters,MerchantGoods,Treasure');
console.log(helper.formatResult(results));

// Roll with chaining
const chainedResult = helper.roll('Encounters>WildBeasts');
console.log(helper.formatResult(chainedResult));

// Roll simple dice
const diceResult = helper.rollDice('2d6+3');
console.log(diceResult);

// View session history
const history = helper.getHistory();
console.log(history);

// Clear session to allow duplicates again
helper.clearSession();
```

## Markdown Table Format

Each table should be in its own `.md` file in the `tables/` directory. The filename (without `.md`) becomes the table name.

**Example: `tables/Encounters.md`**

```markdown
| d6 | Column1 | Column2 |
|----|---------|---------|
| 1-2 | Value A | Detail A |
| 3-4 | Value B | Detail B |
| 5-6 | Value C | Detail C |
```

### Supported Range Formats

- Single numbers: `1`, `2`, `3`
- Ranges: `1-3`, `4-6`, `10-20`
- Dice columns: `d6`, `d20`, `d100`

The program automatically detects the dice column (e.g., `d6`, `d100`) or uses the first column for rolling.

## Rolling Modes

### Sequential Rolling (Independent Tables)

Use commas to roll on multiple tables independently:

```bash
node index.js roll "Encounters,MerchantGoods,Treasure"
```

This will:
1. Roll on the "Encounters" table
2. Roll on the "MerchantGoods" table  
3. Roll on the "Treasure" table
4. Return all three results separately

## Table Chaining (Related Rolls)

Chain tables using the `>` operator:

```bash
node index.js roll "Encounters>WildBeasts"
```

This will:
1. Roll on the "Encounters" table
2. Based on the result, roll on the "WildBeasts" table
3. Return both results linked together

## Session Tracking

The session tracker prevents duplicate results:

- Each roll is tracked within a session
- Duplicate results are automatically rerolled
- Sessions can be named (default: "default")
- Clear sessions to allow previous results again

```javascript
// Use custom session ID
helper.roll('Encounters', 'session1');

// Clear specific session
helper.clearSession('session1');

// View session history
helper.getHistory('session1');
```

## Examples

See the `tables/` directory for sample tables:
- `Encounters.md` - Random encounter table
- `WildBeasts.md` - Creature types
- `MerchantGoods.md` - Shop items
- `Treasure.md` - Treasure table (d100)

## API Reference

### TableHelper

- `loadTablesSync(tablesDir)` - Load all tables from directory
- `roll(expression, sessionId, maxAttempts)` - Roll on table(s)
- `rollSingle(tableName, sessionId, maxAttempts)` - Roll on single table
- `rollSequence(tableNames, sessionId)` - Roll on multiple tables sequentially
- `rollDice(notation)` - Roll dice using standard notation
- `getTableNames()` - Get list of loaded table names
- `getTable(name)` - Get specific table
- `getHistory(sessionId)` - Get roll history
- `clearSession(sessionId)` - Clear session tracking
- `formatResult(result)` - Format result for display

### DiceRoller

- `roll(notation)` - Roll dice (e.g., "1d6", "2d10+5")
- `rollOnTable(rows, rangeColumn)` - Roll on table rows
- `isInRange(num, range)` - Check if number is in range string

### TableParser

- `parseTables(content)` - Parse all tables from markdown
- `parseTable(lines)` - Parse single table

### SessionTracker

- `createSession(sessionId)` - Create new session
- `addResult(sessionId, tableName, result)` - Record result
- `isDuplicate(sessionId, tableName, result)` - Check for duplicate
- `getResults(sessionId, tableName)` - Get all results
- `getHistory(sessionId)` - Get session history
- `clearSession(sessionId)` - Clear session

## License

MIT
