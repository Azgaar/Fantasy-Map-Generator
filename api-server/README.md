# Fantasy Map Generator - REST API Server

A Node.js/Express server that provides REST API endpoints and WebSocket support for the Fantasy Map Generator.

## Features

- ✅ RESTful API with full CRUD operations
- ✅ WebSocket support for real-time updates
- ✅ Map storage and management
- ✅ CSV import for rivers and other data
- ✅ Export support (SVG, PNG, JSON)
- ✅ CORS enabled for cross-origin requests
- ✅ File upload support

## Quick Start

### Installation

```bash
npm install
```

### Run Server

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

Server will start on `http://localhost:3000`

## API Documentation

Visit `http://localhost:3000` after starting the server to see the full API documentation.

### Quick Examples

#### Create a Map

```bash
curl -X POST http://localhost:3000/api/maps \
  -H "Content-Type: application/json" \
  -d '{"seed": "my-world"}'
```

Response:
```json
{
  "success": true,
  "mapId": "map_1234567890_abc123",
  "message": "Map creation initiated",
  "pollUrl": "/api/maps/map_1234567890_abc123"
}
```

#### Get Map Data

```bash
curl http://localhost:3000/api/maps/map_1234567890_abc123
```

#### Update Rivers

```bash
curl -X PUT http://localhost:3000/api/maps/map_1234567890_abc123/rivers \
  -H "Content-Type: application/json" \
  -d '{"rivers": [{"i":1,"name":"Mystic River","type":"River"}]}'
```

#### Import Rivers from CSV

```bash
curl -X POST http://localhost:3000/api/maps/map_1234567890_abc123/rivers/import \
  -F "file=@rivers.csv"
```

## WebSocket

### Connect

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected!');
});
```

### Events

**Server Events (listen):**
- `map:creating` - Map creation started
- `map:created` - Map creation completed
- `map:updated` - Map data updated
- `map:deleted` - Map deleted
- `rivers:updated` - Rivers updated
- `rivers:imported` - Rivers imported from CSV
- `burg:added` - New burg added

**Client Events (emit):**
- `map:update` - Update map data
- `map:created` - Notify map creation complete
- `export:completed` - Export completed

## Configuration

### Environment Variables

```bash
# Port (default: 3000)
PORT=3000
```

### Storage

By default, maps are stored in memory. For production, replace the `Map` with a database:

```javascript
// Replace this in server.js
const maps = new Map();

// With this (example with MongoDB)
const maps = await db.collection('maps');
```

## Deployment

### Docker

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t fmg-api .
docker run -p 3000:3000 fmg-api
```

### Production Considerations

1. **Database**: Replace in-memory storage with MongoDB, PostgreSQL, etc.
2. **Authentication**: Add JWT or OAuth for protected endpoints
3. **Rate Limiting**: Add express-rate-limit
4. **Validation**: Add input validation with joi or express-validator
5. **Logging**: Add morgan or winston
6. **Monitoring**: Add health checks and metrics

## Architecture

```
Client (Browser/Wiki)
    ↓
REST API / WebSocket
    ↓
Server (Express + Socket.IO)
    ↓
Storage (In-memory Map / Database)
```

## Dependencies

- **express**: Web framework
- **socket.io**: WebSocket server
- **cors**: Cross-origin resource sharing
- **multer**: File upload handling
- **body-parser**: Request body parsing

## Development

### Add New Endpoint

```javascript
// In server.js
app.get('/api/maps/:id/custom', async (req, res) => {
  try {
    const {id} = req.params;
    // Your logic here
    res.json({success: true, data: {}});
  } catch (error) {
    res.status(500).json({success: false, error: error.message});
  }
});
```

### Add WebSocket Event

```javascript
// In server.js
io.on('connection', (socket) => {
  socket.on('custom:event', (data) => {
    // Handle event
    io.emit('custom:response', data);
  });
});
```

## Testing

### Manual Testing

Use the demo pages:
- REST API: `http://localhost:3000/demos/rest-api-demo.html`
- WebSocket: `http://localhost:3000/demos/websocket-demo.html`

### Automated Testing

```bash
# Install test dependencies
npm install --save-dev mocha chai supertest

# Run tests
npm test
```

## License

MIT - Same as Fantasy Map Generator

## Support

For issues and questions, see the main repository.
