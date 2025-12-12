/**
 * Runtime adapter for handling different execution environments
 * Abstracts file system and path operations for CLI vs Plugin modes
 */
export class RuntimeAdapter {
  constructor(mode = 'standalone') {
    this.mode = mode; // 'standalone' or 'plugin'
    this.fs = null;
    this.path = null;
    this.vault = null; // Obsidian vault reference (plugin mode only)
  }

  /**
   * Initialize the adapter for the current runtime environment
   * @param {Object} options - Configuration options
   * @param {Object} options.vault - Obsidian vault (plugin mode)
   */
  async initialize(options = {}) {
    if (this.mode === 'standalone') {
      // CLI mode - use Node.js fs/path
      const fs = await import('fs');
      const path = await import('path');
      this.fs = fs.default || fs;
      this.path = path.default || path;
    } else if (this.mode === 'plugin') {
      // Plugin mode - use Obsidian API
      this.vault = options.vault;
      if (!this.vault) {
        throw new Error('Vault reference required for plugin mode');
      }
    }
  }

  /**
   * Check if a path exists
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>}
   */
  async exists(filePath) {
    if (this.mode === 'standalone') {
      return this.fs.existsSync(filePath);
    } else {
      // In Obsidian, check if file exists
      const file = this.vault.getAbstractFileByPath(filePath);
      return file !== null;
    }
  }

  /**
   * Read file contents
   * @param {string} filePath - Path to file
   * @returns {Promise<string>}
   */
  async readFile(filePath) {
    if (this.mode === 'standalone') {
      return this.fs.readFileSync(filePath, 'utf-8');
    } else {
      const file = this.vault.getAbstractFileByPath(filePath);
      if (!file) {
        throw new Error(`File not found: ${filePath}`);
      }
      return await this.vault.read(file);
    }
  }

  /**
   * Find all markdown files in a directory
   * @param {string} dir - Directory to search
   * @returns {Promise<string[]>} Array of file paths
   */
  async findMarkdownFiles(dir) {
    if (this.mode === 'standalone') {
      return this._findMarkdownFilesNode(dir);
    } else {
      return this._findMarkdownFilesObsidian(dir);
    }
  }

  /**
   * Get basename of a path
   * @param {string} filePath - File path
   * @param {string} ext - Extension to remove (optional)
   * @returns {string}
   */
  basename(filePath, ext) {
    if (this.mode === 'standalone') {
      return this.path.basename(filePath, ext);
    } else {
      // Simple implementation for Obsidian
      const parts = filePath.split('/');
      let name = parts[parts.length - 1];
      if (ext && name.endsWith(ext)) {
        name = name.slice(0, -ext.length);
      }
      return name;
    }
  }

  /**
   * Join path segments
   * @param {...string} segments - Path segments
   * @returns {string}
   */
  join(...segments) {
    if (this.mode === 'standalone') {
      return this.path.join(...segments);
    } else {
      // Obsidian uses forward slashes
      return segments.join('/').replace(/\/+/g, '/');
    }
  }

  // Private helper methods

  _findMarkdownFilesNode(dir) {
    let results = [];
    const items = this.fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = this.path.join(dir, item);
      const stat = this.fs.statSync(fullPath);

      if (stat.isDirectory()) {
        results = results.concat(this._findMarkdownFilesNode(fullPath));
      } else if (item.endsWith('.md')) {
        results.push(fullPath);
      }
    }

    return results;
  }

  _findMarkdownFilesObsidian(dir) {
    const results = [];
    const files = this.vault.getMarkdownFiles();
    
    for (const file of files) {
      // Check if file is in the specified directory
      if (file.path.startsWith(dir)) {
        results.push(file.path);
      }
    }

    return results;
  }
}
