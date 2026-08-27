#!/usr/bin/env node

/**
 * Ad-hoc signs the packaged macOS app.
 *
 * Electron's prebuilt binary arrives linker-signed as "Electron". Packaging rewrites Info.plist and
 * drops in the app resources, which leaves that signature invalid rather than absent, and macOS
 * calls such a bundle damaged instead of merely unidentified — a dead end offering no "Open Anyway".
 * Signing the finished bundle with the ad-hoc identity "-" needs no certificate and restores the
 * recoverable path.
 *
 * electron-builder runs this before its own signing step, so configuring a real Developer ID later
 * simply replaces this signature.
 */

import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export default async function adhocSign({ electronPlatformName, appOutDir, packager }) {
  if (electronPlatformName !== "darwin") return;

  const app = join(appOutDir, `${packager.appInfo.productFilename}.app`);
  await run("codesign", ["--force", "--deep", "--sign", "-", app]);
  console.log(`  • ad-hoc signed   file=${app}`);
}
