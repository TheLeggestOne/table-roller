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

				const selectorModal = new TableSelectorModal(this.app, tables, (tableNameWithModifier) => {
					try {
						// Parse modifier syntax: TableName@modifier
						let tableName = tableNameWithModifier;
						let modifier = 0;
						
						if (tableNameWithModifier.includes('@')) {
							const parts = tableNameWithModifier.split('@');
							tableName = parts[0];
							modifier = parseInt(parts[1]) || 0;
						}
						
						const showRollNumbers = selectorModal.showRollNumbers;
						
						const performRoll = () => {
							const result = this.roller.roll(tableName, undefined, modifier);
							new RollResultModal(this.app, result, performRoll, showRollNumbers).open();
						};
						
						performRoll();
					} catch (error) {
						console.error('Error rolling on table:', error);
					}
				}, this.roller);
				selectorModal.open();
			}
		});

		this.addCommand({
			id: 'mark-as-table',
			name: 'Mark current file as table',
			callback: async () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile || activeFile.extension !== 'md') {
					console.warn('No active markdown file');
					return;
				}

				try {
					const content = await this.app.vault.read(activeFile);
					const lines = content.split('\n');
					
					// Check if frontmatter exists
					if (lines[0] === '---') {
						// Find end of frontmatter
						let endIndex = -1;
						for (let i = 1; i < lines.length; i++) {
							if (lines[i] === '---') {
								endIndex = i;
								break;
							}
						}
						
						if (endIndex > 0) {
							// Check if table-roller property exists
							let hasProperty = false;
							for (let i = 1; i < endIndex; i++) {
								if (lines[i].match(/^table-roller\s*:/)) {
									lines[i] = 'table-roller: true';
									hasProperty = true;
									break;
								}
							}
							
							// Add property if it doesn't exist
							if (!hasProperty) {
								lines.splice(endIndex, 0, 'table-roller: true');
							}
						}
					} else {
						// No frontmatter, add it
						lines.unshift('---', 'table-roller: true', '---', '');
					}
					
					await this.app.vault.modify(activeFile, lines.join('\n'));
					console.log('File marked as table-roller');
				} catch (error) {
					console.error('Error marking file as table:', error);
				}
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
