import type { RollResult } from "src/types/rolls/roll-result";
import type { Table } from "src/types/tables/table";
import type { TableRow } from "src/types/tables/table-row";
import type { TableRollingService } from "./table-rolling-service";

export class NonDiceTableRollingService implements TableRollingService {

    rollOnTable(table: Table): RollResult {
        
    }
    matchRollToTableRow(roll: number, table: Table): TableRow | undefined {
        throw new Error("Method not implemented.");
    }
    convertRowToRollResult(table: Table, row: TableRow, roll: number): RollResult {
        throw new Error("Method not implemented.");
    }

}