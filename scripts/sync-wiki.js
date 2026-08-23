#!/usr/bin/env node
"use strict";

/**
 * Mirrors docs/wiki/ to the GitHub wiki repository (Fantasy-Map-Generator.wiki.git).
 *
 * docs/wiki is the single source of truth: the wiki is a publishing target, and
 * direct edits there are overwritten. A file name is the page title, with
 * dashes rendered as spaces. docs/wiki must stay flat.
 *
 * node scripts/sync-wiki.js [--dry-run] [--message <text>]
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const REPO = "Azgaar/Fantasy-Map-Generator";
const SOURCE_DIR = path.join(__dirname, "..", "docs", "wiki");

// A mirror deletes whatever is not in the source, so refuse to run against a
// source that looks broken rather than wiping the published wiki.
const MIN_EXPECTED_PAGES = 10;

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function fail(message) {
  console.error(`[sync-wiki] ${message}`);
  process.exit(1);
}

function readSourcePages() {
  if (!fs.existsSync(SOURCE_DIR)) fail(`Source directory not found: ${SOURCE_DIR}`);

  const entries = fs.readdirSync(SOURCE_DIR, { withFileTypes: true });

  const directories = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
  if (directories.length) {
    fail(`docs/wiki must stay flat, the wiki cannot publish subdirectories. Found: ${directories.join(", ")}`);
  }

  const pages = entries.filter(entry => entry.isFile() && !entry.name.startsWith(".")).map(entry => entry.name);
  if (pages.length < MIN_EXPECTED_PAGES) {
    fail(`Only ${pages.length} pages found, expected at least ${MIN_EXPECTED_PAGES}. Refusing to mirror.`);
  }

  return pages;
}

function cloneWiki() {
  const token = process.env.WIKI_TOKEN || process.env.GITHUB_TOKEN;
  const url = token
    ? `https://x-access-token:${token}@github.com/${REPO}.wiki.git`
    : `https://github.com/${REPO}.wiki.git`;

  const target = fs.mkdtempSync(path.join(os.tmpdir(), "fmg-wiki-"));
  // Full history: the wiki repo is the only copy of its own 900+ commits, and a
  // shallow clone cannot be pushed back without --force.
  git(["clone", url, target]);
  return target;
}

function mirror(pages, wikiDir) {
  for (const name of fs.readdirSync(wikiDir)) {
    if (name === ".git") continue;
    fs.rmSync(path.join(wikiDir, name), { recursive: true, force: true });
  }

  for (const page of pages) {
    fs.copyFileSync(path.join(SOURCE_DIR, page), path.join(wikiDir, page));
  }
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const messageIdx = args.indexOf("--message");
  const message = messageIdx !== -1 ? args[messageIdx + 1] : null;

  const pages = readSourcePages();
  console.log(`[sync-wiki] ${pages.length} pages in docs/wiki`);

  const sourceSha = git(["rev-parse", "--short", "HEAD"], path.join(__dirname, ".."));

  let wikiDir;
  try {
    wikiDir = cloneWiki();
  } catch (error) {
    fail(`Could not clone the wiki repository: ${error.message}`);
  }

  mirror(pages, wikiDir);

  const status = git(["status", "--porcelain"], wikiDir);
  if (!status) {
    console.log("[sync-wiki] Wiki is already up to date, nothing to push.");
    fs.rmSync(wikiDir, { recursive: true, force: true });
    return;
  }

  console.log(`[sync-wiki] Changes to publish:\n${status}`);

  if (dryRun) {
    console.log(`[sync-wiki] Dry run, nothing pushed. Clone left at ${wikiDir}`);
    return;
  }

  git(["config", "user.name", process.env.GIT_AUTHOR_NAME || "github-actions[bot]"], wikiDir);
  git(
    ["config", "user.email", process.env.GIT_AUTHOR_EMAIL || "github-actions[bot]@users.noreply.github.com"],
    wikiDir
  );
  git(["add", "--all"], wikiDir);
  git(["commit", "-m", message || `Sync wiki from docs/wiki (${sourceSha})`], wikiDir);

  try {
    // Never force: the wiki repo holds history that exists nowhere else.
    git(["push", "origin", "HEAD:master"], wikiDir);
  } catch (error) {
    fail(`Push failed — the token may lack wiki write access: ${error.message}`);
  }

  console.log("[sync-wiki] Wiki updated.");
  fs.rmSync(wikiDir, { recursive: true, force: true });
}

main();
