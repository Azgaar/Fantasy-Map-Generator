// The facts store: what is true about the map on screen, and nothing else.
// See docs/architecture/configuration.md
import { type FactsData, getDefaultFacts } from "@/components/facts-schema";

declare global {
  /** the live map facts, read bare across the app and replaced wholesale on load */
  var facts: FactsData;
}

globalThis.facts = getDefaultFacts();
