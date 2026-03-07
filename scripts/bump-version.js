#!/usr/bin/env node
"use strict";

/**
 * Bump the project version (patch / minor / major).
 *
 * Updates:
 *   - public/versioning.js   — VERSION constant
 *   - package.json           — "version" field
 *   - package-lock.json      — top-level "version" and packages[""].version fields
 *   - src/index.html         — ?v= cache-busting hashes for changed public/*.js files
 *   - public/**\/*.js        — ?v= cache-busting hashes in dynamic import() calls
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
const packageLockJsonPath = path.join(repoRoot, "package-lock.json");
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

/** Returns true if versionA is strictly greater than versionB (semver). */
function isVersionGreater(versionA, versionB) {
  const a = versionA.split(".").map(Number);
  const b = versionB.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false; // equal
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

function updatePackageLockJson(newVersion, dry) {
  if (!fs.existsSync(packageLockJsonPath)) {
    console.log("  package-lock.json     (not found, skipping)");
    return;
  }
  const original = readFile(packageLockJsonPath);
  const lock = JSON.parse(original);
  const oldVersion = lock.version;
  lock.version = newVersion;
  if (lock.packages && lock.packages[""]) {
    lock.packages[""].version = newVersion;
  }
  if (!dry) writeFile(packageLockJsonPath, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`  package-lock.json     ${oldVersion}  →  ${newVersion}`);
}

function updateIndexHtmlHashes(changedFiles, newVersion, dry) {
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
      `  src/index.html        (changed files have no ?v= entry: ${changedFiles.map(f => f.replace("public/", "")).join(", ")}`
    );
  }
}

/**
 * For each changed public JS file, scans ALL other public JS files for
 * dynamic import() calls that reference it via a relative ?v= path, and
 * updates the hash to newVersion.
 *
 * Example: public/modules/dynamic/installation.js changed →
 *   main.js: import("./modules/dynamic/installation.js?v=1.89.19")
 *         → import("./modules/dynamic/installation.js?v=1.113.4")
 */
function updatePublicJsDynamicImportHashes(changedFiles, newVersion, dry) {
  if (changedFiles.length === 0) {
    console.log("  public/**/*.js        (no changed files, skipping dynamic import hashes)");
    return;
  }

  // Absolute paths of every changed file for O(1) lookup
  const changedAbsPaths = new Set(changedFiles.map(f => path.join(repoRoot, f)));

  // Collect all public JS files, skipping public/libs (third-party)
  const publicRoot = path.join(repoRoot, "public");
  const allJsFiles = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (path.relative(publicRoot, full).replace(/\\/g, "/") === "libs") continue;
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        allJsFiles.push(full);
      }
    }
  })(publicRoot);

  const updatedMap = {};

  for (const absJsFile of allJsFiles) {
    const content = readFile(absJsFile);
    // Matches: import("../path/file.js?v=1.2.3") or import('../path/file.js?v=1.2.3')
    const pattern = /(['"])(\.{1,2}\/[^'"?]+)\?v=[0-9.]+\1/g;
    let anyChanged = false;
    const newContent = content.replace(pattern, (match, quote, relImportPath) => {
      const absImport = path.resolve(path.dirname(absJsFile), relImportPath);
      if (!changedAbsPaths.has(absImport)) return match;
      const repoRelFile = path.relative(repoRoot, absJsFile).replace(/\\/g, "/");
      if (!updatedMap[repoRelFile]) updatedMap[repoRelFile] = [];
      updatedMap[repoRelFile].push(relImportPath);
      anyChanged = true;
      return `${quote}${relImportPath}?v=${newVersion}${quote}`;
    });
    if (anyChanged && !dry) writeFile(absJsFile, newContent);
  }

  if (Object.keys(updatedMap).length > 0) {
    const lines = Object.entries(updatedMap)
      .map(([file, refs]) => `    ${file}:\n      - ${refs.join("\n      - ")}`)
      .join("\n");
    console.log(`  public/**/*.js        dynamic import hashes updated:\n${lines}`);
  } else {
    console.log("  public/**/*.js        (no dynamic import ?v= hashes to update)");
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
  const argv = process.argv.slice(2);
  const args = argv.map(a => a.toLowerCase());
  const dry = args.includes("--dry-run");

  // --base-version X.Y.Z  — version on master before this PR was merged.
  // When provided, the script checks whether the developer already bumped
  // the version manually in their branch. If so, the increment is skipped
  // and only the ?v= hashes in index.html are refreshed.
  const baseVersionFlagIdx = argv.findIndex(a => a === "--base-version");
  const baseVersion = baseVersionFlagIdx !== -1 ? argv[baseVersionFlagIdx + 1] : null;

  if (dry) console.log("\n[bump-version] DRY RUN — no files will be changed\n");

  const currentVersion = parseCurrentVersion();

  if (baseVersion && isVersionGreater(currentVersion, baseVersion)) {
    // Developer already bumped the version manually in their branch.
    console.log(
      `\n[bump-version] Version already updated manually: ${baseVersion} → ${currentVersion} (base was ${baseVersion})\n`
    );
    console.log("  Skipping version increment — updating ?v= hashes only.\n");
    const changedFiles = getChangedPublicJsFiles();
    updateIndexHtmlHashes(changedFiles, currentVersion, dry);
    updatePublicJsDynamicImportHashes(changedFiles, currentVersion, dry);
    console.log(`\n[bump-version] ${dry ? "(dry run) " : ""}done.\n`);
    return;
  }

  // Determine bump type: CLI arg → stdin prompt → default patch
  let bumpType;
  if (args.includes("major")) bumpType = "major";
  else if (args.includes("minor")) bumpType = "minor";
  else if (args.includes("patch")) bumpType = "patch";
  else if (process.stdin.isTTY) bumpType = await promptBumpType(currentVersion);
  else bumpType = "patch"; // non-interactive (CI / pipe)

  const newVersion = bumpVersion(currentVersion, bumpType);

  console.log(`\n[bump-version] ${bumpType}: ${currentVersion}  →  ${newVersion}\n`);

  const changedFiles = getChangedPublicJsFiles();
  updateVersioningJs(newVersion, dry);
  updatePackageJson(newVersion, dry);
  updatePackageLockJson(newVersion, dry);
  updateIndexHtmlHashes(changedFiles, newVersion, dry);
  updatePublicJsDynamicImportHashes(changedFiles, newVersion, dry);

  console.log(`\n[bump-version] ${dry ? "(dry run) " : ""}done.\n`);
}

main().catch(err => {
  console.error("\n[bump-version] Error:", err.message || err);
  process.exit(1);
});
