export class RollResult {
    tableName: string;
    roll: number;
    result: Record<string, string>[];
    nestedResults?: RollResult[];

    constructor(
        tableName: string, 
        roll: number,
        result: Record<string, string>[],
        nestedResults?: RollResult[]
    ) {
        this.tableName = tableName;
        this.roll = roll;
        this.result = result;
        this.nestedResults = nestedResults;
    }
}