/**
 * Fantasy Map Generator - REST API Server
 * Provides HTTP endpoints for external tools to control the map generator
 *
 * Usage:
 *   npm install
 *   node server.js
 *
 * Then access via http://localhost:3000
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { createServer } = require('http');
const { Server: SocketIOServer } = require('socket.io');

// Initialize Express
const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({extended: true, limit: '50mb'}));

// Serve static files from FMG directory
const FMG_ROOT = path.join(__dirname, '..');
app.use('/fmg', express.static(FMG_ROOT));

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 50 * 1024 * 1024} // 50MB
});

// In-memory storage for maps (use database in production)
const maps = new Map();

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * POST /api/maps
 * Create a new map
 * Body: { seed?: string, width?: number, height?: number, ...options }
 */
app.post('/api/maps', async (req, res) => {
  try {
    const options = req.body;
    const mapId = generateMapId();

    // Store map creation request
    maps.set(mapId, {
      id: mapId,
      status: 'pending',
      options,
      createdAt: new Date().toISOString()
    });

    // Notify via WebSocket that map is being created
    io.emit('map:creating', {mapId, options});

    res.status(202).json({
      success: true,
      mapId,
      message: 'Map creation initiated. Use WebSocket or polling to get updates.',
      pollUrl: `/api/maps/${mapId}`,
      websocketEvent: 'map:created'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/maps/:id
 * Get map by ID
 */
app.get('/api/maps/:id', async (req, res) => {
  try {
    const {id} = req.params;
    const map = maps.get(id);

    if (!map) {
      return res.status(404).json({
        success: false,
        error: 'Map not found'
      });
    }

    res.json({
      success: true,
      map
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/maps
 * List all maps
 */
app.get('/api/maps', async (req, res) => {
  try {
    const allMaps = Array.from(maps.values());

    res.json({
      success: true,
      count: allMaps.length,
      maps: allMaps
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/maps/:id
 * Update map data
 * Body: { data: mapData }
 */
app.put('/api/maps/:id', async (req, res) => {
  try {
    const {id} = req.params;
    const {data} = req.body;

    if (!maps.has(id)) {
      return res.status(404).json({
        success: false,
        error: 'Map not found'
      });
    }

    const map = maps.get(id);
    map.data = data;
    map.updatedAt = new Date().toISOString();
    maps.set(id, map);

    // Notify via WebSocket
    io.emit('map:updated', {mapId: id, data});

    res.json({
      success: true,
      map
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/maps/:id
 * Delete a map
 */
app.delete('/api/maps/:id', async (req, res) => {
  try {
    const {id} = req.params;

    if (!maps.has(id)) {
      return res.status(404).json({
        success: false,
        error: 'Map not found'
      });
    }

    maps.delete(id);

    // Notify via WebSocket
    io.emit('map:deleted', {mapId: id});

    res.json({
      success: true,
      message: 'Map deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/maps/:id/load
 * Load map from file
 * Body: multipart/form-data with 'file' field
 */
app.post('/api/maps/:id/load', upload.single('file'), async (req, res) => {
  try {
    const {id} = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    const mapData = req.file.buffer.toString('utf-8');

    if (!maps.has(id)) {
      maps.set(id, {
        id,
        createdAt: new Date().toISOString()
      });
    }

    const map = maps.get(id);
    map.data = mapData;
    map.updatedAt = new Date().toISOString();
    maps.set(id, map);

    // Notify via WebSocket
    io.emit('map:loaded', {mapId: id});

    res.json({
      success: true,
      map
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/maps/:id/export/:format
 * Export map in specified format
 * Formats: svg, png, json, data
 */
app.get('/api/maps/:id/export/:format', async (req, res) => {
  try {
    const {id, format} = req.params;
    const map = maps.get(id);

    if (!map) {
      return res.status(404).json({
        success: false,
        error: 'Map not found'
      });
    }

    // Request export via WebSocket and wait for response
    io.emit('export:request', {mapId: id, format});

    // In a real implementation, you'd wait for the export to complete
    // For now, return a pending response
    res.json({
      success: true,
      message: 'Export requested. Listen to WebSocket event for completion.',
      websocketEvent: `export:completed:${id}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/maps/:id/rivers
 * Get rivers data
 */
app.get('/api/maps/:id/rivers', async (req, res) => {
  try {
    const {id} = req.params;
    const map = maps.get(id);

    if (!map || !map.data) {
      return res.status(404).json({
        success: false,
        error: 'Map not found or no data available'
      });
    }

    res.json({
      success: true,
      rivers: map.data.pack?.rivers || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/maps/:id/rivers
 * Update rivers data
 * Body: { rivers: [...] }
 */
app.put('/api/maps/:id/rivers', async (req, res) => {
  try {
    const {id} = req.params;
    const {rivers} = req.body;
    const map = maps.get(id);

    if (!map) {
      return res.status(404).json({
        success: false,
        error: 'Map not found'
      });
    }

    if (!map.data) {
      map.data = {pack: {}};
    }
    if (!map.data.pack) {
      map.data.pack = {};
    }

    map.data.pack.rivers = rivers;
    map.updatedAt = new Date().toISOString();
    maps.set(id, map);

    // Notify via WebSocket
    io.emit('rivers:updated', {mapId: id, rivers});

    res.json({
      success: true,
      rivers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/maps/:id/rivers/import
 * Import rivers from CSV
 * Body: multipart/form-data with 'file' field
 */
app.post('/api/maps/:id/rivers/import', upload.single('file'), async (req, res) => {
  try {
    const {id} = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    const csvData = req.file.buffer.toString('utf-8');

    // Parse CSV (basic implementation)
    const rows = csvData.split('\n');
    const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
    const rivers = [];

    for (let i = 1; i < rows.length; i++) {
      if (!rows[i].trim()) continue;

      const values = rows[i].split(',');
      const river = {};

      headers.forEach((header, index) => {
        river[header] = values[index]?.trim();
      });

      rivers.push(river);
    }

    // Update map
    const map = maps.get(id);
    if (!map) {
      return res.status(404).json({
        success: false,
        error: 'Map not found'
      });
    }

    if (!map.data) map.data = {pack: {}};
    if (!map.data.pack) map.data.pack = {};

    map.data.pack.rivers = rivers;
    map.updatedAt = new Date().toISOString();
    maps.set(id, map);

    // Notify via WebSocket
    io.emit('rivers:imported', {mapId: id, rivers});

    res.json({
      success: true,
      count: rivers.length,
      rivers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/maps/:id/cultures
 * Get cultures data
 */
app.get('/api/maps/:id/cultures', async (req, res) => {
  try {
    const {id} = req.params;
    const map = maps.get(id);

    if (!map || !map.data) {
      return res.status(404).json({
        success: false,
        error: 'Map not found or no data available'
      });
    }

    res.json({
      success: true,
      cultures: map.data.pack?.cultures || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/maps/:id/states
 * Get states data
 */
app.get('/api/maps/:id/states', async (req, res) => {
  try {
    const {id} = req.params;
    const map = maps.get(id);

    if (!map || !map.data) {
      return res.status(404).json({
        success: false,
        error: 'Map not found or no data available'
      });
    }

    res.json({
      success: true,
      states: map.data.pack?.states || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/maps/:id/burgs
 * Get burgs (cities/towns) data
 */
app.get('/api/maps/:id/burgs', async (req, res) => {
  try {
    const {id} = req.params;
    const map = maps.get(id);

    if (!map || !map.data) {
      return res.status(404).json({
        success: false,
        error: 'Map not found or no data available'
      });
    }

    res.json({
      success: true,
      burgs: map.data.pack?.burgs || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/maps/:id/burgs
 * Add a new burg
 * Body: { name, x, y, cell, population, type, ... }
 */
app.post('/api/maps/:id/burgs', async (req, res) => {
  try {
    const {id} = req.params;
    const burgData = req.body;
    const map = maps.get(id);

    if (!map) {
      return res.status(404).json({
        success: false,
        error: 'Map not found'
      });
    }

    if (!map.data) map.data = {pack: {}};
    if (!map.data.pack) map.data.pack = {};
    if (!map.data.pack.burgs) map.data.pack.burgs = [];

    const newBurg = {
      i: map.data.pack.burgs.length,
      ...burgData
    };

    map.data.pack.burgs.push(newBurg);
    map.updatedAt = new Date().toISOString();
    maps.set(id, map);

    // Notify via WebSocket
    io.emit('burg:added', {mapId: id, burg: newBurg});

    res.json({
      success: true,
      burg: newBurg
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// WEBSOCKET HANDLERS
// ============================================================================

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Client can send updates directly
  socket.on('map:update', (data) => {
    const {mapId, updates} = data;
    const map = maps.get(mapId);

    if (map) {
      Object.assign(map, updates);
      map.updatedAt = new Date().toISOString();
      maps.set(mapId, map);

      // Broadcast to all clients
      io.emit('map:updated', {mapId, updates});
    }
  });

  socket.on('map:created', (data) => {
    const {mapId, mapData} = data;
    const map = maps.get(mapId);

    if (map) {
      map.status = 'ready';
      map.data = mapData;
      map.readyAt = new Date().toISOString();
      maps.set(mapId, map);

      // Broadcast to all clients
      io.emit('map:created', {mapId, mapData});
    }
  });

  socket.on('export:completed', (data) => {
    const {mapId, format, exportData} = data;

    // Broadcast to all clients
    io.emit(`export:completed:${mapId}`, {format, exportData});
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ============================================================================
// STATIC PAGES
// ============================================================================

// Serve demo page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Fantasy Map Generator - API Server</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          line-height: 1.6;
        }
        h1 { color: #2c3e50; }
        h2 { color: #34495e; margin-top: 30px; }
        .endpoint {
          background: #f8f9fa;
          border-left: 4px solid #007bff;
          padding: 15px;
          margin: 10px 0;
          border-radius: 4px;
        }
        .method {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: bold;
          color: white;
          font-size: 12px;
          margin-right: 10px;
        }
        .get { background: #28a745; }
        .post { background: #007bff; }
        .put { background: #ffc107; color: #000; }
        .delete { background: #dc3545; }
        code {
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
        }
        pre {
          background: #2d2d2d;
          color: #f8f8f2;
          padding: 15px;
          border-radius: 4px;
          overflow-x: auto;
        }
        .status { color: #28a745; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>Fantasy Map Generator - API Server</h1>
      <p class="status">✓ Server is running</p>

      <h2>REST API Endpoints</h2>

      <div class="endpoint">
        <span class="method get">GET</span>
        <code>/api/health</code>
        <p>Health check endpoint</p>
      </div>

      <div class="endpoint">
        <span class="method post">POST</span>
        <code>/api/maps</code>
        <p>Create a new map</p>
        <pre>{
  "seed": "optional-seed",
  "width": 1920,
  "height": 1080
}</pre>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <code>/api/maps</code>
        <p>List all maps</p>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <code>/api/maps/:id</code>
        <p>Get specific map by ID</p>
      </div>

      <div class="endpoint">
        <span class="method put">PUT</span>
        <code>/api/maps/:id</code>
        <p>Update map data</p>
      </div>

      <div class="endpoint">
        <span class="method delete">DELETE</span>
        <code>/api/maps/:id</code>
        <p>Delete a map</p>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <code>/api/maps/:id/rivers</code>
        <p>Get rivers data</p>
      </div>

      <div class="endpoint">
        <span class="method put">PUT</span>
        <code>/api/maps/:id/rivers</code>
        <p>Update rivers data</p>
      </div>

      <div class="endpoint">
        <span class="method post">POST</span>
        <code>/api/maps/:id/rivers/import</code>
        <p>Import rivers from CSV file</p>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <code>/api/maps/:id/cultures</code>
        <p>Get cultures data</p>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <code>/api/maps/:id/states</code>
        <p>Get states data</p>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <code>/api/maps/:id/burgs</code>
        <p>Get burgs (cities/towns) data</p>
      </div>

      <div class="endpoint">
        <span class="method post">POST</span>
        <code>/api/maps/:id/burgs</code>
        <p>Add a new burg</p>
      </div>

      <h2>WebSocket Events</h2>
      <p>Connect to WebSocket at: <code>ws://localhost:3000</code></p>

      <div class="endpoint">
        <strong>Server Events:</strong>
        <ul>
          <li><code>map:creating</code> - Map creation started</li>
          <li><code>map:created</code> - Map creation completed</li>
          <li><code>map:updated</code> - Map data updated</li>
          <li><code>map:deleted</code> - Map deleted</li>
          <li><code>rivers:updated</code> - Rivers data updated</li>
          <li><code>rivers:imported</code> - Rivers imported from CSV</li>
          <li><code>burg:added</code> - New burg added</li>
        </ul>
      </div>

      <h2>Integration Examples</h2>
      <p>Visit these demo pages:</p>
      <ul>
        <li><a href="/demos/postmessage-demo.html">PostMessage Demo (iframe integration)</a></li>
        <li><a href="/demos/rest-api-demo.html">REST API Demo</a></li>
        <li><a href="/demos/websocket-demo.html">WebSocket Demo</a></li>
      </ul>

      <h2>Quick Start</h2>
      <pre>// Create a new map
curl -X POST http://localhost:3000/api/maps \\
  -H "Content-Type: application/json" \\
  -d '{"seed": "my-custom-seed"}'

// Get map data
curl http://localhost:3000/api/maps/MAP_ID

// Update rivers
curl -X PUT http://localhost:3000/api/maps/MAP_ID/rivers \\
  -H "Content-Type: application/json" \\
  -d '{"rivers": [...]}'</pre>
    </body>
    </html>
  `);
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateMapId() {
  return 'map_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('Fantasy Map Generator - API Server');
  console.log('='.repeat(60));
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
  console.log('');
  console.log('REST API:    http://localhost:' + PORT + '/api');
  console.log('Documentation: http://localhost:' + PORT);
  console.log('='.repeat(60));
});
