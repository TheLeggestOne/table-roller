# Table Roller

A Node.js program for managing markdown tables with random rolling, table chaining, modifiers, and duplicate prevention.

## Features

- **Parse Markdown Tables**: Automatically extract tables from markdown files in nested directories
- **Dice Notation**: Support for standard dice notation (1d6, 2d10+5, d20, etc.)
- **Range-based Rolling**: Tables with range columns (1-3, 4-6, etc.)
- **Roll Modifiers**: Add modifiers to table rolls (e.g., +5, -2)
- **Table Chaining**: Chain multiple tables together with `>` operator
- **Sequential Rolling**: Roll on multiple independent tables with `,` operator
- **Auto-Reroll**: Special `reroll` column automatically triggers subsequent table rolls
- **Session Tracking**: Prevent duplicate results within a session
- **Automatic Rerolling**: Automatically rerolls duplicates up to max attempts
- **Case-Insensitive**: Table names are case-insensitive for convenience

## Installation

```bash
npm install
```

## Usage

### Command Line Interface

```bash
# Load and view tables from tables/ directory (scans recursively)
node index.js load
npm run load

# Load from a custom directory
node index.js load ./my-tables

# Roll on a single table
node index.js roll "Encounters"
npm run roll "Encounters"

# Roll with a modifier
node index.js roll "Encounters" +5
node index.js roll "Encounters +5"

# Roll on multiple tables sequentially (independent rolls)
node index.js roll "BuildingType,Size,Occupants"
npm run roll "BuildingType,Size,Occupants"

# Roll on chained tables (related rolls)
node index.js roll "Encounters>WildBeasts"
npm run roll "Encounters>WildBeasts"

# Mix modifiers with table rolls
node index.js roll "BuildingType+2,Size-1"

# Roll dice with standard notation
node index.js dice 1d6
npm run dice 1d6
npm run dice 2d10+5
```

### Programmatic Usage

```javascript
import { TableHelper } from './tableHelper.js';

const helper = new TableHelper();

// Load all tables from tables/ directory (recursively scans subdirectories)
helper.loadTablesSync('./tables');

// Roll on a single table
const result = helper.roll('Encounters');
console.log(helper.formatResult(result));

// Roll with a modifier
const modifiedResult = helper.roll('Encounters', 'default', 100, 5); // +5 modifier
console.log(helper.formatResult(modifiedResult));

// Roll on multiple tables sequentially (independent rolls)
const results = helper.roll('Encounters,MerchantGoods,Treasure');
console.log(helper.formatResult(results));

// Roll with chaining
const chainedResult = helper.roll('Encounters>WildBeasts');
console.log(helper.formatResult(chainedResult));

// Mix modifiers in the expression
const mixedResult = helper.roll('BuildingType+2,Size-1');
console.log(helper.formatResult(mixedResult));

// Roll simple dice
const diceResult = helper.rollDice('2d6+3');
console.log(diceResult);

// View session history
const history = helper.getHistory();
console.log(history);

// Clear session to allow duplicates again
helper.clearSession();

// Get all loaded table names
const tableNames = helper.getTableNames();
console.log(tableNames);

// Get specific table
const table = helper.getTable('Encounters');
console.log(table);
```

## Markdown Table Format

Tables should be in `.md` files in the `tables/` directory or its subdirectories. The filename (without `.md`) becomes the table name.

**Example: `tables/Encounters.md`**

```markdown
| d6 | Encounter Type | Details |
|----|----------------|---------|
| 1-2 | Peaceful | A friendly traveler |
| 3-4 | Neutral | Wild animals passing by |
| 5-6 | Hostile | Bandits demand toll |
```

### Special Columns

#### Dice Column
The first column with a dice notation header (e.g., `d6`, `d20`, `d100`) is used for rolling. If no dice column exists, the first column is used.

#### Reroll Column
A special `reroll` column triggers automatic subsequent rolls on other tables:

```markdown
| d6 | Event | reroll |
|----|-------|--------|
| 1-2 | Market Day | MerchantGoods |
| 3-4 | Encounter | Encounters>WildBeasts |
| 5 | Discovery | Treasure |
| 6 | Complex Event | BuildingType,Occupants |
```

When a row with a reroll value is selected, the program automatically rolls on the specified table(s) and includes those results in the output. The reroll column supports:
- Single table: `MerchantGoods`
- Chained tables: `Encounters>WildBeasts`
- Sequential tables: `BuildingType,Occupants`

### Supported Range Formats

- Single numbers: `1`, `2`, `3`
- Ranges: `1-3`, `4-6`, `10-20`
- Dice columns: `d6`, `d20`, `d100`

The program automatically detects the dice column or uses the first column for rolling.

## Rolling Modes

### Simple Roll

Roll on a single table:

```bash
node index.js roll "Encounters"
```

### Roll with Modifiers

Add or subtract from the dice roll:

```bash
# Add 5 to the roll
node index.js roll "Encounters" +5
node index.js roll "Encounters +5"

# Subtract 2 from the roll
node index.js roll "Encounters -2"
```

Modifiers can be applied globally or per-table in expressions.

### Sequential Rolling (Independent Tables)

Use commas to roll on multiple tables independently:

```bash
node index.js roll "Encounters,MerchantGoods,Treasure"
```

This will:
1. Roll on the "Encounters" table
2. Roll on the "MerchantGoods" table  
3. Roll on the "Treasure" table
4. Return all three results as separate, independent entries

You can add modifiers to individual tables:

```bash
node index.js roll "BuildingType+2,Size-1,Occupants"
```

### Table Chaining (Nested Results)

Chain tables using the `>` operator to nest results hierarchically:

```bash
node index.js roll "Encounters>WildBeasts"
```

This will:
1. Roll on the "Encounters" table
2. Roll on the "WildBeasts" table
3. Display the WildBeasts result nested under the Encounters result

**Key difference**: Chaining doesn't change the rolling mechanics—it only affects how results are displayed in the output. Chained results are indented/nested to show that the second table is a detail or expansion of the first table's result.

### Auto-Reroll Tables

Tables with a `reroll` column automatically trigger subsequent rolls:

```markdown
| d6 | Event | reroll |
|----|-------|--------|
| 1-2 | Market | MerchantGoods |
| 3-4 | Battle | Encounters>WildBeasts |
```

When you roll and get a row with a reroll value, the program automatically processes that expression and includes the results.

## Session Tracking

The session tracker prevents duplicate results within a session:

- Each roll is tracked within a session
- Duplicate results are automatically rerolled (up to max attempts)
- Sessions can be named (default: "default")
- Clear sessions to allow previous results again
- If all table results have been exhausted, duplicates are allowed with a warning

```javascript
// Use custom session ID
helper.roll('Encounters', 'session1');

// Clear specific session
helper.clearSession('session1');

// View session history
helper.getHistory('session1');
```

## Examples

See the `tables/Tests/` directory for sample tables demonstrating all features:
- `TestEncounters.md` - Random encounter table
- `TestWildBeasts.md` - Creature types
- `TestMerchantGoods.md` - Shop items
- `TestTreasure.md` - Treasure table (d100)
- `TestRerollExample.md` - Demonstrates the auto-reroll feature
- `TestBuildingType.md` - Building types
- `TestSize.md` - Size variations
- `TestOccupants.md` - Who or what occupies a location

## API Reference

### TableHelper

#### Methods

- `loadTablesSync(tablesDir)` - Load all tables from directory (recursively scans subdirectories)
- `loadTables(tablesDir)` - Async version of loadTablesSync
- `roll(expression, sessionId, maxAttempts, modifier)` - Roll on table(s) with optional modifier
  - `expression`: Table name, comma-separated list, or chained expression
  - `sessionId`: Session identifier (default: "default")
  - `maxAttempts`: Max reroll attempts for duplicates (default: 100)
  - `modifier`: Global modifier to add to all rolls (default: 0)
- `rollSingle(tableName, sessionId, maxAttempts, modifier)` - Roll on single table
- `rollSequence(tableNames, sessionId, modifier)` - Roll on multiple tables sequentially
- `parseTableNameWithModifier(tableExpression)` - Parse table name with inline modifier (e.g., "Table+5")
- `rollDice(notation)` - Roll dice using standard notation
- `getTableNames()` - Get list of loaded table names
- `getTable(name)` - Get specific table (case-insensitive)
- `findTableName(name)` - Find actual table name with case-insensitive matching
- `getHistory(sessionId)` - Get roll history for session
- `clearSession(sessionId)` - Clear session tracking
- `getDiceColumn(table)` - Determine which column to use for dice rolling
- `formatResult(result)` - Format result for display
- `formatSingleResult(result, isNested)` - Format a single result with chains/rerolls
- `findMarkdownFiles(dir)` - Recursively find all .md files in directory

#### Result Object Structure

Roll results include:
- Column values from the table row
- `_tableName`: Name of the table rolled on
- `_roll`: Final roll result (with modifier applied)
- `_baseRoll`: Original roll before modifier
- `_modifier`: Modifier applied to the roll
- `_chain`: Previous result in a chained roll
- `_rerolls`: Results from auto-reroll column (if present)

### DiceRoller

- `roll(notation)` - Roll dice (e.g., "1d6", "2d10+5", "d20")
- `rollOnTable(rows, rangeColumn, modifier)` - Roll on table rows with optional modifier
- `isInRange(num, range)` - Check if number is in range string (e.g., "1-3", "5-10")

### TableParser

- `parseTables(content, defaultName)` - Parse all tables from markdown content
- `parseTable(lines)` - Parse single table from markdown lines

### SessionTracker

- `createSession(sessionId)` - Create new session
- `addResult(sessionId, tableName, result)` - Record result in session
- `isDuplicate(sessionId, tableName, result)` - Check if result is duplicate
- `getResults(sessionId, tableName)` - Get all results for table in session
- `getHistory(sessionId)` - Get session history
- `clearSession(sessionId)` - Clear session data

## License

MIT
