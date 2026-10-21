/**
 * shared.ts — the two UI primitives every content dialog uses: FMG-native
 * toasts, and closing FMG's dialog widget. One definition, so every editor
 * behaves the same.
 */
import { fmg } from "../fmg";

/** FMG's own toast, or the console when FMG hasn't loaded its tip yet. */
export function toasts(message: string, type: "info" | "warn" = "info"): void {
  const globalTip = (
    globalThis as unknown as { tip?: (text: string, isError?: boolean, type?: string, ms?: number) => void }
  ).tip;
  if (typeof globalTip === "function") globalTip(message, type === "warn", type, 4000);
  else console.info(`[openconquest] ${message}`);
}

/** Close the dialog this editor opened (FMG's #alert widget). */
export function closeDialog(): void {
  fmg()?.$?.("#alert").dialog("close");
}
