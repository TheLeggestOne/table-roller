import { TableState, generateMarkdown } from '../utils/TableBuilderUtils';

/**
 * Custom events dispatched by PreviewPanel
 */
export interface CopyToClipboardEvent extends CustomEvent {
	detail: {
		content: string;
	};
}

export interface SaveRequestedEvent extends CustomEvent {
	detail: {
		saveAs: boolean;
	};
}

export interface ExportRequestedEvent extends CustomEvent {
	detail: {
		format: 'md' | 'csv' | 'json';
	};
}

export interface LoadRequestedEvent extends CustomEvent {
	detail: {};
}

export interface ImportFromClipboardEvent extends CustomEvent {
	detail: {};
}

/**
 * PreviewPanel component - manages preview and export UI
 * 
 * Renders Markdown/HTML preview tabs, preview content,
 * and export buttons (copy, save, load, import, export).
 * 
 * Dispatches CustomEvents for all user interactions.
 */
export class PreviewPanel {
	private container: HTMLElement;
	private state: TableState;
	private markdownPreview: HTMLElement | null = null;
	private htmlPreview: HTMLElement | null = null;
	private activeTab: 'markdown' | 'html' = 'markdown';

	constructor(container: HTMLElement, initialState: TableState) {
		this.container = container;
		this.state = initialState;
	}

	/**
	 * Updates the component state and re-renders
	 */
	public updateState(newState: TableState): void {
		this.state = newState;
		this.updatePreview();
	}

	/**
	 * Renders the preview panel UI
	 */
	public render(): void {
		this.container.empty();
		
		// Tabs
		const tabs = this.container.createDiv({ cls: 'preview-tabs' });
		
		const markdownTab = tabs.createEl('button', { 
			text: 'Markdown', 
			cls: 'tab-btn' + (this.activeTab === 'markdown' ? ' active' : '')
		});
		const htmlTab = tabs.createEl('button', { 
			text: 'Preview', 
			cls: 'tab-btn' + (this.activeTab === 'html' ? ' active' : '')
		});
		
		// Tab switching
		markdownTab.addEventListener('click', () => {
			this.activeTab = 'markdown';
			markdownTab.addClass('active');
			htmlTab.removeClass('active');
			if (this.markdownPreview) this.markdownPreview.addClass('active');
			if (this.htmlPreview) this.htmlPreview.removeClass('active');
		});
		
		htmlTab.addEventListener('click', () => {
			this.activeTab = 'html';
			htmlTab.addClass('active');
			markdownTab.removeClass('active');
			if (this.htmlPreview) this.htmlPreview.addClass('active');
			if (this.markdownPreview) this.markdownPreview.removeClass('active');
		});
		
		// Preview containers
		const previewContainer = this.container.createDiv({ cls: 'preview-container' });
		
		this.markdownPreview = previewContainer.createDiv({ 
			cls: 'markdown-preview' + (this.activeTab === 'markdown' ? ' active' : '')
		});
		this.htmlPreview = previewContainer.createDiv({ 
			cls: 'html-preview' + (this.activeTab === 'html' ? ' active' : '')
		});
		
		// Export buttons
		this.renderExportButtons();
		
		// Initial preview update
		this.updatePreview();
	}

	/**
	 * Renders export and action buttons
	 */
	private renderExportButtons(): void {
		const exportBtns = this.container.createDiv({ cls: 'export-buttons' });
		
		// Copy to clipboard
		const copyBtn = exportBtns.createEl('button', { 
			text: 'Copy to Clipboard', 
			cls: 'table-builder-btn' 
		});
		copyBtn.addEventListener('click', () => this.handleCopyToClipboard());
		
		// Save
		const saveBtn = exportBtns.createEl('button', { 
			text: 'Save', 
			cls: 'table-builder-btn' 
		});
		saveBtn.addEventListener('click', () => this.dispatchSaveRequested(false));
		
		// Save As
		const saveAsBtn = exportBtns.createEl('button', { 
			text: 'Save As...', 
			cls: 'table-builder-btn' 
		});
		saveAsBtn.addEventListener('click', () => this.dispatchSaveRequested(true));
		
		// Load
		const loadBtn = exportBtns.createEl('button', { 
			text: 'Load Table', 
			cls: 'table-builder-btn' 
		});
		loadBtn.addEventListener('click', () => this.dispatchLoadRequested());
		
		// Import from clipboard
		const importBtn = exportBtns.createEl('button', { 
			text: 'Import from Clipboard', 
			cls: 'table-builder-btn' 
		});
		importBtn.addEventListener('click', () => this.dispatchImportFromClipboard());
		
		// Export format dropdown and button
		const exportDropdown = exportBtns.createEl('select', { cls: 'export-format' });
		exportDropdown.createEl('option', { text: 'Markdown', value: 'md' });
		exportDropdown.createEl('option', { text: 'CSV', value: 'csv' });
		exportDropdown.createEl('option', { text: 'JSON', value: 'json' });
		
		const exportFileBtn = exportBtns.createEl('button', { 
			text: 'Export As...', 
			cls: 'table-builder-btn' 
		});
		exportFileBtn.addEventListener('click', () => {
			const format = exportDropdown.value as 'md' | 'csv' | 'json';
			this.dispatchExportRequested(format);
		});
	}

	/**
	 * Updates the preview content
	 */
	private updatePreview(): void {
		if (!this.markdownPreview || !this.htmlPreview) return;
		
		// Update markdown preview
		this.markdownPreview.empty();
		const markdown = generateMarkdown(this.state);
		const pre = this.markdownPreview.createEl('pre');
		pre.createEl('code', { text: markdown });
		
		// Update HTML preview
		this.htmlPreview.empty();
		this.renderHTMLPreview(this.htmlPreview);
	}

	/**
	 * Renders HTML preview of the table
	 */
	private renderHTMLPreview(container: HTMLElement): void {
		// Title
		container.createEl('h2', { text: this.state.tableName });
		
		// Directives info
		if (this.state.isPrivate || this.state.tableReroll) {
			const info = container.createDiv({ cls: 'directives-info' });
			if (this.state.isPrivate) {
				info.createSpan({ text: '🔒 Private', cls: 'badge' });
			}
			if (this.state.tableReroll) {
				info.createSpan({ text: `↻ Rerolls: ${this.state.tableReroll}`, cls: 'badge' });
			}
		}
		
		// Render table
		const table = container.createEl('table', { cls: 'preview-table' });
		
		// Header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		this.state.columns.forEach(col => {
			headerRow.createEl('th', { text: col.name });
		});
		
		// Body
		const tbody = table.createEl('tbody');
		this.state.rows.forEach(row => {
			const tr = tbody.createEl('tr');
			this.state.columns.forEach(col => {
				const key = col.type === 'dice' ? 'range' : col.name;
				tr.createEl('td', { text: row[key] || '' });
			});
		});
	}

	/**
	 * Handles copy to clipboard action
	 */
	private handleCopyToClipboard(): void {
		const markdown = generateMarkdown(this.state);
		this.dispatchCopyToClipboard(markdown);
	}

	// Event dispatchers
	private dispatchCopyToClipboard(content: string): void {
		const event = new CustomEvent('copy-to-clipboard', {
			detail: { content },
			bubbles: true
		});
		this.container.dispatchEvent(event);
	}

	private dispatchSaveRequested(saveAs: boolean): void {
		const event = new CustomEvent('save-requested', {
			detail: { saveAs },
			bubbles: true
		});
		this.container.dispatchEvent(event);
	}

	private dispatchExportRequested(format: 'md' | 'csv' | 'json'): void {
		const event = new CustomEvent('export-requested', {
			detail: { format },
			bubbles: true
		});
		this.container.dispatchEvent(event);
	}

	private dispatchLoadRequested(): void {
		const event = new CustomEvent('load-requested', {
			detail: {},
			bubbles: true
		});
		this.container.dispatchEvent(event);
	}

	private dispatchImportFromClipboard(): void {
		const event = new CustomEvent('import-from-clipboard', {
			detail: {},
			bubbles: true
		});
		this.container.dispatchEvent(event);
	}

	/**
	 * Cleanup method to remove event listeners
	 */
	public destroy(): void {
		this.container.empty();
		this.markdownPreview = null;
		this.htmlPreview = null;
	}
}
