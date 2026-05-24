import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// Define the directory to scan
const testsDir = path.join(process.cwd(), "src", "tests");

// Automatically find all files ending in .dump.ts
const dumpScripts = fs.readdirSync(testsDir).filter(file => file.endsWith(".dump.ts"));

if (dumpScripts.length === 0) {
  console.error("⚠️ No dump scripts found in src/tests/");
  process.exit(1);
}

console.log(`🚀 Found ${dumpScripts.length} scripts. Starting master dump sequence...`);

for (const script of dumpScripts) {
  console.log(`\n--- Dumping: ${script} ---`);

  const result = spawnSync("npx", ["vite-node", path.join("src", "tests", script)], {
    stdio: "inherit",
    shell: true
  });

  // Stop the whole sequence if one dump fails
  if (result.status !== 0) {
    console.error(`\n❌ Dump failed for ${script}. Aborting sequence.`);
    process.exit(1);
  }
}

console.log("\n✅ All regression dumps completed successfully.");
