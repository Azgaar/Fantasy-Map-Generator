// Point the browser's 'window' object to Node's global object
(globalThis as any).window = globalThis;

// 2. Mock FMG's global logging flags
(globalThis as any).TIME = false;
(globalThis as any).INFO = false;
(globalThis as any).DEBUG = false;

// 3. SECURELY Load the REAL Heightmap Templates
// This safely executes the JS file in Node's memory and attaches it to globalThis
import "../../public/config/heightmap-templates.js";

// 3. Mock the DOM and the specific HTML inputs FMG looks for
(globalThis as any).document = {
  readyState: "complete",
  addEventListener: () => {},
  getElementById: (id: string) => {
    if (id === "pointsInput") return { dataset: { cells: "2000" } };
    if (id === "mapWidthInput") return { value: "1024" };
    if (id === "mapHeightInput") return { value: "768" };
    if (id === "templateInput") {
        return { value: (globalThis as any).__TEST_TEMPLATE_ID__ || "highIsland" }; 
    }
    return { value: "0", dataset: {} };
  }
};
