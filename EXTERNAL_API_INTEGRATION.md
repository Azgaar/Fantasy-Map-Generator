# External API Integration Guide

This guide explains how to integrate Fantasy Map Generator (FMG) with external tools like wikis, web UIs, or other applications.

## Table of Contents

- [Overview](#overview)
- [Integration Methods](#integration-methods)
  - [1. PostMessage Bridge (iframe)](#1-postmessage-bridge-iframe)
  - [2. REST API Server](#2-rest-api-server)
  - [3. Direct JavaScript API](#3-direct-javascript-api)
- [API Reference](#api-reference)
- [Events](#events)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Fantasy Map Generator now includes an **External API** that allows external applications to:

- Control map generation and loading
- Access and modify map data (rivers, cultures, states, burgs, etc.)
- Listen to real-time map changes
- Export maps in various formats
- Synchronize state bidirectionally

### Key Features

✅ **Event-driven architecture** - Subscribe to map changes
✅ **PostMessage bridge** - Embed FMG in iframe and control it
✅ **REST API server** - HTTP endpoints for server-side integration
✅ **WebSocket support** - Real-time bidirectional communication
✅ **Type-safe data access** - Clean API with error handling

---

## Integration Methods

### 1. PostMessage Bridge (iframe)

**Best for:** Web-based wikis, browser extensions, web apps on different domains

#### How It Works

1. Embed FMG in an `<iframe>`
2. Send commands via `postMessage()`
3. Receive responses and events automatically

#### Example

```html
<!-- Your Wiki/Web UI -->
<!DOCTYPE html>
<html>
<body>
  <!-- Embed FMG -->
  <iframe id="mapFrame" src="https://your-fmg-instance.com/index.html"></iframe>

  <script>
    const mapFrame = document.getElementById('mapFrame').contentWindow;

    // Wait for iframe to load
    window.addEventListener('load', () => {
      // Create a new map
      mapFrame.postMessage({
        type: 'CREATE_MAP',
        payload: { seed: 'my-world' },
        requestId: 1
      }, '*');
    });

    // Listen for responses
    window.addEventListener('message', (event) => {
      const { type, payload, requestId } = event.data;

      if (type === 'RESPONSE' && requestId === 1) {
        console.log('Map created!', payload);
      }

      if (type === 'EVENT' && payload.event === 'rivers:updated') {
        console.log('Rivers updated:', payload.data);
      }
    });
  </script>
</body>
</html>
```

#### Available Commands

Send these via `postMessage()`:

```javascript
// Map Lifecycle
{ type: 'CREATE_MAP', payload: { seed, width, height } }
{ type: 'LOAD_MAP', payload: mapData }
{ type: 'SAVE_MAP', payload: { format: 'data' | 'blob' } }

// Data Access
{ type: 'GET_STATE' }
{ type: 'GET_RIVERS' }
{ type: 'GET_CULTURES' }
{ type: 'GET_STATES' }
{ type: 'GET_BURGS' }

// Mutations
{ type: 'UPDATE_RIVERS', payload: [...] }
{ type: 'UPDATE_CULTURES', payload: [...] }
{ type: 'UPDATE_STATES', payload: [...] }
{ type: 'ADD_BURG', payload: {name, x, y, ...} }

// Export
{ type: 'EXPORT_SVG' }
{ type: 'EXPORT_PNG', payload: {width, height} }
{ type: 'EXPORT_JSON', payload: {key} }
```

#### Demo

See `demos/postmessage-demo.html` for a full interactive example.

---

### 2. REST API Server

**Best for:** Server-side integration, microservices, backend systems

#### Setup

1. Install dependencies:
```bash
cd api-server
npm install
```

2. Start the server:
```bash
node server.js
# Server runs on http://localhost:3000
```

#### Endpoints

##### Health Check
```
GET /api/health
```

##### Create Map
```
POST /api/maps
Body: { seed?: string, width?: number, height?: number }
Response: { success: true, mapId: string, pollUrl: string }
```

##### Get Map
```
GET /api/maps/:id
Response: { success: true, map: {...} }
```

##### List Maps
```
GET /api/maps
Response: { success: true, maps: [...] }
```

##### Update Map
```
PUT /api/maps/:id
Body: { data: {...} }
```

##### Delete Map
```
DELETE /api/maps/:id
```

##### Get/Update Rivers
```
GET /api/maps/:id/rivers
PUT /api/maps/:id/rivers
Body: { rivers: [...] }
```

##### Import Rivers from CSV
```
POST /api/maps/:id/rivers/import
Body: multipart/form-data with 'file' field
```

##### Get Cultures/States/Burgs
```
GET /api/maps/:id/cultures
GET /api/maps/:id/states
GET /api/maps/:id/burgs
```

##### Add Burg
```
POST /api/maps/:id/burgs
Body: { name, x, y, cell, population, type }
```

#### Example Usage

```javascript
// Create a new map
const response = await fetch('http://localhost:3000/api/maps', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ seed: 'my-world' })
});

const { mapId } = await response.json();

// Get rivers
const riversResponse = await fetch(`http://localhost:3000/api/maps/${mapId}/rivers`);
const { rivers } = await riversResponse.json();

console.log('Rivers:', rivers);

// Update rivers
await fetch(`http://localhost:3000/api/maps/${mapId}/rivers`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    rivers: [
      { i: 1, name: 'Mystic River', type: 'River', discharge: 100 }
    ]
  })
});
```

#### WebSocket Events

Connect to `ws://localhost:3000` for real-time updates:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected!');
});

// Listen to events
socket.on('map:created', (data) => {
  console.log('Map created:', data);
});

socket.on('rivers:updated', (data) => {
  console.log('Rivers updated:', data);
});

// Send events
socket.emit('map:update', {
  mapId: 'map_123',
  updates: { /* ... */ }
});
```

#### Demo

See `demos/rest-api-demo.html` and `demos/websocket-demo.html` for interactive examples.

---

### 3. Direct JavaScript API

**Best for:** Same-origin applications, browser extensions with host permissions

#### Access the API

Once FMG is loaded, access the global API:

```javascript
const api = window.FMG_API;
```

#### Methods

##### Map Lifecycle

```javascript
// Create new map
const result = await api.createMap({ seed: 'my-seed' });
if (result.success) {
  console.log('Map created:', result.state);
}

// Load map from file or data
const file = document.getElementById('fileInput').files[0];
await api.loadMap(file);

// Or load from string
await api.loadMap(mapDataString);

// Save map
const saved = await api.saveMap('data'); // or 'blob'
console.log('Map data:', saved.data);
```

##### Data Access

```javascript
// Get complete state
const state = api.getMapState();
console.log('Current state:', state);

// Get specific data
const rivers = api.getRivers();
const cultures = api.getCultures();
const states = api.getStates();
const burgs = api.getBurgs();
const religions = api.getReligions();
const markers = api.getMarkers();
const grid = api.getGrid();

// Get any data by key
const data = api.getData('rivers');
```

##### Mutations

```javascript
// Update rivers
api.updateRivers([
  { i: 1, name: 'New River', type: 'River', discharge: 50 },
  // ... more rivers
]);

// Update cultures
api.updateCultures([...]);

// Update states
api.updateStates([...]);

// Update burgs
api.updateBurgs([...]);

// Add a new burg
const result = api.addBurg({
  name: 'New City',
  x: 500,
  y: 400,
  cell: 1234,
  population: 10,
  type: 'city',
  culture: 1,
  state: 1
});

if (result.success) {
  console.log('New burg ID:', result.id);
}
```

##### Export

```javascript
// Export SVG
const svg = api.exportSVG();
console.log('SVG:', svg);

// Export PNG (returns blob)
const pngBlob = await api.exportPNG(2048, 2048);

// Export JSON
const json = api.exportJSON(); // All data
const riversJson = api.exportJSON('rivers'); // Specific key
```

##### Events

```javascript
// Subscribe to events
const unsubscribe = api.on('map:changed', (state) => {
  console.log('Map changed:', state);
});

// Unsubscribe
unsubscribe();

// Or manually
api.off('map:changed', callback);

// Subscribe once
api.once('map:created', (state) => {
  console.log('Map created:', state);
});

// Emit custom events
api.emit('custom:event', { myData: 'test' });
```

---

## API Reference

### Data Structures

#### Map State

```typescript
interface MapState {
  seed: string | null;
  mapId: string | null;
  timestamp: number;
  pack: {
    cultures: Culture[];
    states: State[];
    burgs: Burg[];
    rivers: River[];
    religions: Religion[];
    provinces: Province[];
    markers: Marker[];
  } | null;
  grid: {
    spacing: number;
    cellsX: number;
    cellsY: number;
    features: Feature[];
  } | null;
  options: object | null;
}
```

#### River

```typescript
interface River {
  i: number;              // ID
  name: string;           // Name
  type: string;           // 'River', 'Lake', etc.
  discharge: number;      // m³/s
  length: number;         // Distance
  width: number;          // Visual width
  basin: number;          // Parent river ID
  // ... more properties
}
```

#### Culture

```typescript
interface Culture {
  i: number;              // ID
  name: string;           // Name
  base: number;           // Name base ID
  shield: string;         // Shield type
  expansionism: number;   // Expansion rate
  color: string;          // Color
  // ... more properties
}
```

#### State

```typescript
interface State {
  i: number;              // ID
  name: string;           // Name
  color: string;          // Color
  expansionism: number;   // Expansion rate
  capital: number;        // Capital burg ID
  culture: number;        // Culture ID
  // ... more properties
}
```

#### Burg

```typescript
interface Burg {
  i: number;              // ID
  name: string;           // Name
  x: number;              // X coordinate
  y: number;              // Y coordinate
  cell: number;           // Cell ID
  population: number;     // Population
  type: string;           // 'city', 'town', etc.
  culture: number;        // Culture ID
  state: number;          // State ID
  // ... more properties
}
```

---

## Events

### Available Events

#### Map Events
- `map:created` - New map created
- `map:loaded` - Map loaded from file
- `map:changed` - Map modified (throttled)

#### Data Events
- `rivers:updated` - Rivers data updated
- `cultures:updated` - Cultures data updated
- `states:updated` - States data updated
- `burgs:updated` - Burgs data updated
- `burg:added` - New burg added

### Event Payload

All events include relevant data:

```javascript
api.on('rivers:updated', (rivers) => {
  console.log('Updated rivers:', rivers);
});

api.on('map:created', (state) => {
  console.log('Map state:', state);
});
```

---

## Examples

### Example 1: Wiki Integration

Embed FMG in a wiki page and sync data:

```html
<div id="wiki-map-section">
  <iframe id="fmg" src="/fmg/index.html" width="100%" height="600"></iframe>

  <script>
    // Store map state in wiki
    window.addEventListener('message', (event) => {
      if (event.data.type === 'EVENT' && event.data.payload.event === 'map:changed') {
        // Save to wiki database
        saveToWiki(event.data.payload.data);
      }
    });

    // Load stored map on page load
    fetch('/wiki/api/map-data')
      .then(r => r.json())
      .then(mapData => {
        document.getElementById('fmg').contentWindow.postMessage({
          type: 'LOAD_MAP',
          payload: mapData
        }, '*');
      });
  </script>
</div>
```

### Example 2: Custom River Editor

Create a custom UI to edit rivers:

```javascript
// Get current rivers
const rivers = await window.FMG_API.getRivers();

// Show in custom UI
renderRiversTable(rivers);

// Update a river
rivers[0].name = 'Renamed River';
rivers[0].discharge = 150;

// Save changes
window.FMG_API.updateRivers(rivers);

// Listen for updates
window.FMG_API.on('rivers:updated', (updatedRivers) => {
  renderRiversTable(updatedRivers);
});
```

### Example 3: Batch Operations via REST API

```javascript
// Create multiple maps
async function createMapBatch(seeds) {
  const maps = [];

  for (const seed of seeds) {
    const res = await fetch('http://localhost:3000/api/maps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed })
    });

    const { mapId } = await res.json();
    maps.push(mapId);
  }

  return maps;
}

// Use it
const mapIds = await createMapBatch(['world1', 'world2', 'world3']);
console.log('Created maps:', mapIds);
```

### Example 4: Real-time Collaboration

Multiple users editing the same map:

```javascript
// User A's browser
const socket = io('http://localhost:3000');

// Listen for changes from other users
socket.on('rivers:updated', (data) => {
  // Update local view
  window.FMG_API.updateRivers(data.rivers);
});

// When local user makes changes
window.FMG_API.on('rivers:updated', (rivers) => {
  // Broadcast to other users
  socket.emit('rivers:updated', {
    mapId: currentMapId,
    rivers
  });
});
```

---

## Troubleshooting

### PostMessage not working

**Problem:** Messages not received in iframe

**Solution:**
1. Ensure iframe has loaded: `iframe.addEventListener('load', ...)`
2. Wait 1-2 seconds after load for API to initialize
3. Check origin in postMessage: use `'*'` or specific origin
4. Open browser console to check for errors

### CORS errors with REST API

**Problem:** `Access-Control-Allow-Origin` errors

**Solution:**
- REST API server has CORS enabled by default
- If using custom server, add CORS middleware
- For production, configure specific origins

### API not available

**Problem:** `window.FMG_API is undefined`

**Solution:**
1. Ensure `external-api.js` is loaded in index.html
2. Wait for DOMContentLoaded event
3. Check browser console for script errors

### Events not firing

**Problem:** Event listeners not receiving events

**Solution:**
1. Subscribe to events BEFORE making changes
2. Check event names (case-sensitive)
3. Ensure change detection is enabled (automatic)

### WebSocket disconnects

**Problem:** Socket disconnects unexpectedly

**Solution:**
1. Check server is running
2. Implement reconnection logic
3. Handle `disconnect` event and reconnect

---

## Advanced Configuration

### Disable PostMessage Bridge

If you don't need iframe integration:

```javascript
// In your fork, remove from external-api.js:
// PostMessageBridge.enable();
```

### Custom Event Throttling

Adjust change detection throttle:

```javascript
// In external-api.js, modify debounce time:
const observer = new MutationObserver(debounce(() => {
  // ...
}, 500)); // Change from 500ms to your preference
```

### Enable Debug Logging

```javascript
// Add to external-api.js for verbose logging:
const DEBUG = true;

if (DEBUG) {
  eventEmitter.on('*', (event, data) => {
    console.log('[FMG API]', event, data);
  });
}
```

---

## Support

For issues, questions, or feature requests:

- GitHub Issues: https://github.com/Azgaar/Fantasy-Map-Generator/issues
- Wiki: https://github.com/Azgaar/Fantasy-Map-Generator/wiki
- Discord: [Join community]

---

## License

MIT License - same as Fantasy Map Generator

---

**Happy Mapping! 🗺️**
