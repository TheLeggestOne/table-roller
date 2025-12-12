import { Plugin } from 'obsidian';
import { TableRollerCore } from './src/services/TableRollerCore';
import { TableSelectorModal, RollResultModal } from './src/ui/modals';

export default class TableRollerPlugin extends Plugin {
	private roller: TableRollerCore;

	async onload() {
		console.log('Loading Table Roller plugin');

		this.roller = new TableRollerCore(this.app);

		// Load tables on startup
		try {
			await this.roller.loadTables();
		} catch (error) {
			console.error('Error loading tables:', error);
		}

		// Register commands
		this.addCommand({
			id: 'roll-on-table',
			name: 'Roll on table',
			callback: () => {
				const tables = this.roller.getTableNames();

				if (tables.length === 0) {
					console.warn('No tables found with table-roller frontmatter');
					return;
				}

				new TableSelectorModal(this.app, tables, (tableNameWithModifier) => {
					try {
						// Parse modifier syntax: TableName@modifier
						let tableName = tableNameWithModifier;
						let modifier = 0;
						
						if (tableNameWithModifier.includes('@')) {
							const parts = tableNameWithModifier.split('@');
							tableName = parts[0];
							modifier = parseInt(parts[1]) || 0;
						}
						
						const performRoll = () => {
							const result = this.roller.roll(tableName, undefined, modifier);
							new RollResultModal(this.app, result, performRoll).open();
						};
						
						performRoll();
					} catch (error) {
						console.error('Error rolling on table:', error);
					}
				}).open();
			}
		});

		this.addCommand({
			id: 'reload-tables',
			name: 'Reload all tables',
			callback: async () => {
				try {
					await this.roller.loadTables();
					console.log('Tables reloaded successfully');
				} catch (error) {
					console.error('Error reloading tables:', error);
				}
			}
		});
	}

	onunload() {
		console.log('Unloading Table Roller plugin');
	}
}
