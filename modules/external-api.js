/**
 * External API Bridge for Fantasy Map Generator
 * Provides a clean interface for external tools (wikis, web UIs) to interact with FMG
 * @module external-api
 * @version 1.0.0
 */

(function() {
  'use strict';

  // ============================================================================
  // EVENT EMITTER SYSTEM
  // ============================================================================

  class EventEmitter {
    constructor() {
      this.events = {};
    }

    on(event, callback) {
      if (!this.events[event]) {
        this.events[event] = [];
      }
      this.events[event].push(callback);
      return () => this.off(event, callback);
    }

    off(event, callback) {
      if (!this.events[event]) return;
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    emit(event, data) {
      if (!this.events[event]) return;
      this.events[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }

    once(event, callback) {
      const wrapper = (data) => {
        callback(data);
        this.off(event, wrapper);
      };
      this.on(event, wrapper);
    }
  }

  const eventEmitter = new EventEmitter();

  // ============================================================================
  // STATE MANAGEMENT & CHANGE DETECTION
  // ============================================================================

  let isInitialized = false;
  let lastState = null;
  let changeDetectionEnabled = true;

  function initializeChangeDetection() {
    if (isInitialized) return;

    // Observe SVG changes for map updates
    const mapElement = document.getElementById('map');
    if (mapElement) {
      const observer = new MutationObserver(debounce(() => {
        if (changeDetectionEnabled) {
          eventEmitter.emit('map:changed', getMapState());
        }
      }, 500));

      observer.observe(mapElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['d', 'transform', 'points']
      });
    }

    isInitialized = true;
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // ============================================================================
  // CORE API METHODS
  // ============================================================================

  const API = {

    // ------------------------------------------------------------------------
    // MAP LIFECYCLE
    // ------------------------------------------------------------------------

    /**
     * Create a new map with optional parameters
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} Map state
     */
    async createMap(options = {}) {
      try {
        changeDetectionEnabled = false;

        if (options.seed) {
          seed = options.seed;
        }

        // Use existing generate function
        await generate(options);

        changeDetectionEnabled = true;
        eventEmitter.emit('map:created', getMapState());

        return {
          success: true,
          state: getMapState()
        };
      } catch (error) {
        changeDetectionEnabled = true;
        return {
          success: false,
          error: error.message
        };
      }
    },

    /**
     * Load map from data
     * @param {String|Blob|File} mapData - Map data to load
     * @returns {Promise<Object>} Load result
     */
    async loadMap(mapData) {
      try {
        changeDetectionEnabled = false;

        let file;
        if (typeof mapData === 'string') {
          // Convert string data to Blob
          file = new Blob([mapData], {type: 'text/plain'});
        } else {
          file = mapData;
        }

        await new Promise((resolve, reject) => {
          uploadMap(file, (error) => {
            if (error) reject(error);
            else resolve();
          });
        });

        changeDetectionEnabled = true;
        eventEmitter.emit('map:loaded', getMapState());

        return {
          success: true,
          state: getMapState()
        };
      } catch (error) {
        changeDetectionEnabled = true;
        return {
          success: false,
          error: error.message
        };
      }
    },

    /**
     * Save current map
     * @param {String} format - 'data' or 'blob'
     * @returns {Promise<Object>} Saved map data
     */
    async saveMap(format = 'data') {
      try {
        const mapData = await prepareMapData();

        if (format === 'blob') {
          return {
            success: true,
            data: new Blob([mapData], {type: 'text/plain'}),
            filename: getFileName() + '.map'
          };
        }

        return {
          success: true,
          data: mapData,
          filename: getFileName() + '.map'
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    },

    // ------------------------------------------------------------------------
    // DATA ACCESS
    // ------------------------------------------------------------------------

    /**
     * Get complete map state
     * @returns {Object} Current map state
     */
    getMapState() {
      return getMapState();
    },

    /**
     * Get specific data structure
     * @param {String} key - Data key (rivers, cultures, states, burgs, etc.)
     * @returns {*} Requested data
     */
    getData(key) {
      if (!pack || !pack[key]) {
        return null;
      }
      return JSON.parse(JSON.stringify(pack[key]));
    },

    /**
     * Get rivers data
     * @returns {Array} Rivers array
     */
    getRivers() {
      return pack.rivers ? JSON.parse(JSON.stringify(pack.rivers)) : [];
    },

    /**
     * Get cultures data
     * @returns {Array} Cultures array
     */
    getCultures() {
      return pack.cultures ? JSON.parse(JSON.stringify(pack.cultures)) : [];
    },

    /**
     * Get states data
     * @returns {Array} States array
     */
    getStates() {
      return pack.states ? JSON.parse(JSON.stringify(pack.states)) : [];
    },

    /**
     * Get burgs (cities/towns) data
     * @returns {Array} Burgs array
     */
    getBurgs() {
      return pack.burgs ? JSON.parse(JSON.stringify(pack.burgs)) : [];
    },

    /**
     * Get religions data
     * @returns {Array} Religions array
     */
    getReligions() {
      return pack.religions ? JSON.parse(JSON.stringify(pack.religions)) : [];
    },

    /**
     * Get markers data
     * @returns {Array} Markers array
     */
    getMarkers() {
      return pack.markers ? JSON.parse(JSON.stringify(pack.markers)) : [];
    },

    /**
     * Get grid data
     * @returns {Object} Grid object with cells data
     */
    getGrid() {
      if (!grid) return null;

      return {
        spacing: grid.spacing,
        cellsX: grid.cellsX,
        cellsY: grid.cellsY,
        features: grid.features,
        boundary: grid.boundary
      };
    },

    // ------------------------------------------------------------------------
    // MUTATIONS
    // ------------------------------------------------------------------------

    /**
     * Update rivers data
     * @param {Array} rivers - New rivers array
     * @returns {Object} Update result
     */
    updateRivers(rivers) {
      try {
        changeDetectionEnabled = false;

        pack.rivers = rivers;

        // Redraw rivers
        if (window.Rivers && Rivers.specify) {
          Rivers.specify();
        }
        if (typeof drawRivers === 'function') {
          drawRivers();
        }

        changeDetectionEnabled = true;
        eventEmitter.emit('rivers:updated', pack.rivers);

        return {success: true};
      } catch (error) {
        changeDetectionEnabled = true;
        return {success: false, error: error.message};
      }
    },

    /**
     * Update cultures data
     * @param {Array} cultures - New cultures array
     * @returns {Object} Update result
     */
    updateCultures(cultures) {
      try {
        changeDetectionEnabled = false;

        pack.cultures = cultures;

        // Redraw cultures
        if (typeof drawCultures === 'function') {
          drawCultures();
        }

        changeDetectionEnabled = true;
        eventEmitter.emit('cultures:updated', pack.cultures);

        return {success: true};
      } catch (error) {
        changeDetectionEnabled = true;
        return {success: false, error: error.message};
      }
    },

    /**
     * Update states data
     * @param {Array} states - New states array
     * @returns {Object} Update result
     */
    updateStates(states) {
      try {
        changeDetectionEnabled = false;

        pack.states = states;

        // Redraw states
        if (typeof drawStates === 'function') {
          drawStates();
        }
        if (typeof drawBorders === 'function') {
          drawBorders();
        }

        changeDetectionEnabled = true;
        eventEmitter.emit('states:updated', pack.states);

        return {success: true};
      } catch (error) {
        changeDetectionEnabled = true;
        return {success: false, error: error.message};
      }
    },

    /**
     * Update burgs (cities/towns) data
     * @param {Array} burgs - New burgs array
     * @returns {Object} Update result
     */
    updateBurgs(burgs) {
      try {
        changeDetectionEnabled = false;

        pack.burgs = burgs;

        // Redraw burgs
        if (typeof drawBurgs === 'function') {
          drawBurgs();
        }

        changeDetectionEnabled = true;
        eventEmitter.emit('burgs:updated', pack.burgs);

        return {success: true};
      } catch (error) {
        changeDetectionEnabled = true;
        return {success: false, error: error.message};
      }
    },

    /**
     * Add a new burg (city/town)
     * @param {Object} burgData - Burg properties
     * @returns {Object} Result with new burg ID
     */
    addBurg(burgData) {
      try {
        const newId = pack.burgs.length;
        const burg = {
          i: newId,
          cell: burgData.cell || 0,
          x: burgData.x || 0,
          y: burgData.y || 0,
          name: burgData.name || Names.getCulture(burgData.culture || 0),
          population: burgData.population || 1,
          type: burgData.type || 'town',
          ...burgData
        };

        pack.burgs.push(burg);

        if (typeof drawBurgs === 'function') {
          drawBurgs();
        }

        eventEmitter.emit('burg:added', burg);

        return {success: true, id: newId, burg};
      } catch (error) {
        return {success: false, error: error.message};
      }
    },

    // ------------------------------------------------------------------------
    // EXPORT
    // ------------------------------------------------------------------------

    /**
     * Export map as SVG
     * @returns {String} SVG string
     */
    exportSVG() {
      const svgElement = document.getElementById('map');
      if (!svgElement) return null;
      return svgElement.outerHTML;
    },

    /**
     * Export map as PNG
     * @param {Number} width - Image width
     * @param {Number} height - Image height
     * @returns {Promise<Blob>} PNG blob
     */
    async exportPNG(width = 2048, height = 2048) {
      return new Promise((resolve, reject) => {
        try {
          const svgElement = document.getElementById('map');
          const svgString = new XMLSerializer().serializeToString(svgElement);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          const img = new Image();
          const blob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
          const url = URL.createObjectURL(blob);

          img.onload = function() {
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => {
              resolve(blob);
            }, 'image/png');
          };

          img.onerror = reject;
          img.src = url;
        } catch (error) {
          reject(error);
        }
      });
    },

    /**
     * Export specific data as JSON
     * @param {String} key - Data key
     * @returns {String} JSON string
     */
    exportJSON(key) {
      const data = key ? API.getData(key) : getMapState();
      return JSON.stringify(data, null, 2);
    },

    // ------------------------------------------------------------------------
    // EVENTS
    // ------------------------------------------------------------------------

    /**
     * Subscribe to events
     * @param {String} event - Event name
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
      return eventEmitter.on(event, callback);
    },

    /**
     * Unsubscribe from events
     * @param {String} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
      eventEmitter.off(event, callback);
    },

    /**
     * Subscribe to event once
     * @param {String} event - Event name
     * @param {Function} callback - Callback function
     */
    once(event, callback) {
      eventEmitter.once(event, callback);
    },

    /**
     * Emit custom event
     * @param {String} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
      eventEmitter.emit(event, data);
    }
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  function getMapState() {
    return {
      seed: typeof seed !== 'undefined' ? seed : null,
      mapId: typeof mapId !== 'undefined' ? mapId : null,
      timestamp: Date.now(),
      pack: pack ? {
        cultures: pack.cultures || [],
        states: pack.states || [],
        burgs: pack.burgs || [],
        rivers: pack.rivers || [],
        religions: pack.religions || [],
        provinces: pack.provinces || [],
        markers: pack.markers || []
      } : null,
      grid: grid ? {
        spacing: grid.spacing,
        cellsX: grid.cellsX,
        cellsY: grid.cellsY,
        features: grid.features
      } : null,
      options: typeof options !== 'undefined' ? options : null
    };
  }

  // ============================================================================
  // POSTMESSAGE BRIDGE
  // ============================================================================

  const PostMessageBridge = {
    enabled: false,
    targetOrigin: '*',

    /**
     * Enable PostMessage communication
     * @param {String} origin - Target origin for postMessage (default: '*')
     */
    enable(origin = '*') {
      if (this.enabled) return;

      this.targetOrigin = origin;
      this.enabled = true;

      // Listen for messages from parent window
      window.addEventListener('message', this.handleMessage.bind(this));

      // Forward all events to parent
      this.setupEventForwarding();

      console.log('[FMG API] PostMessage bridge enabled');
    },

    /**
     * Disable PostMessage communication
     */
    disable() {
      this.enabled = false;
      window.removeEventListener('message', this.handleMessage.bind(this));
      console.log('[FMG API] PostMessage bridge disabled');
    },

    /**
     * Handle incoming messages
     */
    async handleMessage(event) {
      if (!this.enabled) return;

      const {type, payload, requestId} = event.data;
      if (!type) return;

      console.log('[FMG API] Received message:', type, payload);

      try {
        let result;

        switch(type) {
          // Map lifecycle
          case 'CREATE_MAP':
            result = await API.createMap(payload);
            break;
          case 'LOAD_MAP':
            result = await API.loadMap(payload);
            break;
          case 'SAVE_MAP':
            result = await API.saveMap(payload?.format);
            break;

          // Data access
          case 'GET_STATE':
            result = {success: true, data: API.getMapState()};
            break;
          case 'GET_DATA':
            result = {success: true, data: API.getData(payload?.key)};
            break;
          case 'GET_RIVERS':
            result = {success: true, data: API.getRivers()};
            break;
          case 'GET_CULTURES':
            result = {success: true, data: API.getCultures()};
            break;
          case 'GET_STATES':
            result = {success: true, data: API.getStates()};
            break;
          case 'GET_BURGS':
            result = {success: true, data: API.getBurgs()};
            break;

          // Mutations
          case 'UPDATE_RIVERS':
            result = API.updateRivers(payload);
            break;
          case 'UPDATE_CULTURES':
            result = API.updateCultures(payload);
            break;
          case 'UPDATE_STATES':
            result = API.updateStates(payload);
            break;
          case 'UPDATE_BURGS':
            result = API.updateBurgs(payload);
            break;
          case 'ADD_BURG':
            result = API.addBurg(payload);
            break;

          // Export
          case 'EXPORT_SVG':
            result = {success: true, data: API.exportSVG()};
            break;
          case 'EXPORT_PNG':
            const blob = await API.exportPNG(payload?.width, payload?.height);
            const reader = new FileReader();
            result = await new Promise((resolve) => {
              reader.onload = () => resolve({success: true, data: reader.result});
              reader.readAsDataURL(blob);
            });
            break;
          case 'EXPORT_JSON':
            result = {success: true, data: API.exportJSON(payload?.key)};
            break;

          default:
            result = {success: false, error: `Unknown message type: ${type}`};
        }

        // Send response
        this.sendMessage('RESPONSE', result, requestId);
      } catch (error) {
        this.sendMessage('ERROR', {
          success: false,
          error: error.message
        }, requestId);
      }
    },

    /**
     * Send message to parent window
     */
    sendMessage(type, payload, requestId = null) {
      if (!this.enabled) return;
      if (window.parent === window) return; // Not in iframe

      window.parent.postMessage({
        type,
        payload,
        requestId,
        timestamp: Date.now()
      }, this.targetOrigin);
    },

    /**
     * Forward API events to parent window
     */
    setupEventForwarding() {
      const events = [
        'map:created',
        'map:loaded',
        'map:changed',
        'rivers:updated',
        'cultures:updated',
        'states:updated',
        'burgs:updated',
        'burg:added'
      ];

      events.forEach(event => {
        API.on(event, (data) => {
          this.sendMessage('EVENT', {event, data});
        });
      });
    }
  };

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  // Initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeChangeDetection();
    });
  } else {
    initializeChangeDetection();
  }

  // Auto-enable PostMessage if in iframe
  if (window.self !== window.top) {
    setTimeout(() => PostMessageBridge.enable(), 1000);
  }

  // ============================================================================
  // EXPORT API
  // ============================================================================

  window.FMG_API = API;
  window.FMG_PostMessageBridge = PostMessageBridge;

  console.log('[FMG API] External API initialized. Access via window.FMG_API');
  console.log('[FMG API] Available methods:', Object.keys(API));

})();
