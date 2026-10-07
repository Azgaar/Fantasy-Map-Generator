// Azgaar and contributors, 2017-2026. MIT License
// https://github.com/Azgaar/Fantasy-Map-Generator

import { resolveLanguage } from "@/services/language";
import { Catalog } from "@/utils/i18n";

async function start(): Promise<void> {
  const language = resolveLanguage();
  document.documentElement.lang = language;
  await Catalog.load(language).catch(error => console.error("Interface strings failed to load", error));
  const { boot } = await import("./app");
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else void boot();
}

void start();
