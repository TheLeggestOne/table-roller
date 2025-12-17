import { mount } from "svelte";
import { App, Modal } from "obsidian";
import type { RollResult } from "src/types/rolls/roll-result";
import RollResultModalComponent from "./RollResultModalComponent.svelte";

export class RollResultModal extends Modal {
    rollResult: RollResult;

    constructor(app: App, result: RollResult) {
        super(app);
        this.rollResult = result;
    }

    onOpen() {
        this.setTitle(`Roll Result: ${this.rollResult.tableName}`);
        const { contentEl } = this;
        mount(RollResultModalComponent, {
            target: contentEl,
            props: {
                rollResult: this.rollResult
            }
        });
    }
}



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