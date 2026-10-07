// Azgaar and contributors, 2017-2026. MIT License
// https://github.com/Azgaar/Fantasy-Map-Generator

import { resolveLanguage } from "@/services/language";
import { Catalog } from "@/utils/i18n";

async function start(): Promise<void> {
  await Catalog.load(resolveLanguage()).catch(error => console.error("Interface strings failed to load", error));
  const { boot } = await import("./app");
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else void boot();
}

void start();
