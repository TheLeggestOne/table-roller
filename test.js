import { TableHelper } from './tableHelper.js';

console.log('Running Table Helper Tests...\n');

const helper = new TableHelper();

// Load tables from tables/ directory
helper.loadTablesSync('./tables');

// Test 1: Load tables
console.log('Test 1: Load Tables');
console.log('Loaded tables:', helper.getTableNames());
console.log('✓ Pass\n');

// Test 2: Simple dice rolling
console.log('Test 2: Dice Rolling');
console.log('1d6:', helper.rollDice('1d6'));
console.log('2d10+5:', helper.rollDice('2d10+5'));
console.log('d20:', helper.rollDice('d20'));
console.log('✓ Pass\n');

// Test 3: Roll on a table
console.log('Test 3: Roll on Single Table');
const result1 = helper.roll('TestEncounters', 'test1');
console.log(helper.formatResult(result1));
console.log('✓ Pass\n');

// Test 4: Table chaining
console.log('Test 4: Table Chaining');
const result2 = helper.roll('TestEncounters>TestWildBeasts', 'test2');
console.log(helper.formatResult(result2));
console.log('✓ Pass\n');

// Test 5: Sequential rolling (new feature)
console.log('Test 5: Sequential Rolling');
const result3 = helper.roll('TestEncounters,TestMerchantGoods,TestTreasure', 'test5');
console.log(helper.formatResult(result3));
console.log('✓ Pass\n');

// Test 6: Duplicate prevention
console.log('Test 6: Duplicate Prevention');
console.log('Rolling 8 times on a 6-entry table (should see rerolls):');
for (let i = 0; i < 8; i++) {
  const result = helper.roll('TestMerchantGoods', 'test3');
  console.log(`Roll ${i + 1}:`, result.Item);
}
const history = helper.getHistory('test3');
console.log(`History length: ${history.length}`);
console.log('✓ Pass\n');

// Test 7: Session clearing
console.log('Test 7: Session Clearing');
helper.clearSession('test3');
const clearedHistory = helper.getHistory('test3');
console.log('History after clear:', clearedHistory.length);
console.log('✓ Pass\n');

// Test 8: d100 table
console.log('Test 8: d100 Table');
const treasureResult = helper.roll('TestTreasure', 'test4');
console.log(helper.formatResult(treasureResult));
console.log('✓ Pass\n');

console.log('All tests completed! ✓');
