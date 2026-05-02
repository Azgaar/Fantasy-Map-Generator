#!/usr/bin/env node
"use strict";

/**
 * Uses the GitHub Models API (gpt-4o-mini, no extra secrets required —
 * GITHUB_TOKEN is enough when running inside GitHub Actions) to analyse
 * a PR diff and decide whether the release is a patch, minor, or major bump.
 *
 * Versioning rules (from public/versioning.js):
 *   MAJOR — incompatible changes that break existing .map files
 *   MINOR — backward-compatible additions or changes that may require
 *            old .map files to be updated / migrated
 *   PATCH — backward-compatible bug fixes and small features that do
 *            NOT affect the .map file format at all
 *
 * Usage (called by bump-version.yml):
 *   node scripts/detect-bump-type.js --diff-file <path>
 *
 * Output:  prints exactly one of:  patch  |  minor  |  major
 * Exit 0 always (falls back to "patch" on any error).
 */

const fs = require("fs");
const https = require("https");
const path = require("path");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MODEL = "gpt-4o-mini";
const ENDPOINT_HOST = "models.inference.ai.azure.com";
const ENDPOINT_PATH = "/chat/completions";
// Keep the diff under ~20 000 chars to stay within the model's context window.
const MAX_DIFF_CHARS = 20_000;

// ---------------------------------------------------------------------------
// System prompt — contains the project-specific versioning rules
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `\
You are a semantic-version expert for Azgaar's Fantasy Map Generator.

The project uses semantic versioning where the PUBLIC API is the .map save-file format.

Rules:
• MAJOR — any change that makes existing .map files incompatible or unreadable
  (e.g. removing or renaming top-level save-data fields, changing data types of
  stored values, restructuring the save format)
• MINOR — backward-compatible additions or changes that may require old .map
  files to be silently migrated on load (e.g. adding new optional fields to the
  save format, changing default values that affect saved maps, adding new
  generators that store new data)
• PATCH — everything else: UI improvements, bug fixes, refactors, new features
  that do not touch the .map file format at all, dependency updates, docs

Respond with EXACTLY one lowercase word: patch  |  minor  |  major
No explanation, no punctuation, no extra words.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function httpsPost(host, pathStr, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {host, path: pathStr, method: "POST", headers: {...headers, "Content-Length": Buffer.byteLength(data)}},
      res => {
        let raw = "";
        res.on("data", c => (raw += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(raw);
          else reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const diffFileIdx = args.indexOf("--diff-file");
  const diffFile = diffFileIdx !== -1 ? args[diffFileIdx + 1] : null;

  if (!diffFile || !fs.existsSync(diffFile)) {
    console.error("[detect-bump-type] --diff-file <path> is required and must exist.");
    process.stdout.write("patch\n");
    process.exit(0);
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("[detect-bump-type] GITHUB_TOKEN not set — falling back to patch.");
    process.stdout.write("patch\n");
    process.exit(0);
  }

  let diff = fs.readFileSync(diffFile, "utf8").trim();
  if (!diff) {
    console.error("[detect-bump-type] Diff is empty — falling back to patch.");
    process.stdout.write("patch\n");
    process.exit(0);
  }

  // Trim diff to avoid exceeding context window
  if (diff.length > MAX_DIFF_CHARS) {
    diff = diff.slice(0, MAX_DIFF_CHARS) + "\n\n[diff truncated]";
    console.error(`[detect-bump-type] Diff truncated to ${MAX_DIFF_CHARS} chars.`);
  }

  const userMessage = `Analyse this git diff and respond with exactly one word (patch, minor, or major):\n\n${diff}`;

  try {
    const raw = await httpsPost(
      ENDPOINT_HOST,
      ENDPOINT_PATH,
      {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      {
        model: MODEL,
        messages: [
          {role: "system", content: SYSTEM_PROMPT},
          {role: "user", content: userMessage}
        ],
        temperature: 0,
        max_tokens: 5
      }
    );

    const json = JSON.parse(raw);
    const answer = json.choices?.[0]?.message?.content?.trim().toLowerCase() ?? "patch";

    if (answer === "major" || answer === "minor" || answer === "patch") {
      console.error(`[detect-bump-type] AI decision: ${answer}`);
      process.stdout.write(`${answer}\n`);
    } else {
      console.error(`[detect-bump-type] Unexpected AI response "${answer}" — defaulting to patch.`);
      process.stdout.write("patch\n");
    }
  } catch (err) {
    console.error(`[detect-bump-type] API error: ${err.message} — falling back to patch.`);
    process.stdout.write("patch\n");
  }

  process.exit(0);
}

main();
