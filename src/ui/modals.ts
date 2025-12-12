import { App, Modal } from 'obsidian';
import { RollResult } from '../types';

/**
 * Modal for selecting a table to roll on
 */
export class TableSelectorModal extends Modal {
	private tables: string[];
	private onSelect: (tableName: string) => void;

	constructor(app: App, tables: string[], onSelect: (tableName: string) => void) {
		super(app);
		this.tables = tables;
		this.onSelect = onSelect;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Select a table to roll on' });

		// Modifier checkbox
		const checkboxContainer = contentEl.createEl('div');
		checkboxContainer.style.marginTop = '12px';
		checkboxContainer.style.marginBottom = '16px';
		checkboxContainer.style.padding = '12px';
		checkboxContainer.style.backgroundColor = 'var(--background-secondary)';
		checkboxContainer.style.borderRadius = '6px';

		const checkboxLabel = checkboxContainer.createEl('label');
		checkboxLabel.style.display = 'flex';
		checkboxLabel.style.alignItems = 'center';
		checkboxLabel.style.cursor = 'pointer';

		const checkbox = checkboxLabel.createEl('input', { type: 'checkbox' });
		checkbox.style.marginRight = '8px';

		const labelText = checkboxLabel.createEl('span', { text: 'Roll with modifiers' });
		labelText.style.fontWeight = '500';

		let useModifiers = false;
		checkbox.addEventListener('change', () => {
			useModifiers = checkbox.checked;
		});

		// Create table list
		const listEl = contentEl.createEl('div', { cls: 'table-list' });
		listEl.style.display = 'flex';
		listEl.style.flexDirection = 'column';
		listEl.style.gap = '8px';
		listEl.style.marginTop = '16px';

		for (const tableName of this.tables) {
			const buttonEl = listEl.createEl('button', {
				text: tableName,
				cls: 'table-button'
			});

			buttonEl.style.padding = '12px 16px';
			buttonEl.style.cursor = 'pointer';
			buttonEl.style.borderRadius = '6px';
			buttonEl.style.border = '1px solid var(--background-modifier-border)';
			buttonEl.style.backgroundColor = 'var(--interactive-normal)';
			buttonEl.style.color = 'var(--text-normal)';
			buttonEl.style.textAlign = 'left';
			buttonEl.style.fontSize = '14px';
			buttonEl.style.fontWeight = '500';
			buttonEl.style.transition = 'all 0.15s ease';

			buttonEl.addEventListener('click', () => {
				if (useModifiers) {
					// Open modifier preview modal
					new ModifierPreviewModal(this.app, tableName, this.onSelect).open();
				} else {
					// Roll normally
					this.onSelect(tableName);
				}
				this.close();
			});

			buttonEl.addEventListener('mouseenter', () => {
				buttonEl.style.backgroundColor = 'var(--interactive-hover)';
				buttonEl.style.borderColor = 'var(--interactive-accent)';
				buttonEl.style.transform = 'translateX(4px)';
			});

			buttonEl.addEventListener('mouseleave', () => {
				buttonEl.style.backgroundColor = 'var(--interactive-normal)';
				buttonEl.style.borderColor = 'var(--background-modifier-border)';
				buttonEl.style.transform = 'translateX(0)';
			});
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for displaying roll results
 */
export class RollResultModal extends Modal {
	private result: RollResult;
	private onReroll?: () => void;

	constructor(app: App, result: RollResult, onReroll?: () => void) {
		super(app);
		this.result = result;
		this.onReroll = onReroll;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.displayResult(contentEl, this.result, 2);

		// Button container
		const buttonDiv = contentEl.createEl('div', { cls: 'modal-button-container' });
		buttonDiv.style.marginTop = '20px';
		buttonDiv.style.display = 'flex';
		buttonDiv.style.justifyContent = 'space-between';
		buttonDiv.style.gap = '8px';

		// Reroll button (left side)
		const leftDiv = buttonDiv.createEl('div');
		if (this.onReroll) {
			const rerollButton = leftDiv.createEl('button', { text: 'Reroll' });
			rerollButton.addEventListener('click', () => {
				this.close();
				this.onReroll?.();
			});
		}

		// Right side buttons container
		const rightDiv = buttonDiv.createEl('div');
		rightDiv.style.display = 'flex';
		rightDiv.style.gap = '8px';

		// Copy to clipboard button
		const copyButton = rightDiv.createEl('button', { text: 'Copy to Clipboard' });
		copyButton.addEventListener('click', async () => {
			const markdown = this.formatResultAsMarkdown(this.result);
			await navigator.clipboard.writeText(markdown);
			copyButton.textContent = 'Copied!';
			setTimeout(() => {
				copyButton.textContent = 'Copy to Clipboard';
			}, 2000);
		});

		// Save to file button
		const saveButton = rightDiv.createEl('button', { text: 'Save to Obsidian' });
		saveButton.addEventListener('click', () => {
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
			const defaultFilename = `${this.result.tableName}-${timestamp}`;
			const markdown = this.formatResultAsMarkdown(this.result);
			
			new SaveFileModal(this.app, defaultFilename, markdown).open();
		});

		// Close button
		const closeButton = rightDiv.createEl('button', { text: 'Close' });
		closeButton.addEventListener('click', () => this.close());
	}

	/**
	 * Format result as markdown string
	 */
	private formatResultAsMarkdown(result: RollResult, level: number = 2): string {
		const lines: string[] = [];
		const heading = '#'.repeat(level);

		// Main heading
		lines.push(`${heading} ${result.tableName}`);
		if (result.namespace) {
			lines.push(`*[${result.namespace}]*`);
		}
		lines.push('');

		// Roll value
		if (result.roll !== undefined) {
			lines.push(`**Roll:** ${result.roll}`);
		}

		// Result
		lines.push(`**Result:** ${result.result}`);

		// Details
		if (result.details) {
			lines.push(`**Details:** ${result.details}`);
		}

		// Nested rolls
		if (result.nestedRolls && result.nestedRolls.length > 0) {
			lines.push('');
			lines.push('**Referenced Tables:**');
			lines.push('');
			for (const nested of result.nestedRolls) {
				lines.push(this.formatResultAsMarkdown(nested, Math.min(level + 1, 6)));
			}
		}

		return lines.join('\n');
	}

	private displayResult(container: HTMLElement, result: RollResult, headingLevel: number) {
		// Main result heading
		const heading = container.createEl(`h${headingLevel}` as any, { text: result.tableName });
		if (result.namespace) {
			const namespaceBadge = heading.createEl('span', { 
				text: ` [${result.namespace}]`,
				cls: 'namespace-badge'
			});
			namespaceBadge.style.fontSize = '0.8em';
			namespaceBadge.style.opacity = '0.7';
			namespaceBadge.style.fontWeight = 'normal';
		}

		// Roll value (if dice-based)
		if (result.roll !== undefined) {
			const rollEl = container.createEl('p', { cls: 'roll-value' });
			rollEl.innerHTML = `<strong>Roll:</strong> ${result.roll}`;
			rollEl.style.marginBottom = '8px';
		}

		// Result text
		const resultEl = container.createEl('div', { cls: 'result-text' });
		resultEl.innerHTML = `<strong>Result:</strong> ${result.result}`;
		resultEl.style.marginBottom = '8px';

		// Details (if any)
		if (result.details) {
			const detailsEl = container.createEl('div', { cls: 'result-details' });
			detailsEl.innerHTML = `<strong>Details:</strong> ${result.details}`;
			detailsEl.style.marginBottom = '12px';
		}

		// Nested rolls
		if (result.nestedRolls && result.nestedRolls.length > 0) {
			const nestedHeader = container.createEl('p', { 
				text: 'Referenced Tables:',
				cls: 'nested-header'
			});
			nestedHeader.style.fontWeight = 'bold';
			nestedHeader.style.marginTop = '12px';
			nestedHeader.style.marginBottom = '8px';

			for (const nested of result.nestedRolls) {
				const nestedDiv = container.createEl('div', { cls: 'nested-roll' });
				nestedDiv.style.marginLeft = '20px';
				nestedDiv.style.paddingLeft = '12px';
				nestedDiv.style.borderLeft = '3px solid var(--background-modifier-border)';
				nestedDiv.style.marginTop = '12px';

				this.displayResult(nestedDiv, nested, Math.min(headingLevel + 1, 6));
			}
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for configuring modifiers before rolling
 */
export class ModifierPreviewModal extends Modal {
	private tableName: string;
	private onRoll: (tableName: string) => void;

	constructor(app: App, tableName: string, onRoll: (tableName: string) => void) {
		super(app);
		this.tableName = tableName;
		this.onRoll = onRoll;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Configure Roll Modifiers' });

		const infoText = contentEl.createEl('p', { 
			text: 'Add modifiers to dice rolls. Note: Modifiers only apply to dice-based tables (d6, d20, etc.).'
		});
		infoText.style.fontSize = '13px';
		infoText.style.opacity = '0.8';
		infoText.style.marginBottom = '16px';

		// Main table modifier
		const mainTableDiv = contentEl.createEl('div');
		mainTableDiv.style.marginBottom = '20px';

		const mainLabel = mainTableDiv.createEl('div');
		mainLabel.style.fontWeight = '600';
		mainLabel.style.marginBottom = '8px';
		mainLabel.style.fontSize = '15px';
		mainLabel.createEl('span', { text: `${this.tableName}` });
		
		const mainBadge = mainLabel.createEl('span', { text: ' [Main Table]' });
		mainBadge.style.fontSize = '12px';
		mainBadge.style.opacity = '0.7';
		mainBadge.style.fontWeight = 'normal';

		const mainInputContainer = mainTableDiv.createEl('div');
		mainInputContainer.style.display = 'flex';
		mainInputContainer.style.alignItems = 'center';
		mainInputContainer.style.gap = '8px';

		const mainInput = mainInputContainer.createEl('input', {
			type: 'number',
			placeholder: '0'
		});
		mainInput.style.width = '100px';
		mainInput.style.padding = '8px 12px';
		mainInput.style.borderRadius = '4px';
		mainInput.style.border = '1px solid var(--background-modifier-border)';
		mainInput.style.fontSize = '14px';
		mainInput.value = '0';

		mainInputContainer.createEl('span', { 
			text: 'Modifier (e.g., +2 or -3)' 
		}).style.opacity = '0.7';

		// Note about nested tables
		const noteDiv = contentEl.createEl('div');
		noteDiv.style.marginTop = '16px';
		noteDiv.style.padding = '12px';
		noteDiv.style.backgroundColor = 'var(--background-secondary)';
		noteDiv.style.borderRadius = '6px';
		noteDiv.style.fontSize = '13px';

		const noteIcon = noteDiv.createEl('span', { text: '💡 ' });
		noteDiv.createEl('span', { 
			text: 'Additional tables from rerolls will use this same modifier. Future updates may allow per-table modifiers for nested rolls.'
		});

		// Button container
		const buttonDiv = contentEl.createEl('div');
		buttonDiv.style.marginTop = '24px';
		buttonDiv.style.display = 'flex';
		buttonDiv.style.justifyContent = 'flex-end';
		buttonDiv.style.gap = '8px';

		// Roll button
		const rollButton = buttonDiv.createEl('button', { text: 'Roll' });
		rollButton.style.fontWeight = '600';
		rollButton.addEventListener('click', () => {
			const modifier = parseInt(mainInput.value) || 0;
			// Store modifier in a way the roller can access it
			// For now, we'll pass it through the tableName with a special format
			const tableWithModifier = modifier !== 0 ? `${this.tableName}@${modifier}` : this.tableName;
			this.onRoll(tableWithModifier);
			this.close();
		});

		// Cancel button
		const cancelButton = buttonDiv.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());

		// Focus the input
		mainInput.focus();
		mainInput.select();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for saving result to a file with custom filename
 */
export class SaveFileModal extends Modal {
	private defaultFilename: string;
	private content: string;

	constructor(app: App, defaultFilename: string, content: string) {
		super(app);
		this.defaultFilename = defaultFilename;
		this.content = content;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Save to file' });

		// Filename input
		const inputContainer = contentEl.createEl('div');
		inputContainer.style.marginTop = '16px';
		inputContainer.style.marginBottom = '16px';

		const label = inputContainer.createEl('label', { text: 'Filename:' });
		label.style.display = 'block';
		label.style.marginBottom = '8px';
		label.style.fontWeight = '500';

		const input = inputContainer.createEl('input', {
			type: 'text',
			value: this.defaultFilename
		});
		input.style.width = '100%';
		input.style.padding = '8px 12px';
		input.style.borderRadius = '4px';
		input.style.border = '1px solid var(--background-modifier-border)';
		input.style.fontSize = '14px';

		const extension = inputContainer.createEl('span', { text: '.md' });
		extension.style.marginLeft = '4px';
		extension.style.opacity = '0.7';

		// Button container
		const buttonDiv = contentEl.createEl('div');
		buttonDiv.style.marginTop = '20px';
		buttonDiv.style.display = 'flex';
		buttonDiv.style.justifyContent = 'flex-end';
		buttonDiv.style.gap = '8px';

		// Save button
		const saveButton = buttonDiv.createEl('button', { text: 'Save' });
		saveButton.addEventListener('click', async () => {
			const filename = input.value.trim() || this.defaultFilename;
			await this.saveFile(filename);
			this.close();
		});

		// Cancel button
		const cancelButton = buttonDiv.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());

		// Focus input and select all text
		input.focus();
		input.select();

		// Save on Enter key
		input.addEventListener('keypress', async (e) => {
			if (e.key === 'Enter') {
				const filename = input.value.trim() || this.defaultFilename;
				await this.saveFile(filename);
				this.close();
			}
		});
	}

	private async saveFile(filename: string): Promise<void> {
		const fullFilename = filename.endsWith('.md') ? filename : `${filename}.md`;

		try {
			await this.app.vault.create(fullFilename, this.content);
			console.log(`Saved roll result to ${fullFilename}`);
		} catch (error) {
			console.error('Error saving file:', error);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
