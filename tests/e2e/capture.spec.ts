import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

// Increased test timeout to 120s for slow map generation
test.setTimeout(120000);

const CELL_ID = process.env.CELL_ID ? parseInt(process.env.CELL_ID) : 1;
const OUTPUT_PATH = process.env.OUTPUT_PATH
    ? path.resolve(process.env.OUTPUT_PATH)
    : path.resolve("map_capture.png");

test.describe("Map Capture", () => {
    test("should load map and capture screenshot", async ({ page }) => {
        // 1. Load the map
        const seed = process.env.MAP_SEED || "antigravity_v1";
        // Using networkidle to ensure assets are loaded
        await page.goto(`/?seed=${seed}&width=1920&height=1080`, { waitUntil: 'networkidle' });

        // 2. Wait for map generation complete
        console.log("Waiting for mapId...");
        await page.waitForFunction(
            () => (window as any).mapId !== undefined,
            { timeout: 90000 }
        );

        // Additional stabilization time for fonts/labels
        await page.waitForTimeout(5000);

        // 3. Center on Cell ID
        console.log(`Centering on cell ${CELL_ID}...`);
        await page.evaluate((cellId) => {
            const pack = (window as any).pack;
            if (!pack || !pack.cells) {
                console.error("Pack or cells not found");
                return;
            }

            const p = pack.cells.p[cellId];
            if (!p) {
                console.error(`Cell ${cellId} not found`);
                return;
            }

            // Close UI panels for clean screenshot
            const doc = (window as any).document;
            const dialogs = doc.querySelectorAll(".dialog");
            dialogs.forEach((d: any) => d.style.display = "none");

            // Attempt to zoom/center using D3 if available
            // In Azgaar, 'viewbox' usually handles the view.
            // Let's try to manipulate the transform directly on #map
            const svg = doc.querySelector("#map");
            if (svg && (window as any).d3) {
                const d3 = (window as any).d3;
                const [x, y] = p;
                // We want to center [x, y] in a 1920x1080 viewport
                // Scale 5 is a good "neighborhood" view
                const scale = 5;
                const tx = 1920 / 2 - x * scale;
                const ty = 1080 / 2 - y * scale;

                d3.select(svg).call(
                    d3.zoom().transform,
                    d3.zoomIdentity.translate(tx, ty).scale(scale)
                );
            }
        }, CELL_ID);

        // Final wait for zoom transition/rendering
        await page.waitForTimeout(2000);

        // 4. Capture Screenshot
        console.log(`Taking screenshot to ${OUTPUT_PATH}...`);
        await page.screenshot({ path: OUTPUT_PATH, fullPage: false });

        console.log(`Screenshot saved successfully.`);
    });
});
