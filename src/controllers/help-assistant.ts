import { Controllers } from "@/controllers";

// Existing menu, note-editor and Here entry points all reach the same omnibar.
export interface OpenOptions {
  mode?: "help" | "map";
}

async function open(_options: OpenOptions = {}): Promise<void> {
  await Controllers.Omnibar.open({ assistant: true });
}

async function toggle(): Promise<void> {
  const panel = document.getElementById("helpAssistant");
  const bar = document.getElementById("omnibar");
  if (panel && !panel.hidden && bar && !bar.hidden) await Controllers.Omnibar.close();
  else await open();
}

export const HelpAssistant = { open, toggle };
