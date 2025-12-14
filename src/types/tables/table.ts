import type { TableColumn } from "./table-column";
import type { TableRow } from "./table-row";

export interface Table {
    name: string;
    columns?: TableColumn[];
    rows?: TableRow[];
    rerollTable?: string; // Table-level reroll
    isHidden?: boolean; // Hide from main table picker
    diceColumn?: string | undefined; // Name (and dice notation) of the dice column
}