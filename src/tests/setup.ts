// Point the browser's 'window' object to Node's global object
(globalThis as any).window = globalThis;

// 2. Mock FMG's global logging flags
(globalThis as any).TIME = false;
(globalThis as any).INFO = false;
(globalThis as any).DEBUG = false;

// 3. SECURELY Load the REAL Heightmap Templates
// This safely executes the JS file in Node's memory and attaches it to globalThis
import "../../public/config/heightmap-templates.js";
