import { App, Modal, Notice, TFile } from 'obsidian';

/**
 * Event types for modal outcomes
 */
export interface DiceColumnModalData {
	diceType: string;
}

export interface GenerateRowsModalData {
	diceNotation: string;
	rowCount: number;
	groupSize?: number;
	remainder: 'expand-first' | 'expand-last' | 'row-first' | 'row-last';
}

export interface SaveTemplateModalData {
	templateName: string;
}

export interface SaveToNewFileModalData {
	filename: string;
}

export interface FileSelectionModalData {
	file: TFile;
}

export interface TableSelectionModalData {
	tableName: string;
}

/**
 * Modal for adding a dice column to the table
 * Dispatches: 'confirm' event with DiceColumnModalData
 */
export class DiceColumnModal extends Modal {
	private onConfirm: (data: DiceColumnModalData) => void;
	private selectEl: HTMLSelectElement;
	private customInput: HTMLInputElement;
	private customContainer: HTMLElement;

	constructor(app: App, onConfirm: (data: DiceColumnModalData) => void) {
		super(app);
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText('Add Dice Column');

		// Dice type selector
		contentEl.createEl('label', { text: 'Select dice type:' });
		this.selectEl = contentEl.createEl('select');
		this.selectEl.addClass('table-builder-input');

		const diceOptions = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100', 'custom'];
		diceOptions.forEach(dice => {
			this.selectEl.createEl('option', { 
				text: dice === 'custom' ? 'Custom...' : dice, 
				value: dice 
			});
		});

		// Custom input container (hidden by default)
		this.customContainer = contentEl.createDiv();
		this.customContainer.addClass('table-builder-custom-container');
		this.customContainer.style.display = 'none';

		this.customContainer.createEl('label', { text: 'Custom dice notation (e.g., d6, 2d6, d100):' });
		this.customInput = this.customContainer.createEl('input', {
			type: 'text',
			placeholder: 'd6'
		});
		this.customInput.addClass('table-builder-input');

		// Toggle custom input visibility
		this.selectEl.addEventListener('change', () => {
			if (this.selectEl.value === 'custom') {
				this.customContainer.style.display = 'block';
				this.customInput.focus();
			} else {
				this.customContainer.style.display = 'none';
			}
		});

		// Button container
		const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addClass('table-builder-btn');
		cancelBtn.addEventListener('click', () => this.close());

		const addBtn = btnContainer.createEl('button', { text: 'Add' });
		addBtn.addClass('table-builder-btn');
		addBtn.addEventListener('click', () => this.handleConfirm());

		// Enter key support
		this.customInput.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				this.handleConfirm();
			}
		});
	}

	private handleConfirm(): void {
		let diceType = this.selectEl.value;

		// If custom, validate and use custom input
		if (diceType === 'custom') {
			diceType = this.customInput.value.trim().toLowerCase();
			if (!diceType) {
				new Notice('Please enter a dice notation');
				return;
			}
			// Validate dice notation format
			if (!/^\d*d\d+$/.test(diceType)) {
				new Notice('Invalid dice notation. Use format like: d6, 2d6, d100');
				return;
			}
		}

		this.onConfirm({ diceType });
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for generating rows with dice ranges
 * Dispatches: 'confirm' event with GenerateRowsModalData
 */
export class GenerateRowsModal extends Modal {
	private diceNotation: string;
	private onConfirm: (data: GenerateRowsModalData) => void;
	private optionSelect: HTMLSelectElement;
	private customInput: HTMLInputElement;
	private customInputContainer: HTMLElement;
	private remainderSelect: HTMLSelectElement;
	private totalRange: number;

	constructor(
		app: App, 
		diceNotation: string, 
		onConfirm: (data: GenerateRowsModalData) => void
	) {
		super(app);
		this.diceNotation = diceNotation;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText('Generate Rows');

		// Parse dice notation
		const match = this.diceNotation.match(/^(\d*)d(\d+)$/i);
		if (!match) {
			contentEl.createEl('p', { text: 'Invalid dice notation.' });
			return;
		}

		const numDice = match[1] ? parseInt(match[1]) : 1;
		const sides = parseInt(match[2]);
		const minValue = numDice;
		const maxValue = numDice * sides;
		this.totalRange = maxValue - minValue + 1;

		// Generate options
		const generateOptions: Array<{ name: string; count: number; groupSize?: number }> = [];

		// Always offer individual rows
		generateOptions.push({ name: `All values (${this.totalRange} rows)`, count: this.totalRange });

		// Offer common group sizes
		const commonGroupSizes = [2, 3, 5, 10];
		for (const groupSize of commonGroupSizes) {
			if (groupSize < this.totalRange) {
				const rowCount = Math.ceil(this.totalRange / groupSize);
				generateOptions.push({ 
					name: `Every ${groupSize} (~${rowCount} rows)`, 
					count: rowCount, 
					groupSize: groupSize 
				});
			}
		}

		// Form container
		const formContainer = contentEl.createDiv({ cls: 'table-builder-section' });

		// Range option dropdown
		const optionLabel = formContainer.createEl('label', { text: 'Range option:' });
		this.optionSelect = formContainer.createEl('select');
		this.optionSelect.addClass('table-builder-input');

		// Add preset options
		generateOptions.forEach(option => {
			this.optionSelect.createEl('option', {
				text: option.name,
				value: option.groupSize ? option.groupSize.toString() : 'all'
			});
		});

		// Add custom option
		this.optionSelect.createEl('option', { text: 'Custom', value: 'custom' });

		// Custom input (hidden by default)
		this.customInputContainer = formContainer.createDiv();
		this.customInputContainer.addClass('table-builder-custom-container');
		this.customInputContainer.style.display = 'none';

		const customLabel = this.customInputContainer.createEl('label', { 
			text: 'Range (values per row):' 
		});
		this.customInput = this.customInputContainer.createEl('input', {
			type: 'number',
			placeholder: '2',
			attr: { min: '2', max: this.totalRange.toString() }
		});
		this.customInput.addClass('table-builder-input');

		// Show/hide custom input based on selection
		this.optionSelect.addEventListener('change', () => {
			this.customInputContainer.style.display = 
				this.optionSelect.value === 'custom' ? 'block' : 'none';
		});

		// Remainder handling dropdown
		const remainderContainer = formContainer.createDiv({ cls: 'table-builder-section' });
		const remainderLabel = remainderContainer.createEl('label', { text: 'Handle remainder:' });
		this.remainderSelect = remainderContainer.createEl('select');
		this.remainderSelect.addClass('table-builder-input');

		this.remainderSelect.createEl('option', { 
			text: 'Expand first row (add to first range)', 
			value: 'expand-first' 
		});
		this.remainderSelect.createEl('option', { 
			text: 'Expand last row (add to last range)', 
			value: 'expand-last',
			attr: { selected: 'selected' }
		});
		this.remainderSelect.createEl('option', { 
			text: 'Additional row at start', 
			value: 'row-first' 
		});
		this.remainderSelect.createEl('option', { 
			text: 'Additional row at end', 
			value: 'row-last' 
		});

		// Button container
		const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addClass('table-builder-btn');
		cancelBtn.addEventListener('click', () => this.close());

		const generateBtn = btnContainer.createEl('button', { text: 'Generate' });
		generateBtn.addClass('table-builder-btn');
		generateBtn.addEventListener('click', () => this.handleConfirm());
	}

	private handleConfirm(): void {
		const selectedValue = this.optionSelect.value;
		let groupSize: number | undefined;

		if (selectedValue === 'all') {
			// All values - no grouping
			groupSize = undefined;
		} else if (selectedValue === 'custom') {
			// Custom group size
			groupSize = parseInt(this.customInput.value);
			if (!groupSize || groupSize < 2) {
				new Notice('Range must be at least 2');
				return;
			}
			if (groupSize > this.totalRange) {
				new Notice(`Range cannot exceed total range (${this.totalRange})`);
				return;
			}
		} else {
			// Preset group size
			groupSize = parseInt(selectedValue);
		}

		const remainder = this.remainderSelect.value as 'expand-first' | 'expand-last' | 'row-first' | 'row-last';
		const rowCount = groupSize ? Math.ceil(this.totalRange / groupSize) : this.totalRange;

		this.onConfirm({ 
			diceNotation: this.diceNotation, 
			rowCount, 
			groupSize, 
			remainder 
		});
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Generic confirmation modal
 * Dispatches: 'confirm' or 'cancel' events
 */
export class ConfirmModal extends Modal {
	private title: string;
	private message: string;
	private confirmText: string;
	private cancelText: string;
	private onConfirm: () => void;
	private isDangerous: boolean;

	constructor(
		app: App,
		title: string,
		message: string,
		onConfirm: () => void,
		options?: {
			confirmText?: string;
			cancelText?: string;
			isDangerous?: boolean;
		}
	) {
		super(app);
		this.title = title;
		this.message = message;
		this.onConfirm = onConfirm;
		this.confirmText = options?.confirmText || 'Confirm';
		this.cancelText = options?.cancelText || 'Cancel';
		this.isDangerous = options?.isDangerous || false;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText(this.title);
		contentEl.createEl('p', { text: this.message });

		const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		const cancelBtn = btnContainer.createEl('button', { text: this.cancelText });
		cancelBtn.addClass('table-builder-btn');
		cancelBtn.addEventListener('click', () => this.close());

		const confirmBtn = btnContainer.createEl('button', { text: this.confirmText });
		confirmBtn.addClass('table-builder-btn');
		if (this.isDangerous) {
			confirmBtn.addClass('mod-warning');
		}
		confirmBtn.addEventListener('click', () => {
			this.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for saving table as template
 * Dispatches: 'confirm' event with SaveTemplateModalData
 */
export class SaveTemplateModal extends Modal {
	private defaultName: string;
	private onConfirm: (data: SaveTemplateModalData) => void;
	private inputEl: HTMLInputElement;

	constructor(app: App, defaultName: string, onConfirm: (data: SaveTemplateModalData) => void) {
		super(app);
		this.defaultName = defaultName;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText('Save as Template');

		this.inputEl = contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Template name',
			value: this.defaultName + ' Template'
		});
		this.inputEl.addClass('table-builder-input');

		const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addClass('table-builder-btn');
		cancelBtn.addEventListener('click', () => this.close());

		const saveBtn = btnContainer.createEl('button', { text: 'Save' });
		saveBtn.addClass('table-builder-btn');
		saveBtn.addEventListener('click', () => this.handleConfirm());

		// Enter key support
		this.inputEl.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				this.handleConfirm();
			}
		});

		this.inputEl.focus();
	}

	private handleConfirm(): void {
		const templateName = this.inputEl.value.trim();
		if (!templateName) {
			new Notice('Template name cannot be empty');
			return;
		}

		this.onConfirm({ templateName });
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for saving table to a new file
 * Dispatches: 'confirm' event with SaveToNewFileModalData
 */
export class SaveToNewFileModal extends Modal {
	private defaultFilename: string;
	private onConfirm: (data: SaveToNewFileModalData) => void;
	private inputEl: HTMLInputElement;

	constructor(app: App, defaultFilename: string, onConfirm: (data: SaveToNewFileModalData) => void) {
		super(app);
		this.defaultFilename = defaultFilename;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText('Save to New File');

		this.inputEl = contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Filename (without .md)',
			value: this.defaultFilename
		});
		this.inputEl.addClass('table-builder-input');

		const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addClass('table-builder-btn');
		cancelBtn.addEventListener('click', () => this.close());

		const saveBtn = btnContainer.createEl('button', { text: 'Save' });
		saveBtn.addClass('table-builder-btn');
		saveBtn.addEventListener('click', () => this.handleConfirm());

		// Enter key support
		this.inputEl.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				this.handleConfirm();
			}
		});

		this.inputEl.focus();
	}

	private handleConfirm(): void {
		const filename = this.inputEl.value.trim();
		if (!filename) {
			new Notice('Filename cannot be empty');
			return;
		}

		this.onConfirm({ filename });
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for choosing save location (new file or append)
 */
export class SaveTableAsModal extends Modal {
	private onCreateNew: () => void;
	private onAppend: () => void;

	constructor(app: App, onCreateNew: () => void, onAppend: () => void) {
		super(app);
		this.onCreateNew = onCreateNew;
		this.onAppend = onAppend;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText('Save Table As');

		const createNewBtn = contentEl.createEl('button', {
			text: 'Create New File',
			cls: 'table-builder-btn'
		});
		createNewBtn.style.width = '100%';
		createNewBtn.style.marginBottom = '8px';
		createNewBtn.addEventListener('click', () => {
			this.onCreateNew();
			this.close();
		});

		const appendBtn = contentEl.createEl('button', {
			text: 'Append to Existing File',
			cls: 'table-builder-btn'
		});
		appendBtn.style.width = '100%';
		appendBtn.addEventListener('click', () => {
			this.onAppend();
			this.close();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for selecting a file from a list
 * Dispatches: 'confirm' event with FileSelectionModalData
 */
export class FileSelectionModal extends Modal {
	private files: TFile[];
	private title: string;
	private onConfirm: (data: FileSelectionModalData) => void;

	constructor(
		app: App, 
		files: TFile[], 
		title: string, 
		onConfirm: (data: FileSelectionModalData) => void
	) {
		super(app);
		this.files = files;
		this.title = title;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText(this.title);

		const fileList = contentEl.createDiv({ cls: 'file-list' });
		fileList.style.maxHeight = '400px';
		fileList.style.overflowY = 'auto';

		this.files.forEach(file => {
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

			fileBtn.addEventListener('click', () => {
				this.onConfirm({ file });
				this.close();
			});

			fileBtn.addEventListener('mouseenter', () => {
				fileBtn.style.background = 'var(--background-modifier-hover)';
			});
			fileBtn.addEventListener('mouseleave', () => {
				fileBtn.style.background = 'var(--background-secondary)';
			});
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for selecting a table from a list
 * Dispatches: 'confirm' event with TableSelectionModalData
 */
export class TableSelectionModal extends Modal {
	private tableNames: string[];
	private onConfirm: (data: TableSelectionModalData) => void;

	constructor(
		app: App, 
		tableNames: string[], 
		onConfirm: (data: TableSelectionModalData) => void
	) {
		super(app);
		this.tableNames = tableNames;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText('Select Table');

		const tableList = contentEl.createDiv({ cls: 'table-list' });

		this.tableNames.forEach(name => {
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

			btn.addEventListener('click', () => {
				this.onConfirm({ tableName: name });
				this.close();
			});

			btn.addEventListener('mouseenter', () => {
				btn.style.background = 'var(--background-modifier-hover)';
			});
			btn.addEventListener('mouseleave', () => {
				btn.style.background = 'var(--background-secondary)';
			});
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for displaying validation errors
 */
export class ValidationErrorsModal extends Modal {
	private errors: string[];

	constructor(app: App, errors: string[]) {
		super(app);
		this.errors = errors;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText('Validation Errors');

		contentEl.createEl('p', { text: 'Please fix the following errors:' });

		const list = contentEl.createEl('ul');
		this.errors.forEach(error => {
			list.createEl('li', { text: error });
		});

		const closeBtn = contentEl.createEl('button', { text: 'OK' });
		closeBtn.addClass('table-builder-btn');
		closeBtn.addEventListener('click', () => this.close());
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
