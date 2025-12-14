import { Plugin } from 'obsidian';
import { TableStore } from 'src/stores/table-store';
import { TABLE_ROLLER_VIEW_TYPE } from '../constants';
import { TableSideView } from '../table-side-view';

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

