// Azgaar and contributors, 2017-2026. MIT License
// https://github.com/Azgaar/Fantasy-Map-Generator

import { readStoredOptions } from "@/components/options-storage";
import { resolveLanguage } from "@/services/language";
import { Catalog, t } from "@/utils/i18n";

async function start(): Promise<void> {
  const { app } = readStoredOptions() as { app?: { language?: unknown } };
  const language = resolveLanguage(app?.language);
  document.documentElement.lang = language;
  await Catalog.load(language).catch(error => console.error("Interface strings failed to load", error));
  document.title = t("Azgaar's Fantasy Map Generator");
  const { boot } = await import("./app");
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else void boot();
}

void start();
