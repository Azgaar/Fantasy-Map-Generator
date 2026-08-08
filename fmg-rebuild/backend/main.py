import asyncio
import math
import random
from typing import Dict, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Fantasy Map Generator Rebuild API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class Cell(BaseModel):
    id: int
    x: float
    y: float
    height: float
    biome: str
    temperature: float
    precipitation: float
    state_id: Optional[int] = None
    culture_id: Optional[int] = None

class MapState(BaseModel):
    seed: str
    width: int
    height: int
    cells: List[Cell]

# In-memory database of active maps
active_maps: Dict[str, MapState] = {}

def generate_procedural_map(seed: str, width: int, height: int, num_cells: int = 2000) -> MapState:
    """
    Generates a procedural map layout. Uses a simple seeded distribution of cells
    with noise-based heightmaps, temperatures, and biomes.
    """
    random.seed(seed)
    cells = []
    
    # Generate points representing cell centers (Voronoi site mocks)
    for i in range(num_cells):
        x = random.uniform(0, width)
        y = random.uniform(0, height)
        
        # Simulating radial/island noise for height
        dx = x - width / 2
        dy = y - height / 2
        dist = math.sqrt(dx*dx + dy*dy)
        max_dist = math.sqrt((width/2)**2 + (height/2)**2)
        radial_factor = 1.0 - (dist / max_dist) if max_dist > 0 else 0
        
        # High-frequency noise simulation
        noise = (math.sin(x * 0.05) + math.cos(y * 0.05) + random.uniform(-0.2, 0.2)) / 3.0
        height_val = max(0.0, min(1.0, radial_factor * 0.6 + noise * 0.4 + 0.2))
        
        # Climate simulation (temperature decreases with latitude/y coordinate)
        lat_factor = 1.0 - (y / height) if height > 0 else 0.5
        temp = 25 * math.sin(lat_factor * math.pi) + random.uniform(-2, 2)
        
        # Precipitation
        prec = max(0.0, 100 * (math.sin(x * 0.01) * math.cos(y * 0.01) + 1.0) / 2.0 + random.uniform(-10, 10))
        
        # Define simple biomes
        if height_val < 0.25:
            biome = "Marine"
        elif height_val < 0.3:
            biome = "Wetland" if prec > 40 else "Sandy Desert"
        elif temp < 0:
            biome = "Tundra"
        elif prec > 60:
            biome = "Rainforest"
        elif prec < 20:
            biome = "Badlands"
        else:
            biome = "Grassland"
            
        cells.append(
            Cell(
                id=i,
                x=x,
                y=y,
                height=height_val,
                biome=biome,
                temperature=temp,
                precipitation=prec
            )
        )
        
    return MapState(seed=seed, width=width, height=height, cells=cells)

# Real-time WebSocket connection manager for multiplayer sync
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, map_id: str, websocket: WebSocket):
        await websocket.accept()
        if map_id not in self.active_connections:
            self.active_connections[map_id] = []
        self.active_connections[map_id].append(websocket)

    def disconnect(self, map_id: str, websocket: WebSocket):
        if map_id in self.active_connections:
            if websocket in self.active_connections[map_id]:
                self.active_connections[map_id].remove(websocket)

    async def broadcast(self, map_id: str, message: dict, exclude: Optional[WebSocket] = None):
        if map_id in self.active_connections:
            for connection in self.active_connections[map_id]:
                if connection != exclude:
                    await connection.send_json(message)

manager = ConnectionManager()

@app.get("/api/map/{map_id}")
async def get_map(map_id: str, seed: Optional[str] = "fantasy-default", width: int = 1280, height: int = 720):
    if map_id not in active_maps:
        active_maps[map_id] = generate_procedural_map(seed, width, height)
    return active_maps[map_id]

@app.websocket("/ws/map/{map_id}")
async def websocket_endpoint(websocket: WebSocket, map_id: str):
    await manager.connect(map_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            
            # Simple operation handler: mutate cell
            if data.get("op") == "MUTATE_CELL":
                cell_id = data.get("cellId")
                changes = data.get("changes", {})
                
                # Apply mutation to internal state
                if map_id in active_maps:
                    map_state = active_maps[map_id]
                    if 0 <= cell_id < len(map_state.cells):
                        cell = map_state.cells[cell_id]
                        for key, val in changes.items():
                            if hasattr(cell, key):
                                setattr(cell, key, val)
                
                # Broadcast delta changes to other connected clients
                await manager.broadcast(
                    map_id=map_id,
                    message={
                        "op": "CELL_MUTATED",
                        "cellId": cell_id,
                        "changes": changes
                    },
                    exclude=websocket
                )
    except WebSocketDisconnect:
        manager.disconnect(map_id, websocket)
