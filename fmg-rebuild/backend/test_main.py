import time
from fastapi.testclient import TestClient
from main import app, active_maps

client = TestClient(app)

def test_get_map_creates_and_returns_map():
    active_maps.clear()
    
    response = client.get("/api/map/session-123?seed=testseed&width=1000&height=600")
    assert response.status_code == 200
    data = response.json()
    
    assert data["seed"] == "testseed"
    assert data["width"] == 1000
    assert data["height"] == 600
    assert len(data["cells"]) == 2000
    
    cell = data["cells"][0]
    assert "id" in cell
    assert "x" in cell
    assert "y" in cell
    assert "height" in cell
    assert "biome" in cell

def test_websocket_broadcast_mutation():
    active_maps.clear()
    client.get("/api/map/session-456?seed=test&width=100&height=100")
    
    # Establish WebSocket connection
    with client.websocket_connect("/ws/map/session-456") as websocket:
        websocket.send_json({
            "op": "MUTATE_CELL",
            "cellId": 0,
            "changes": {"biome": "SuperOcean", "height": 0.99}
        })
        # Give ASGI server background task a tiny moment to process the queue
        time.sleep(0.1)
        
    # Verify that internal state was mutated on the server
    assert active_maps["session-456"].cells[0].biome == "SuperOcean"
    assert active_maps["session-456"].cells[0].height == 0.99
