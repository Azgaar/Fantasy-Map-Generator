#!/usr/bin/env node
"use strict";

/**
 * Keep package.json and package-lock.json in step with the app version.
 *
 * src/services/versioning.ts owns the version: it is what the app reports and what .map files
 * carry. package.json is what electron-builder stamps on the installers and writes into
 * latest.yml, which electron-updater compares against the version installed on disk. Let the
 * two drift and the desktop release still builds, but every client compares equal and is
 * never offered the update.
 *
 * Usage:
 *   node scripts/sync-version.js           # write both files
 *   node scripts/sync-version.js --check   # exit 1 if they disagree, write nothing
 *   node scripts/sync-version.js --stage   # write, then git add whatever changed
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const versioningPath = path.join(repoRoot, "src", "services", "versioning.ts");
const packageJsonPath = path.join(repoRoot, "package.json");
const packageLockJsonPath = path.join(repoRoot, "package-lock.json");

/** The version every other file has to agree with */
function readSourceVersion() {
  const match = fs.readFileSync(versioningPath, "utf8").match(/const VERSION = "([\d.]+)"/);
  if (!match) throw new Error("Could not find the VERSION constant in src/services/versioning.ts");
  return match[1];
}

/** JSON.stringify drops the trailing newline npm writes, so put it back and leave the diff clean */
function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/**
 * package-lock.json carries the version twice: at the top level and on its own entry in
 * `packages`, the one npm reads. Both have to move or `npm ci` rewrites the file
 */
function collectUpdates(version) {
  const updates = [];

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  if (pkg.version !== version) {
    updates.push({
      label: "package.json",
      from: pkg.version,
      filePath: packageJsonPath,
      apply: () => {
        pkg.version = version;
        writeJson(packageJsonPath, pkg);
      }
    });
  }

  if (fs.existsSync(packageLockJsonPath)) {
    const lock = JSON.parse(fs.readFileSync(packageLockJsonPath, "utf8"));
    const rootEntry = lock.packages && lock.packages[""];
    if (lock.version !== version || (rootEntry && rootEntry.version !== version)) {
      updates.push({
        label: "package-lock.json",
        from: lock.version,
        filePath: packageLockJsonPath,
        apply: () => {
          lock.version = version;
          if (rootEntry) rootEntry.version = version;
          writeJson(packageLockJsonPath, lock);
        }
      });
    }
  }

  return updates;
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const stage = args.includes("--stage");

  const version = readSourceVersion();
  const updates = collectUpdates(version);

  if (!updates.length) {
    if (!check) console.log(`[sync-version] already at ${version}`);
    return;
  }

  if (check) {
    console.error(`\n[sync-version] src/services/versioning.ts is at ${version}, but:\n`);
    for (const { label, from } of updates) console.error(`  ${label}  is at  ${from}`);
    console.error("\nRun `npm run sync-version` to line them up.\n");
    process.exit(1);
  }

  for (const { label, from, apply } of updates) {
    apply();
    console.log(`[sync-version] ${label}  ${from}  →  ${version}`);
  }

  if (stage) {
    execFileSync("git", ["add", "--", ...updates.map(({ filePath }) => filePath)], { stdio: "inherit" });
  }
}

try {
  main();
} catch (error) {
  console.error("\n[sync-version] Error:", error.message || error);
  process.exit(1);
}
