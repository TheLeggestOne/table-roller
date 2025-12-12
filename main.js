const { Plugin } = require('obsidian');

module.exports = class TableRollerPlugin extends Plugin {
	async onload() {
		console.log('Loading Table Roller plugin');

		this.addCommand({
			id: 'roll-table',
			name: 'Roll on table',
			callback: () => {
				console.log('Roll table command triggered');
			}
		});
	}

	onunload() {
		console.log('Unloading Table Roller plugin');
	}
};
