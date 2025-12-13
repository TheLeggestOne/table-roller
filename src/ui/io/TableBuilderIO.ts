import { App, TFile, Notice, Modal } from 'obsidian';
import { TableParser } from '../../services/TableParser';

/**
 * TableBuilderState interface for internal state management
 */
interface ColumnConfig {
	name: string;
	type: 'dice' | 'regular' | 'reroll';
	diceNotation?: string;
}

interface RowData {
	range?: string;
	[columnName: string]: string | undefined;
}

interface TableState {
	tableName: string;
	columns: ColumnConfig[];
	rows: RowData[];
	isPrivate: boolean;
	tableReroll?: string;
}

/**
 * Custom events dispatched by TableIO
 */
export interface TableIOEvents {
	'file-saved': { file: TFile; tableName: string };
	'file-loaded': { file: TFile; tableName: string; state: TableState };
	'file-appended': { file: TFile; tableName: string };
	'template-saved': { filename: string; templateName: string };
	'export-completed': { format: string; content: string };
}

/**
 * Options for save operations
 */
export interface SaveOptions {
	filename?: string;
	file?: TFile;
	overwrite?: boolean;
}

/**
 * Options for export operations
 */
export interface ExportOptions {
	format: 'md' | 'csv' | 'json';
	includeMetadata?: boolean;
}

/**
 * TableIO - Handles all file I/O operations for the Table Builder
 * 
 * This class encapsulates file operations including:
 * - Save/SaveAs operations
 * - Load table from file
 * - Append to existing file
 * - Export operations (markdown, CSV, JSON)
 * - Template save/load operations
 * - Table picker modal logic
 * 
 * All operations dispatch CustomEvents for state management and provide
 * user feedback via Notices. Error handling is done internally with try-catch.
 */
export class TableIO extends EventTarget {
	private app: App;
	private currentFile: TFile | null;
	private parser: TableParser;
	private state: TableState;

	constructor(app: App, currentFile: TFile | null, parser: TableParser) {
		super();
		this.app = app;
		this.currentFile = currentFile;
		this.parser = parser;
		this.state = this.getDefaultState();
	}

	/**
	 * Get the default table state
	 */
	private getDefaultState(): TableState {
		return {
			tableName: 'New Table',
			columns: [
				{ name: 'd6', type: 'dice', diceNotation: 'd6' },
				{ name: 'Result', type: 'regular' }
			],
			rows: [],
			isPrivate: false
		};
	}

	/**
	 * Set the current state (called from view)
	 */
	public setState(state: TableState): void {
		this.state = state;
	}

	/**
	 * Get the current file
	 */
	public getCurrentFile(): TFile | null {
		return this.currentFile;
	}

	/**
	 * Set the current file
	 */
	public setCurrentFile(file: TFile | null): void {
		this.currentFile = file;
	}

	/**
	 * Generate markdown content from state
	 */
	private generateMarkdown(state: TableState): string {
		const lines: string[] = [];

		// Frontmatter
		lines.push('---');
		lines.push('table-roller: true');
		lines.push('---');
		lines.push('');

		// Table heading
		lines.push(`# ${state.tableName}`);
		lines.push('');

		// Directives
		if (state.isPrivate) {
			lines.push('private: true');
		}
		if (state.tableReroll) {
			lines.push(`reroll: ${state.tableReroll}`);
		}
		if (state.isPrivate || state.tableReroll) {
			lines.push('');
		}

		// Table headers
		const headers = state.columns.map(col => col.name);
		lines.push('| ' + headers.join(' | ') + ' |');
		lines.push('|' + headers.map(() => '----').join('|') + '|');

		// Table rows
		state.rows.forEach(row => {
			const cells = state.columns.map(col => {
				const key = col.type === 'dice' ? 'range' : col.name;
				return row[key] || '';
			});
			lines.push('| ' + cells.join(' | ') + ' |');
		});

		return lines.join('\n');
	}

	/**
	 * Generate CSV content from state
	 */
	private generateCSV(state: TableState): string {
		const headers = state.columns.map(col => col.name);
		const lines = [headers.join(',')];

		state.rows.forEach(row => {
			const cells = state.columns.map(col => {
				const key = col.type === 'dice' ? 'range' : col.name;
				const value = row[key] || '';
				// Escape commas and quotes
				return value.includes(',') || value.includes('"') 
					? `"${value.replace(/"/g, '""')}"` 
					: value;
			});
			lines.push(cells.join(','));
		});

		return lines.join('\n');
	}

	/**
	 * Generate JSON content from state
	 */
	private generateJSON(state: TableState): string {
		return JSON.stringify({
			tableName: state.tableName,
			isPrivate: state.isPrivate,
			tableReroll: state.tableReroll,
			columns: state.columns,
			rows: state.rows
		}, null, 2);
	}

	/**
	 * Save table to current file or prompt for new file
	 */
	public async save(): Promise<void> {
		try {
			// If we have a current file, save directly to it
			if (this.currentFile) {
				await this.saveToCurrentFile();
			} else {
				// Otherwise, show save options
				await this.saveAs();
			}
		} catch (error) {
			console.error('Error in save:', error);
			new Notice('Failed to save table');
		}
	}

	/**
	 * Show save as dialog (new file or append)
	 */
	public async saveAs(): Promise<void> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Save Table As');

			const createNewBtn = modal.contentEl.createEl('button', {
				text: 'Create New File',
				cls: 'table-builder-btn'
			});
			createNewBtn.style.width = '100%';
			createNewBtn.style.marginBottom = '8px';
			createNewBtn.addEventListener('click', async () => {
				modal.close();
				await this.saveToNewFile();
				resolve();
			});

			const appendBtn = modal.contentEl.createEl('button', {
				text: 'Append to Existing File',
				cls: 'table-builder-btn'
			});
			appendBtn.style.width = '100%';
			appendBtn.addEventListener('click', async () => {
				modal.close();
				await this.appendToFile();
				resolve();
			});

			modal.onClose = () => resolve();
			modal.open();
		});
	}

	/**
	 * Save to a new file with user-specified filename
	 */
	public async saveToNewFile(): Promise<void> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Save to New File');

			const input = modal.contentEl.createEl('input', {
				type: 'text',
				placeholder: 'Filename (without .md)',
				value: this.state.tableName
			});
			input.style.width = '100%';
			input.style.padding = '8px';
			input.style.marginBottom = '12px';

			const btnContainer = modal.contentEl.createDiv();
			btnContainer.style.display = 'flex';
			btnContainer.style.justifyContent = 'flex-end';
			btnContainer.style.gap = '8px';

			const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
			cancelBtn.addEventListener('click', () => {
				modal.close();
				resolve();
			});

			const saveBtn = btnContainer.createEl('button', { text: 'Save' });
			saveBtn.addEventListener('click', async () => {
				const filename = input.value.trim();
				if (!filename) {
					new Notice('Filename cannot be empty');
					return;
				}

				const fullFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
				const markdown = this.generateMarkdown(this.state);

				try {
					const file = await this.app.vault.create(fullFilename, markdown);
					new Notice(`Saved to ${fullFilename}`);
					this.currentFile = file;

					// Dispatch event
					this.dispatchEvent(new CustomEvent('file-saved', {
						detail: { file, tableName: this.state.tableName }
					}));

					modal.close();
					resolve();
				} catch (error) {
					console.error('Error saving file:', error);
					new Notice('Failed to save file');
				}
			});

			input.addEventListener('keypress', (e) => {
				if (e.key === 'Enter') {
					saveBtn.click();
				}
			});

			modal.onClose = () => resolve();
			modal.open();
			input.focus();
		});
	}

	/**
	 * Save to the current file (update existing table)
	 */
	public async saveToCurrentFile(): Promise<void> {
		if (!this.currentFile) {
			new Notice('No current file to save to');
			return;
		}

		try {
			const currentContent = await this.app.vault.read(this.currentFile);
			const markdown = this.generateMarkdown(this.state);

			// Try to find and replace the existing table in the file
			const tableName = this.state.tableName;
			const lines = currentContent.split('\n');
			let tableStartIndex = -1;
			let tableEndIndex = -1;

			// Find the heading for this table
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i].trim();
				const headingMatch = line.match(/^#+\s*(.+)$/);
				if (headingMatch && headingMatch[1].trim() === tableName.trim()) {
					tableStartIndex = i;
					break;
				}
			}

			if (tableStartIndex !== -1) {
				// Find the end of this table
				tableEndIndex = tableStartIndex;

				for (let i = tableStartIndex + 1; i < lines.length; i++) {
					const line = lines[i].trim();
					// Stop if we hit another heading
					if (line.match(/^#+\s+/)) {
						break;
					}
					tableEndIndex = i;
				}

				// Trim trailing empty lines
				while (tableEndIndex > tableStartIndex && lines[tableEndIndex].trim() === '') {
					tableEndIndex--;
				}

				// Extract just the table content (without frontmatter)
				const markdownLines = markdown.split('\n');
				const tableContentStart = markdownLines.findIndex(l => l.match(/^#+\s+/));
				const newTableContent = markdownLines.slice(tableContentStart).join('\n');

				// Replace the old table with the new one
				const before = lines.slice(0, tableStartIndex);
				const after = lines.slice(tableEndIndex + 1);

				// Clean up empty lines
				while (before.length > 0 && before[before.length - 1].trim() === '') {
					before.pop();
				}
				while (after.length > 0 && after[0].trim() === '') {
					after.shift();
				}

				const newContent = [...before, '', newTableContent, '', ...after].join('\n');
				await this.app.vault.modify(this.currentFile, newContent);
				new Notice(`Saved to ${this.currentFile.path}`);
			} else {
				// Table not found, append to end
				const markdownLines = markdown.split('\n');
				const tableContentStart = markdownLines.findIndex(l => l.startsWith('#'));
				const newTableContent = markdownLines.slice(tableContentStart).join('\n');

				const newContent = currentContent + '\n\n' + newTableContent;
				await this.app.vault.modify(this.currentFile, newContent);
				new Notice(`Table added to ${this.currentFile.path}`);
			}

			// Dispatch event
			this.dispatchEvent(new CustomEvent('file-saved', {
				detail: { file: this.currentFile, tableName: this.state.tableName }
			}));
		} catch (error) {
			console.error('Error saving to current file:', error);
			new Notice('Failed to save to file');
		}
	}

	/**
	 * Show file picker and append table to selected file
	 */
	public async appendToFile(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles()
			.filter(f => !f.path.startsWith('.table-templates/'));

		if (files.length === 0) {
			new Notice('No markdown files found');
			return;
		}

		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Select File to Append To');

			const fileList = modal.contentEl.createDiv({ cls: 'file-list' });
			fileList.style.maxHeight = '400px';
			fileList.style.overflowY = 'auto';

			files.forEach(file => {
				const fileBtn = fileList.createEl('button', {
					text: file.path,
					cls: 'file-option'
				});
				fileBtn.style.display = 'block';
				fileBtn.style.width = '100%';
				fileBtn.style.textAlign = 'left';
				fileBtn.style.padding = '8px';
				fileBtn.style.marginBottom = '4px';
				fileBtn.style.border = '1px solid var(--background-modifier-border)';
				fileBtn.style.background = 'var(--background-secondary)';
				fileBtn.style.cursor = 'pointer';

				fileBtn.addEventListener('click', async () => {
					modal.close();
					await this.appendToSpecificFile(file);
					resolve();
				});

				fileBtn.addEventListener('mouseenter', () => {
					fileBtn.style.background = 'var(--background-modifier-hover)';
				});
				fileBtn.addEventListener('mouseleave', () => {
					fileBtn.style.background = 'var(--background-secondary)';
				});
			});

			modal.onClose = () => resolve();
			modal.open();
		});
	}

	/**
	 * Append table to a specific file
	 */
	public async appendToSpecificFile(file: TFile): Promise<void> {
		try {
			const currentContent = await this.app.vault.read(file);
			const markdown = this.generateMarkdown(this.state);

			// Extract just the table part (without frontmatter)
			const lines = markdown.split('\n');
			const tableStartIndex = lines.findIndex(l => l.startsWith('#'));
			const tableContent = lines.slice(tableStartIndex).join('\n');

			// Append to file
			const newContent = currentContent + '\n\n' + tableContent;
			await this.app.vault.modify(file, newContent);

			new Notice(`Appended to ${file.path}`);
			this.currentFile = file;

			// Dispatch event
			this.dispatchEvent(new CustomEvent('file-appended', {
				detail: { file, tableName: this.state.tableName }
			}));
		} catch (error) {
			console.error('Error appending to file:', error);
			new Notice('Failed to append to file');
		}
	}

	/**
	 * Load table from file with file picker
	 */
	public async load(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles()
			.filter(f => !f.path.startsWith('.table-templates/'));

		if (files.length === 0) {
			new Notice('No markdown files found');
			return;
		}

		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Load Table from File');

			const fileList = modal.contentEl.createDiv({ cls: 'file-list' });
			fileList.style.maxHeight = '400px';
			fileList.style.overflowY = 'auto';

			files.forEach(file => {
				const fileBtn = fileList.createEl('button', {
					text: file.path,
					cls: 'file-option'
				});
				fileBtn.style.display = 'block';
				fileBtn.style.width = '100%';
				fileBtn.style.textAlign = 'left';
				fileBtn.style.padding = '8px';
				fileBtn.style.marginBottom = '4px';
				fileBtn.style.border = '1px solid var(--background-modifier-border)';
				fileBtn.style.background = 'var(--background-secondary)';
				fileBtn.style.cursor = 'pointer';

				fileBtn.addEventListener('click', async () => {
					modal.close();
					await this.loadFromFile(file);
					resolve();
				});

				fileBtn.addEventListener('mouseenter', () => {
					fileBtn.style.background = 'var(--background-modifier-hover)';
				});
				fileBtn.addEventListener('mouseleave', () => {
					fileBtn.style.background = 'var(--background-secondary)';
				});
			});

			modal.onClose = () => resolve();
			modal.open();
		});
	}

	/**
	 * Load table from a specific file
	 */
	public async loadFromFile(file: TFile): Promise<void> {
		try {
			this.currentFile = file;
			const content = await this.app.vault.read(file);
			const parsed = TableParser.parseTables(content, file.basename);

			const tableNames = Object.keys(parsed.tables);

			if (tableNames.length === 0) {
				new Notice('No tables found in file');
				return;
			}

			if (tableNames.length === 1) {
				// Load the only table
				await this.loadParsedTable(tableNames[0], parsed.tables[tableNames[0]], parsed);
			} else {
				// Show table picker
				await this.showTablePicker(tableNames, parsed);
			}
		} catch (error) {
			console.error('Error loading table:', error);
			new Notice('Failed to load table');
		}
	}

	/**
	 * Show table picker modal when multiple tables exist in file
	 */
	private async showTablePicker(tableNames: string[], parsed: any): Promise<void> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Select Table');

			const tableList = modal.contentEl.createDiv({ cls: 'table-list' });

			tableNames.forEach(name => {
				const btn = tableList.createEl('button', {
					text: name,
					cls: 'table-option'
				});
				btn.style.display = 'block';
				btn.style.width = '100%';
				btn.style.textAlign = 'left';
				btn.style.padding = '8px';
				btn.style.marginBottom = '4px';
				btn.style.border = '1px solid var(--background-modifier-border)';
				btn.style.background = 'var(--background-secondary)';
				btn.style.cursor = 'pointer';

				btn.addEventListener('click', async () => {
					modal.close();
					await this.loadParsedTable(name, parsed.tables[name], parsed);
					resolve();
				});

				btn.addEventListener('mouseenter', () => {
					btn.style.background = 'var(--background-modifier-hover)';
				});
				btn.addEventListener('mouseleave', () => {
					btn.style.background = 'var(--background-secondary)';
				});
			});

			modal.onClose = () => resolve();
			modal.open();
		});
	}

	/**
	 * Load a parsed table into state
	 */
	private async loadParsedTable(tableName: string, table: any, parsed: any): Promise<void> {
		// Convert parsed table back to state
		const columns: ColumnConfig[] = [];
		const rows: RowData[] = [];

		if ('dice' in table) {
			// Dice table
			columns.push({
				name: table.dice,
				type: 'dice',
				diceNotation: table.dice
			});

			// Get other columns from first entry
			if (table.entries.length > 0) {
				const firstEntry = table.entries[0];
				if (firstEntry.columns) {
					for (const colName of Object.keys(firstEntry.columns)) {
						if (colName.toLowerCase() === 'reroll') {
							columns.push({ name: colName, type: 'reroll' });
						} else {
							columns.push({ name: colName, type: 'regular' });
						}
					}
				}
			}

			// Convert entries to rows
			for (const entry of table.entries) {
				const row: RowData = {
					range: entry.min === entry.max ? `${entry.min}` : `${entry.min}-${entry.max}`
				};

				if (entry.columns) {
					for (const [key, value] of Object.entries(entry.columns)) {
						row[key] = value as string;
					}
				}

				if (entry.reroll) {
					row.reroll = entry.reroll;
				}

				rows.push(row);
			}
		} else {
			// Simple table
			for (const header of table.headers) {
				if (header.toLowerCase() === 'reroll') {
					columns.push({ name: header, type: 'reroll' });
				} else {
					columns.push({ name: header, type: 'regular' });
				}
			}

			for (const row of table.rows) {
				rows.push({ ...row });
			}
		}

		// Update state
		this.state = {
			tableName: tableName,
			columns: columns,
			rows: rows,
			isPrivate: table.private || false,
			tableReroll: table.reroll
		};

		// Dispatch event
		this.dispatchEvent(new CustomEvent('file-loaded', {
			detail: {
				file: this.currentFile!,
				tableName: tableName,
				state: this.state
			}
		}));

		new Notice(`Loaded table: ${tableName}`);
	}

	/**
	 * Export table in specified format
	 */
	public async exportAs(format: 'md' | 'csv' | 'json'): Promise<void> {
		try {
			let content = '';

			switch (format) {
				case 'md':
					content = this.generateMarkdown(this.state);
					break;
				case 'csv':
					content = this.generateCSV(this.state);
					break;
				case 'json':
					content = this.generateJSON(this.state);
					break;
			}

			// Copy to clipboard
			await navigator.clipboard.writeText(content);
			new Notice(`${format.toUpperCase()} copied to clipboard`);

			// Dispatch event
			this.dispatchEvent(new CustomEvent('export-completed', {
				detail: { format, content }
			}));
		} catch (error) {
			console.error('Error exporting:', error);
			new Notice('Failed to export table');
		}
	}

	/**
	 * Save current table as a template
	 */
	public async saveTemplate(templateName: string): Promise<void> {
		try {
			// Ensure .table-templates folder exists
			const templatesFolder = '.table-templates';
			const folder = this.app.vault.getAbstractFileByPath(templatesFolder);
			if (!folder) {
				await this.app.vault.createFolder(templatesFolder);
			}

			// Create template content (structure only, no row data)
			const templateState: TableState = {
				tableName: templateName,
				columns: JSON.parse(JSON.stringify(this.state.columns)),
				rows: this.state.rows.map(() => ({})), // Empty rows with same count
				isPrivate: this.state.isPrivate,
				tableReroll: this.state.tableReroll
			};

			const lines: string[] = [];
			lines.push('---');
			lines.push('table-roller-template: true');
			lines.push('---');
			lines.push('');
			lines.push(`# ${templateName}`);
			lines.push('');
			lines.push('```json');
			lines.push(JSON.stringify(templateState, null, 2));
			lines.push('```');

			const filename = `${templatesFolder}/${templateName}.md`;
			await this.app.vault.create(filename, lines.join('\n'));

			new Notice(`Template saved: ${templateName}`);

			// Dispatch event
			this.dispatchEvent(new CustomEvent('template-saved', {
				detail: { filename, templateName }
			}));
		} catch (error) {
			console.error('Error saving template:', error);
			new Notice('Failed to save template');
		}
	}

	/**
	 * Show save template dialog
	 */
	public async saveAsTemplate(): Promise<void> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText('Save as Template');

			const input = modal.contentEl.createEl('input', {
				type: 'text',
				placeholder: 'Template name',
				value: this.state.tableName + ' Template'
			});
			input.style.width = '100%';
			input.style.padding = '8px';
			input.style.marginBottom = '12px';

			const btnContainer = modal.contentEl.createDiv();
			btnContainer.style.display = 'flex';
			btnContainer.style.justifyContent = 'flex-end';
			btnContainer.style.gap = '8px';

			const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
			cancelBtn.addEventListener('click', () => {
				modal.close();
				resolve();
			});

			const saveBtn = btnContainer.createEl('button', { text: 'Save' });
			saveBtn.addEventListener('click', async () => {
				const templateName = input.value.trim();
				if (!templateName) {
					new Notice('Template name cannot be empty');
					return;
				}

				await this.saveTemplate(templateName);
				modal.close();
				resolve();
			});

			input.addEventListener('keypress', (e) => {
				if (e.key === 'Enter') {
					saveBtn.click();
				}
			});

			modal.onClose = () => resolve();
			modal.open();
			input.focus();
		});
	}

	/**
	 * Load templates from .table-templates folder
	 */
	public async loadTemplates(): Promise<Array<{ name: string; file: TFile }>> {
		const templatesFolder = '.table-templates';
		const files = this.app.vault.getMarkdownFiles()
			.filter(f => f.path.startsWith(templatesFolder + '/'));

		return files.map(file => ({
			name: file.basename,
			file
		}));
	}

	/**
	 * Load a specific template
	 */
	public async loadTemplate(file: TFile): Promise<TableState | null> {
		try {
			const content = await this.app.vault.read(file);

			// Extract JSON from code block
			const jsonMatch = content.match(/```json\n([\s\S]+?)\n```/);
			if (!jsonMatch) {
				new Notice('Invalid template format');
				return null;
			}

			const templateState = JSON.parse(jsonMatch[1]) as TableState;
			new Notice(`Loaded template: ${templateState.tableName}`);

			return templateState;
		} catch (error) {
			console.error('Error loading template:', error);
			new Notice('Failed to load template');
			return null;
		}
	}

	/**
	 * Import table from clipboard (markdown format)
	 */
	public async importFromClipboard(): Promise<TableState | null> {
		try {
			const text = await navigator.clipboard.readText();

			// Parse as markdown table
			const lines = text.split('\n').filter(l => l.trim().includes('|'));
			if (lines.length < 2) {
				new Notice('No valid table found in clipboard');
				return null;
			}

			// Parse headers
			const headerLine = lines[0];
			const headers = headerLine.split('|')
				.map(h => h.trim())
				.filter(h => h.length > 0);

			if (headers.length === 0) {
				new Notice('Could not parse table headers');
				return null;
			}

			// Detect columns
			const columns: ColumnConfig[] = headers.map(h => {
				if (/^\d*d\d+$/i.test(h.trim())) {
					return { name: h, type: 'dice' as const, diceNotation: h.toLowerCase() };
				} else if (/^reroll$/i.test(h.trim())) {
					return { name: h, type: 'reroll' as const };
				} else {
					return { name: h, type: 'regular' as const };
				}
			});

			// Parse rows (skip separator line)
			const rows: RowData[] = [];
			for (let i = 2; i < lines.length; i++) {
				const cells = lines[i].split('|')
					.map(c => c.trim())
					.filter((_, idx) => idx > 0 && idx <= headers.length);

				if (cells.length > 0) {
					const row: RowData = {};
					headers.forEach((header, idx) => {
						const col = columns[idx];
						const key = col.type === 'dice' ? 'range' : col.name;
						row[key] = cells[idx] || '';
					});
					rows.push(row);
				}
			}

			new Notice('Table imported from clipboard');

			return {
				tableName: 'Imported Table',
				columns,
				rows,
				isPrivate: false
			};
		} catch (error) {
			console.error('Import error:', error);
			new Notice('Failed to import from clipboard');
			return null;
		}
	}

	/**
	 * Copy table to clipboard as markdown
	 */
	public async copyToClipboard(): Promise<void> {
		try {
			const markdown = this.generateMarkdown(this.state);
			await navigator.clipboard.writeText(markdown);
			new Notice('Copied to clipboard');
		} catch (error) {
			console.error('Error copying to clipboard:', error);
			new Notice('Failed to copy to clipboard');
		}
	}
}
