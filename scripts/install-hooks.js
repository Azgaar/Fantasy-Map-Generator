#!/usr/bin/env node
// Installs scripts/pre-push as .git/hooks/pre-push.
// Runs automatically via the `prepare` npm lifecycle hook (npm install).

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const hooksDir = path.join(repoRoot, ".git", "hooks");
const source = path.join(repoRoot, "scripts", "pre-push");
const target = path.join(hooksDir, "pre-push");

if (!fs.existsSync(path.join(repoRoot, ".git"))) {
  // Not a git repo (e.g. Docker / CI build from tarball) — skip silently.
  process.exit(0);
}

if (!fs.existsSync(hooksDir)) {
  fs.mkdirSync(hooksDir, {recursive: true});
}

try {
  // Symlink so changes to scripts/pre-push are reflected immediately.
  if (fs.existsSync(target) || fs.lstatSync(target).isSymbolicLink()) {
    fs.unlinkSync(target);
  }
} catch {
  // Target doesn't exist yet — that's fine.
}

fs.symlinkSync(source, target);
fs.chmodSync(source, 0o755);
console.log("[prepare] Installed git pre-push hook → .git/hooks/pre-push");
