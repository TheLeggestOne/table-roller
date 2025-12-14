import { ItemView, WorkspaceLeaf, Plugin } from 'obsidian';
import { TableStore } from 'src/stores/table-store';
import TableDisplay from 'src/ui/components/TableDisplay.svelte';

import { mount, unmount } from 'svelte';

export const TABLE_ROLLER_VIEW_TYPE = 'table-roller-core-view';

export default class TableRollerPlugin extends Plugin {
  tableStore: TableStore = new TableStore(this.app);

  async onload() {
    this.registerView(
      TABLE_ROLLER_VIEW_TYPE,
      (leaf) => new TableSideView(leaf, this.tableStore)
    );

    this.addRibbonIcon('dice', 'Table Roller', () => {
      this.activateView();
    });
  }

  async onunload() {
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(TABLE_ROLLER_VIEW_TYPE)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: TABLE_ROLLER_VIEW_TYPE,
          active: true,
        });
        leaf = rightLeaf;
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
}

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