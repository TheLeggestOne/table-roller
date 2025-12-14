import { type Table } from "src/types/tables/table";
import { type Writable, writable, get } from "svelte/store";
import type { App } from "obsidian"; 
import { TableParser } from "src/services/tables/table-parser";

export class TableStore implements Writable<Table[]> {
    private _store: Writable<Table[]> = writable<Table[]>([]);

    subscribe = this._store.subscribe
    set = this._store.set
    update = this._store.update
    app: App;

    constructor(app: App) {
        console.debug(`Creating new TableStore instance`);
        this.app = app;
        this._store = writable<Table[]>([]);
    }

    async reloadTables() {
        // Get all markdown files
        let files = this.app.vault.getMarkdownFiles();

        // Filter files asynchronously based on frontmatter key
        let tables = [];
        for (const file of files) {
            const content = await this.app.vault.read(file);
            if(TableParser.isTableParserTable(file.path, content)) {
                let table = TableParser.parseTable(file.path, content);
                tables.push(table);
            }
        }

        this.set(tables);
    }
}