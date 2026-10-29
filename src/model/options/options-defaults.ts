// The defaults until boot restores this browser's options. The app imports it first: the generators the
// defaults come from are then fully loaded, and no module or timer finds `options` missing
import { Options } from "./options-model";

globalThis.options = Options.getDefaultOptions();
