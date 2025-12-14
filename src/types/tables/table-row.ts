export interface TableRow {
    range?: string; // For dice columns
    [columnName: string]: string | undefined;
}
