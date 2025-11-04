/**
 * Fantasy Map Generator - JavaScript Client Library
 *
 * A simple client library for interacting with the FMG REST API
 *
 * Usage:
 *   const client = new FMGClient('http://localhost:3000/api');
 *   const map = await client.createMap({ seed: 'my-world' });
 */

class FMGClient {
  constructor(baseUrl = 'http://localhost:3000/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Make API request
   * @private
   */
  async _request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      method: options.method || 'GET',
      headers: {
        ...options.headers
      }
    };

    if (options.body) {
      if (options.body instanceof FormData) {
        config.body = options.body;
      } else {
        config.headers['Content-Type'] = 'application/json';
        config.body = JSON.stringify(options.body);
      }
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  // ============================================================================
  // HEALTH
  // ============================================================================

  /**
   * Check API health
   * @returns {Promise<Object>} Health status
   */
  async health() {
    return this._request('/health');
  }

  // ============================================================================
  // MAP OPERATIONS
  // ============================================================================

  /**
   * Create a new map
   * @param {Object} options - Map options
   * @param {string} options.seed - Map seed
   * @param {number} options.width - Map width
   * @param {number} options.height - Map height
   * @returns {Promise<Object>} Created map info
   */
  async createMap(options = {}) {
    return this._request('/maps', {
      method: 'POST',
      body: options
    });
  }

  /**
   * Get map by ID
   * @param {string} mapId - Map ID
   * @returns {Promise<Object>} Map data
   */
  async getMap(mapId) {
    return this._request(`/maps/${mapId}`);
  }

  /**
   * List all maps
   * @returns {Promise<Object>} Map list
   */
  async listMaps() {
    return this._request('/maps');
  }

  /**
   * Update map
   * @param {string} mapId - Map ID
   * @param {Object} data - Map data
   * @returns {Promise<Object>} Updated map
   */
  async updateMap(mapId, data) {
    return this._request(`/maps/${mapId}`, {
      method: 'PUT',
      body: { data }
    });
  }

  /**
   * Delete map
   * @param {string} mapId - Map ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteMap(mapId) {
    return this._request(`/maps/${mapId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Load map from file
   * @param {string} mapId - Map ID
   * @param {File} file - Map file
   * @returns {Promise<Object>} Load result
   */
  async loadMap(mapId, file) {
    const formData = new FormData();
    formData.append('file', file);

    return this._request(`/maps/${mapId}/load`, {
      method: 'POST',
      body: formData
    });
  }

  // ============================================================================
  // RIVERS
  // ============================================================================

  /**
   * Get rivers
   * @param {string} mapId - Map ID
   * @returns {Promise<Array>} Rivers array
   */
  async getRivers(mapId) {
    const result = await this._request(`/maps/${mapId}/rivers`);
    return result.rivers;
  }

  /**
   * Update rivers
   * @param {string} mapId - Map ID
   * @param {Array} rivers - Rivers array
   * @returns {Promise<Object>} Update result
   */
  async updateRivers(mapId, rivers) {
    return this._request(`/maps/${mapId}/rivers`, {
      method: 'PUT',
      body: { rivers }
    });
  }

  /**
   * Import rivers from CSV
   * @param {string} mapId - Map ID
   * @param {File} csvFile - CSV file
   * @returns {Promise<Object>} Import result
   */
  async importRiversCSV(mapId, csvFile) {
    const formData = new FormData();
    formData.append('file', csvFile);

    return this._request(`/maps/${mapId}/rivers/import`, {
      method: 'POST',
      body: formData
    });
  }

  // ============================================================================
  // CULTURES
  // ============================================================================

  /**
   * Get cultures
   * @param {string} mapId - Map ID
   * @returns {Promise<Array>} Cultures array
   */
  async getCultures(mapId) {
    const result = await this._request(`/maps/${mapId}/cultures`);
    return result.cultures;
  }

  // ============================================================================
  // STATES
  // ============================================================================

  /**
   * Get states
   * @param {string} mapId - Map ID
   * @returns {Promise<Array>} States array
   */
  async getStates(mapId) {
    const result = await this._request(`/maps/${mapId}/states`);
    return result.states;
  }

  // ============================================================================
  // BURGS
  // ============================================================================

  /**
   * Get burgs (cities/towns)
   * @param {string} mapId - Map ID
   * @returns {Promise<Array>} Burgs array
   */
  async getBurgs(mapId) {
    const result = await this._request(`/maps/${mapId}/burgs`);
    return result.burgs;
  }

  /**
   * Add new burg
   * @param {string} mapId - Map ID
   * @param {Object} burgData - Burg data
   * @returns {Promise<Object>} Created burg
   */
  async addBurg(mapId, burgData) {
    return this._request(`/maps/${mapId}/burgs`, {
      method: 'POST',
      body: burgData
    });
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  /**
   * Export map in specified format
   * @param {string} mapId - Map ID
   * @param {string} format - Export format (svg, png, json, data)
   * @returns {Promise<Object>} Export result
   */
  async exportMap(mapId, format) {
    return this._request(`/maps/${mapId}/export/${format}`);
  }
}

// Export for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FMGClient;
}

if (typeof window !== 'undefined') {
  window.FMGClient = FMGClient;
}
