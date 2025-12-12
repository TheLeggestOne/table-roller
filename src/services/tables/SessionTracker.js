/**
 * Tracks rolled results and prevents duplicates
 */
export class SessionTracker {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Create a new session
   * @param {string} sessionId - Session identifier
   */
  createSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        results: new Map(),
        history: []
      });
    }
  }

  /**
   * Record a result for a table in a session
   * @param {string} sessionId - Session identifier
   * @param {string} tableName - Name of the table
   * @param {*} result - The rolled result
   */
  addResult(sessionId, tableName, result) {
    this.createSession(sessionId);
    const session = this.sessions.get(sessionId);
    
    if (!session.results.has(tableName)) {
      session.results.set(tableName, new Set());
    }
    
    const key = this.getResultKey(result);
    session.results.get(tableName).add(key);
    session.history.push({
      timestamp: new Date(),
      tableName,
      result
    });
  }

  /**
   * Check if a result has been rolled before
   * @param {string} sessionId - Session identifier
   * @param {string} tableName - Name of the table
   * @param {*} result - The result to check
   * @returns {boolean} Whether result is a duplicate
   */
  isDuplicate(sessionId, tableName, result) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.results.has(tableName)) {
      return false;
    }
    
    const key = this.getResultKey(result);
    return session.results.get(tableName).has(key);
  }

  /**
   * Get all results for a table in a session
   * @param {string} sessionId - Session identifier
   * @param {string} tableName - Name of the table
   * @returns {Array} Array of result keys
   */
  getResults(sessionId, tableName) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.results.has(tableName)) {
      return [];
    }
    return Array.from(session.results.get(tableName));
  }

  /**
   * Get session history
   * @param {string} sessionId - Session identifier
   * @returns {Array} History entries
   */
  getHistory(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.history : [];
  }

  /**
   * Clear a session
   * @param {string} sessionId - Session identifier
   */
  clearSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  /**
   * Get a unique key for a result
   * @param {*} result - Result object or value
   * @returns {string} Unique key
   */
  getResultKey(result) {
    if (typeof result === 'object' && result !== null) {
      // Create key from result properties (excluding metadata like _roll)
      const copy = { ...result };
      delete copy._roll;
      delete copy._chain;
      return JSON.stringify(copy);
    }
    return String(result);
  }
}
