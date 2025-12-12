import { Plugin } from 'obsidian';
import { RuntimeAdapter } from '../services/runtime/index.js';
import { TableRollerCore } from '../services/core/index.js';

export default class TableRollerPlugin extends Plugin {
	async onload() {
		console.log('Loading Table Roller plugin');

		// Initialize runtime adapter for plugin mode
		this.runtime = new RuntimeAdapter('plugin');
		await this.runtime.initialize({ vault: this.app.vault });

		// Initialize core roller
		this.roller = new TableRollerCore(this.runtime);

		// Load tables from vault
		try {
			await this.roller.loadTables('tables');
			console.log('Loaded tables:', this.roller.getTableNames().join(', '));
		} catch (error) {
			console.error('Error loading tables:', error);
		}

		this.addCommand({
			id: 'roll-table',
			name: 'Roll on table',
			callback: () => {
				console.log('Roll table command triggered');
				// TODO: Add table selection UI
			}
		});
	}

	onunload() {
		console.log('Unloading Table Roller plugin');
	}
}
