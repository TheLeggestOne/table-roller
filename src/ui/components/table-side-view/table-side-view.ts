import { mount, unmount } from "svelte";
import { ItemView, WorkspaceLeaf } from "obsidian"; 
import type { TableStore } from "src/stores/table-store";
import { TABLE_ROLLER_VIEW_TYPE } from "../constants";
import TableDisplay from "./TableDisplay.svelte";

export class TableSideView extends ItemView {
  tableDisplay: ReturnType<typeof TableDisplay> | undefined;
  tableStore: TableStore;

  constructor(leaf: WorkspaceLeaf, tableStore: TableStore) {
    super(leaf);
    this.tableStore = tableStore;
  }

  getViewType() {
    return TABLE_ROLLER_VIEW_TYPE;
  }

  getDisplayText() {
    return 'Table Roller';
  }

  async onOpen() {
    this.tableDisplay = mount(TableDisplay, {
      target: this.contentEl,
      props: {
        Header: "Table Roller",
        tableStore: this.tableStore
      }
    });
  }

  async onClose() {
    if (this.tableDisplay) {
      unmount(this.tableDisplay);
    }
  }
}