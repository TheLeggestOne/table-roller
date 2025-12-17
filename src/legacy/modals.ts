// import { App, Modal, TFile } from 'obsidian';
// import type { TableRollerCore } from './services/TableRollerCore';
// import type { RollResult } from './types';

// /**
//  * Modal for selecting a table to roll on
//  */
// export class TableSelectorModal extends Modal {
// 	private tables: string[];
// 	private onSelect: (tableName: string) => void;
// 	private roller: TableRollerCore;
// 	public showRollNumbers: boolean = false;

// 	constructor(app: App, tables: string[], onSelect: (tableName: string) => void, roller: TableRollerCore) {
// 		super(app);
// 		this.tables = tables;
// 		this.onSelect = onSelect;
// 		this.roller = roller;
// 	}

// 	onOpen() {
// 		const { contentEl } = this;
// 		contentEl.empty();

// 		contentEl.createEl('h2', { text: 'Select a table to roll on' });

// 		// Modifier checkbox
// 		const checkboxContainer = contentEl.createEl('div', { cls: 'modal-checkbox-container' });

// 		const checkboxLabel = checkboxContainer.createEl('label', { cls: 'modal-checkbox-label' });

// 		const checkbox = checkboxLabel.createEl('input', { type: 'checkbox', cls: 'modal-checkbox' });

// 		const labelText = checkboxLabel.createEl('span', { 
// 			text: 'Roll with modifiers',
// 			cls: 'modal-checkbox-text'
// 		});

// 		let useModifiers = false;
// 		checkbox.addEventListener('change', () => {
// 			useModifiers = checkbox.checked;
// 		});

// 		// Show roll numbers checkbox
// 		const rollNumsContainer = contentEl.createEl('div', { cls: 'modal-checkbox-container' });

// 		const rollNumsLabel = rollNumsContainer.createEl('label', { cls: 'modal-checkbox-label' });

// 		const rollNumsCheckbox = rollNumsLabel.createEl('input', { type: 'checkbox', cls: 'modal-checkbox' });

// 		const rollNumsLabelText = rollNumsLabel.createEl('span', { 
// 			text: 'Show roll numbers',
// 			cls: 'modal-checkbox-text'
// 		});

// 		rollNumsCheckbox.addEventListener('change', () => {
// 			this.showRollNumbers = rollNumsCheckbox.checked;
// 		});

// 		// Create table list
// 		const listEl = contentEl.createEl('div', { cls: 'modal-table-list' });

// 		for (const tableName of this.tables) {
// 			const buttonEl = listEl.createEl('button', {
// 				text: tableName,
// 				cls: 'modal-table-button'
// 			});

// 			buttonEl.addEventListener('click', () => {
// 				if (useModifiers) {
// 					// Open modifier preview modal
// 					new ModifierPreviewModal(this.app, tableName, this.onSelect).open();
// 				} else {
// 					// Roll normally
// 					this.onSelect(tableName);
// 				}
// 				this.close();
// 			});
// 		}
// 	}

// 	onClose() {
// 		const { contentEl } = this;
// 		contentEl.empty();
// 	}
// }

// /**
//  * Modal for displaying roll results
//  */
// export class RollResultModal extends Modal {
// 	private result: RollResult;
// 	private onReroll?: () => void;
// 	private showRollNumbers: boolean;

// 	constructor(app: App, result: RollResult, onReroll?: () => void, showRollNumbers: boolean = false) {
// 		super(app);
// 		this.result = result;
// 		this.onReroll = onReroll;
// 		this.showRollNumbers = showRollNumbers;
// 	}

// 	onOpen() {
// 		const { contentEl } = this;
// 		contentEl.empty();

// 		this.displayResult(contentEl, this.result, 2, this.showRollNumbers);

// 		// Button container
// 		const buttonDiv = contentEl.createEl('div', { cls: 'modal-button-container' });

// 		// Reroll button (left side)
// 		const leftDiv = buttonDiv.createEl('div', { cls: 'modal-button-group' });
	
// 		if (this.onReroll) {
// 			const rerollButton = leftDiv.createEl('button', { text: 'Reroll' });
// 			rerollButton.addEventListener('click', () => {
// 				this.close();
// 				this.onReroll?.();
// 			});
// 		}
	
// 		// Right side buttons container
// 		const rightDiv = buttonDiv.createEl('div', { cls: 'modal-button-group' });

// 		// Copy to clipboard button
// 		const copyButton = rightDiv.createEl('button', { text: 'Copy to Clipboard' });
// 		copyButton.addEventListener('click', async () => {
// 			const markdown = this.formatResultAsMarkdown(this.result);
// 			await navigator.clipboard.writeText(markdown);
// 			copyButton.textContent = 'Copied!';
// 			setTimeout(() => {
// 				copyButton.textContent = 'Copy to Clipboard';
// 			}, 2000);
// 		});

// 		// Save to file button
// 		const saveButton = rightDiv.createEl('button', { text: 'Save to Obsidian' });
// 		saveButton.addEventListener('click', () => {
// 			const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
// 			const defaultFilename = `${this.result.tableName}-${timestamp}`;
// 			const markdown = this.formatResultAsMarkdown(this.result);
			
// 			new SaveFileModal(this.app, defaultFilename, markdown).open();
// 		});

// 		// Close button
// 		const closeButton = rightDiv.createEl('button', { text: 'Close' });
// 		closeButton.addEventListener('click', () => this.close());
// 	}

// 	/**
// 	 * Format result as markdown string
// 	 */
// 	private formatResultAsMarkdown(result: RollResult, level: number = 2): string {
// 		const lines: string[] = [];
// 		const heading = '#'.repeat(level);

// 		// Main heading
// 		lines.push(`${heading} ${result.tableName}`);
// 		if (result.namespace) {
// 			lines.push(`*[[${result.namespace}]]*`);
// 		}
// 		lines.push('');

// 		// Display dynamic columns if available
// 		if (result.columns && Object.keys(result.columns).length > 0) {
// 			for (const [header, value] of Object.entries(result.columns)) {
// 				if (value && value.trim()) {
// 					lines.push(`**${header}:** ${value}`);
// 				}
// 			}
// 		} else {
// 			// Fallback to old format
// 			lines.push(`**Result:** ${result.result}`);
// 			if (result.details) {
// 				lines.push(`**Details:** ${result.details}`);
// 			}
// 		}

// 		// Roll value (if dice-based and showRollNumbers is true)
// 		if (this.showRollNumbers && result.roll !== undefined) {
// 			lines.push(`**Roll:** ${result.roll}`);
// 		}

// 		// Nested rolls
// 		if (result.nestedRolls && result.nestedRolls.length > 0) {
// 			lines.push('');
// 			lines.push('**Referenced Tables:**');
// 			lines.push('');
// 			for (const nested of result.nestedRolls) {
// 				lines.push(this.formatResultAsMarkdown(nested, Math.min(level + 1, 6)));
// 			}
// 		}

// 		return lines.join('\n');
// 	}

// 	private displayResult(container: HTMLElement, result: RollResult, headingLevel: number, showRollNumbers: boolean = false) {
// 		// Main result heading
// 		const heading = container.createEl(`h${headingLevel}` as any, { text: result.tableName });
// 		if (result.namespace) {
// 			const namespaceBadge = heading.createEl('span', { 
// 				cls: 'modal-namespace-badge'
// 			});
			
// 			// Create clickable link if source file exists
// 			if (result.sourceFile) {
// 				const link = namespaceBadge.createEl('a', { 
// 					text: ` [${result.namespace}]`,
// 					href: '#',
// 					cls: 'modal-namespace-link'
// 				});
// 				link.addEventListener('click', async (e: MouseEvent) => {
// 					e.preventDefault();
// 					const file = this.app.vault.getAbstractFileByPath(result.sourceFile!);
// 					if (file && file instanceof TFile) {
// 						await this.app.workspace.getLeaf().openFile(file);
// 						this.close();
// 					}
// 				});
// 			} else {
// 				namespaceBadge.textContent = ` [${result.namespace}]`;
// 			}
// 		}

// 		// Display dynamic columns if available
// 		if (result.columns && Object.keys(result.columns).length > 0) {
// 			for (const [header, value] of Object.entries(result.columns)) {
// 				if (value && value.trim()) {
// 					const colEl = container.createEl('div', { cls: 'modal-result-column' });
// 					colEl.innerHTML = `<strong>${header}:</strong> ${value}`;
// 				}
// 			}
// 		} else {
// 			// Fallback to old format for backward compatibility
// 			const resultEl = container.createEl('div', { cls: 'modal-result-text' });
// 			resultEl.innerHTML = `<strong>Result:</strong> ${result.result}`;

// 			// Details (if any)
// 			if (result.details) {
// 				const detailsEl = container.createEl('div', { cls: 'modal-result-details' });
// 				detailsEl.innerHTML = `<strong>Details:</strong> ${result.details}`;
// 			}
// 		}

// 		// Roll value (if dice-based and showRollNumbers is true)
// 		if (showRollNumbers && result.roll !== undefined) {
// 			const rollEl = container.createEl('p', { cls: 'modal-roll-value' });
// 			rollEl.innerHTML = `<strong>Roll:</strong> ${result.roll}`;
// 		}

// 		// Nested rolls
// 		if (result.nestedRolls && result.nestedRolls.length > 0) {
// 			const nestedHeader = container.createEl('p', { 
// 				text: 'Referenced Tables:',
// 				cls: 'modal-nested-header'
// 			});

// 			for (const nested of result.nestedRolls) {
// 				const nestedDiv = container.createEl('div', { cls: 'modal-nested-roll' });
// 				this.displayResult(nestedDiv, nested, Math.min(headingLevel + 1, 6), showRollNumbers);
// 			}
// 		}
// 	}

// 	onClose() {
// 		const { contentEl } = this;
// 		contentEl.empty();
// 	}
// }

// /**
//  * Modal for configuring modifiers before rolling
//  */
// export class ModifierPreviewModal extends Modal {
// 	private tableName: string;
// 	private onRoll: (tableName: string) => void;

// 	constructor(app: App, tableName: string, onRoll: (tableName: string) => void) {
// 		super(app);
// 		this.tableName = tableName;
// 		this.onRoll = onRoll;
// 	}

// 	onOpen() {
// 		const { contentEl } = this;
// 		contentEl.empty();

// 		contentEl.createEl('h2', { text: 'Configure Roll Modifiers' });

// 		const infoText = contentEl.createEl('p', { 
// 			text: 'Add modifiers to dice rolls. Note: Modifiers only apply to dice-based tables (d6, d20, etc.).',
// 			cls: 'modal-info-text'
// 		});

// 		// Main table modifier
// 		const mainTableDiv = contentEl.createEl('div', { cls: 'modal-modifier-section' });

// 		const mainLabel = mainTableDiv.createEl('div', { cls: 'modal-modifier-label' });
// 		mainLabel.createEl('span', { text: `${this.tableName}` });
		
// 		const mainBadge = mainLabel.createEl('span', { 
// 			text: ' [Main Table]',
// 			cls: 'modal-modifier-badge'
// 		});

// 		const mainInputContainer = mainTableDiv.createEl('div', { cls: 'modal-input-container' });

// 		const mainInput = mainInputContainer.createEl('input', {
// 			type: 'number',
// 			placeholder: '0',
// 			cls: 'modal-modifier-input'
// 		});
// 		mainInput.value = '0';

// 		const inputHint = mainInputContainer.createEl('span', { 
// 			text: 'Modifier (e.g., +2 or -3)',
// 			cls: 'modal-input-hint'
// 		});

// 		// Note about nested tables
// 		const noteDiv = contentEl.createEl('div', { cls: 'modal-note' });
// 		const noteIcon = noteDiv.createEl('span', { text: '💡 ' });
// 		noteDiv.createEl('span', { 
// 			text: 'Additional tables from rerolls will use this same modifier. Future updates may allow per-table modifiers for nested rolls.'
// 		});

// 		// Button container
// 		const buttonDiv = contentEl.createEl('div', { cls: 'modal-button-container' });

// 		// Roll button
// 		const rollButton = buttonDiv.createEl('button', { 
// 			text: 'Roll',
// 			cls: 'modal-button-primary'
// 		});
// 		rollButton.addEventListener('click', () => {
// 			const modifier = parseInt(mainInput.value) || 0;
// 			// Store modifier in a way the roller can access it
// 			// For now, we'll pass it through the tableName with a special format
// 			const tableWithModifier = modifier !== 0 ? `${this.tableName}@${modifier}` : this.tableName;
// 			this.onRoll(tableWithModifier);
// 			this.close();
// 		});

// 		// Cancel button
// 		const cancelButton = buttonDiv.createEl('button', { text: 'Cancel' });
// 		cancelButton.addEventListener('click', () => this.close());

// 		// Focus the input
// 		mainInput.focus();
// 		mainInput.select();
// 	}

// 	onClose() {
// 		const { contentEl } = this;
// 		contentEl.empty();
// 	}
// }

// /**
//  * Modal for saving result to a file with custom filename
//  */
// export class SaveFileModal extends Modal {
// 	private defaultFilename: string;
// 	private content: string;

// 	constructor(app: App, defaultFilename: string, content: string) {
// 		super(app);
// 		this.defaultFilename = defaultFilename;
// 		this.content = content;
// 	}

// 	onOpen() {
// 		const { contentEl } = this;
// 		contentEl.empty();

// 		contentEl.createEl('h2', { text: 'Save to file' });

// 		// Filename input
// 		const inputContainer = contentEl.createEl('div', { cls: 'modal-input-section' });

// 		const label = inputContainer.createEl('label', { 
// 			text: 'Filename:',
// 			cls: 'modal-label'
// 		});

// 		const input = inputContainer.createEl('input', {
// 			type: 'text',
// 			value: this.defaultFilename,
// 			cls: 'modal-filename-input'
// 		});

// 		const extension = inputContainer.createEl('span', { 
// 			text: '.md',
// 			cls: 'modal-extension'
// 		});

// 		// Button container
// 		const buttonDiv = contentEl.createEl('div', { cls: 'modal-button-container' });

// 		// Save button
// 		const saveButton = buttonDiv.createEl('button', { text: 'Save' });
// 		saveButton.addEventListener('click', async () => {
// 			const filename = input.value.trim() || this.defaultFilename;
// 			await this.saveFile(filename);
// 			this.close();
// 		});

// 		// Cancel button
// 		const cancelButton = buttonDiv.createEl('button', { text: 'Cancel' });
// 		cancelButton.addEventListener('click', () => this.close());

// 		// Focus input and select all text
// 		input.focus();
// 		input.select();

// 		// Save on Enter key
// 		input.addEventListener('keypress', async (e) => {
// 			if (e.key === 'Enter') {
// 				const filename = input.value.trim() || this.defaultFilename;
// 				await this.saveFile(filename);
// 				this.close();
// 			}
// 		});
// 	}

// 	private async saveFile(filename: string): Promise<void> {
// 		const fullFilename = filename.endsWith('.md') ? filename : `${filename}.md`;

// 		try {
// 			await this.app.vault.create(fullFilename, this.content);
// 			console.log(`Saved roll result to ${fullFilename}`);
// 		} catch (error) {
// 			console.error('Error saving file:', error);
// 		}
// 	}

// 	onClose() {
// 		const { contentEl } = this;
// 		contentEl.empty();
// 	}
// }

// /**
//  * Modal for displaying error messages
//  */
// export class ErrorModal extends Modal {
// 	private title: string;
// 	private message: string;

// 	constructor(app: App, title: string, message: string) {
// 		super(app);
// 		this.title = title;
// 		this.message = message;
// 	}

// 	onOpen() {
// 		const { contentEl } = this;
// 		contentEl.empty();

// 		contentEl.createEl('h2', { text: this.title });

// 		const messageContainer = contentEl.createDiv({ cls: 'modal-error-message' });
// 		messageContainer.setText(this.message);

// 		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container modal-button-centered' });

// 		const closeButton = buttonContainer.createEl('button', { 
// 			text: 'OK',
// 			cls: 'modal-button-ok'
// 		});
// 		closeButton.addEventListener('click', () => {
// 			this.close();
// 		});
// 	}

// 	onClose() {
// 		const { contentEl } = this;
// 		contentEl.empty();
// 	}
// }
