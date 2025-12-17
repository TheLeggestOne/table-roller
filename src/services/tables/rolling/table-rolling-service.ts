import type { RollResult } from "src/types/rolls/roll-result";
import type { Table } from "src/types/tables/table";
import type { TableRow } from "src/types/tables/table-row";

export class BaseTableRollingService {
    static rowToRollResult(table: Table, row: TableRow, roll: number): RollResult {
        let values: { [key: string]: any } = {};
        if (row.values && typeof row.values === "object" && !Array.isArray(row.values)) {
            values = row.values as { [key: string]: any };
        }

        return {
            tableName: table.name,
            roll: roll,
            result: table.columns?.map(col => ({
                columnName: col.name,
                value: values[col.name] ?? null
            })) ?? [],
            nestedResults: []
        };
    }
}