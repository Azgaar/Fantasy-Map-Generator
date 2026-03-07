#!/usr/bin/env node
"use strict";

/**
 * Bump the project version (patch / minor / major).
 *
 * Updates:
 *   - public/versioning.js   — VERSION constant
 *   - package.json           — "version" field
 *   - src/index.html         — ?v= cache-busting hashes for changed public/*.js files
 *
 * Usage:
 *   node scripts/bump-version.js             # interactive prompt
 *   node scripts/bump-version.js patch       # non-interactive
 *   node scripts/bump-version.js minor       # non-interactive
 *   node scripts/bump-version.js major       # non-interactive
 *   node scripts/bump-version.js --dry-run   # preview only, no writes
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const {execSync} = require("child_process");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const repoRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(repoRoot, "package.json");
const versioningPath = path.join(repoRoot, "public", "versioning.js");
const indexHtmlPath = path.join(repoRoot, "src", "index.html");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

function parseCurrentVersion() {
  const content = readFile(versioningPath);
  const match = content.match(/const VERSION = "(\d+\.\d+\.\d+)";/);
  if (!match) throw new Error("Could not find VERSION constant in public/versioning.js");
  return match[1];
}

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split(".").map(Number);
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns public/*.js paths (relative to repo root) that have changed.
 * Checks (in order, deduplicating):
 *   1. Upstream branch diff  — catches everything on a feature/PR branch
 *   2. Staged (index) diff   — catches files staged but not yet committed
 *   3. Last-commit diff      — fallback for main / detached HEAD
 */
function getChangedPublicJsFiles() {
  const run = cmd => execSync(cmd, {encoding: "utf8", cwd: repoRoot});
  const parseFiles = output =>
    output
      .split("\n")
      .map(f => f.trim())
      .filter(f => f.startsWith("public/") && f.endsWith(".js"));

  const seen = new Set();
  const collect = files => files.forEach(f => seen.add(f));

  // 1. Upstream branch diff
  try {
    const upstream = run("git rev-parse --abbrev-ref --symbolic-full-name @{upstream}").trim();
    collect(parseFiles(run(`git diff --name-only ${upstream}...HEAD`)));
  } catch {
    /* no upstream */
  }

  // 2. Staged changes (useful when building before committing)
  try {
    collect(parseFiles(run("git diff --name-only --cached")));
  } catch {
    /* ignore */
  }

  if (seen.size > 0) return [...seen];

  // 3. Fallback: last commit diff
  try {
    return parseFiles(run("git diff --name-only HEAD~1 HEAD"));
  } catch {
    /* shallow / single-commit repo */
  }

  return [];
}

// ---------------------------------------------------------------------------
// File updaters
// ---------------------------------------------------------------------------

function updateVersioningJs(newVersion, dry) {
  const original = readFile(versioningPath);
  const updated = original.replace(/const VERSION = "\d+\.\d+\.\d+";/, `const VERSION = "${newVersion}";`);
  if (original === updated) throw new Error("Failed to update VERSION in public/versioning.js");
  if (!dry) writeFile(versioningPath, updated);
  console.log(`  public/versioning.js  →  ${newVersion}`);
}

function updatePackageJson(newVersion, dry) {
  const original = readFile(packageJsonPath);
  const pkg = JSON.parse(original);
  const oldVersion = pkg.version;
  pkg.version = newVersion;
  if (!dry) writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`  package.json          ${oldVersion}  →  ${newVersion}`);
}

function updateIndexHtmlHashes(newVersion, dry) {
  const changedFiles = getChangedPublicJsFiles();

  if (changedFiles.length === 0) {
    console.log("  src/index.html        (no changed public/*.js files detected)");
    return;
  }

  let html = readFile(indexHtmlPath);
  const updated = [];

  for (const publicPath of changedFiles) {
    const htmlPath = publicPath.replace(/^public\//, "");
    const pattern = new RegExp(`${escapeRegExp(htmlPath)}\\?v=[0-9.]+`, "g");
    if (pattern.test(html)) {
      html = html.replace(pattern, `${htmlPath}?v=${newVersion}`);
      updated.push(htmlPath);
    }
  }

  if (updated.length > 0) {
    if (!dry) writeFile(indexHtmlPath, html);
    console.log(`  src/index.html        hashes updated for:\n    - ${updated.join("\n    - ")}`);
  } else {
    console.log(
      `  src/index.html        (changed files not referenced: ${changedFiles.map(f => f.replace("public/", "")).join(", ")})`
    );
  }
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function promptBumpType(currentVersion) {
  return new Promise(resolve => {
    const rl = readline.createInterface({input: process.stdin, output: process.stdout});
    process.stdout.write(`\nCurrent version: ${currentVersion}\nBump type (patch / minor / major) [patch]: `);
    rl.once("line", answer => {
      rl.close();
      const input = answer.trim().toLowerCase();
      if (input === "minor" || input === "mi") return resolve("minor");
      if (input === "major" || input === "maj") return resolve("major");
      resolve("patch");
    });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2).map(a => a.toLowerCase());
  const dry = args.includes("--dry-run");

  if (dry) console.log("\n[bump-version] DRY RUN — no files will be changed\n");

  const currentVersion = parseCurrentVersion();

  // Determine bump type: CLI arg → stdin prompt → default patch
  let bumpType;
  if (args.includes("major")) bumpType = "major";
  else if (args.includes("minor")) bumpType = "minor";
  else if (args.includes("patch")) bumpType = "patch";
  else if (process.stdin.isTTY) bumpType = await promptBumpType(currentVersion);
  else bumpType = "patch"; // non-interactive (CI / pipe)

  const newVersion = bumpVersion(currentVersion, bumpType);

  console.log(`\n[bump-version] ${bumpType}: ${currentVersion}  →  ${newVersion}\n`);

  updateVersioningJs(newVersion, dry);
  updatePackageJson(newVersion, dry);
  updateIndexHtmlHashes(newVersion, dry);

  console.log(`\n[bump-version] ${dry ? "(dry run) " : ""}done.\n`);
}

main().catch(err => {
  console.error("\n[bump-version] Error:", err.message || err);
  process.exit(1);
});
