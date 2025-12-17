import type { RollResult } from "src/types/rolls/roll-result";
import type { Table } from "src/types/tables/table";
import type { TableRow } from "src/types/tables/table-row";
import { Dice } from "../dice/dice";

export class Roller {
    static rollOnTable(table: Table): RollResult {
        let rollResult: RollResult = {tableName: table.name, roll: 0, result: [], nestedResults: []};

        if (!table.diceColumn) {
            rollResult = Roller.rollOnNonDiceTable(table, rollResult);
        }  
        else{
            let matchedRow = Roller.rollOnDiceTable(table, rollResult);
            rollResult = this.rowToRollResult(table, matchedRow, diceRoll);
        }

        return rollResult;
    }

    private static matchRollToDiceTable(diceRoll: number, table: Table): TableRow | undefined {
               let matchedRow: TableRow | undefined;

        for (const row of table.rows ?? []) {
            if (row.range) {
                const [minStr, maxStr] = row.range.split("-").map(s => s.trim());
                const min = parseInt(minStr, 10);
                const max = parseInt(maxStr, 10);
                if (diceRoll >= min && diceRoll <= max) {
                    matchedRow = row;
                    break;
                }
            }
        }

        return matchedRow;
    }

    private static rollOnDiceTable(table: Table, rollResult: RollResult) : TableRow | undefined{
        const diceColumn = table.columns?.find(col => col.name === table.diceColumn);
        if (!diceColumn) {
            throw new Error(`Dice column "${table.diceColumn}" not found in table "${table.name}"`);
        }

        const diceRoll = Dice.roll(diceColumn.name);
        let matchedRow: TableRow | undefined;

        for (const row of table.rows ?? []) {
            if (row.range) {
                const [minStr, maxStr] = row.range.split("-").map(s => s.trim());
                const min = parseInt(minStr, 10);
                const max = parseInt(maxStr, 10);
                if (diceRoll >= min && diceRoll <= max) {
                    matchedRow = row;
                    break;
                }
            }
        }

        return matchedRow;

        if (matchedRow) {
            
        } else {
            throw new Error(`No matching row found for roll ${diceRoll} in table "${table.name}"`);
        }
        return rollResult;
    }

    private static rollOnNonDiceTable(table: Table, rollResult: RollResult) {
        const rowCount = table.rows?.length ?? 1;

        const roll = Dice.roll(`d${rowCount}`);

        let row = table.rows ? table.rows[roll - 1] : {};
        rollResult = this.rowToRollResult(table, row, roll);
        return rollResult;
    }


}