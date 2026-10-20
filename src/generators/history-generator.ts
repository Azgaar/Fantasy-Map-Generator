// The map's chronicle in `pack.history`: dated events, fallen realms and eras. See docs/plans/history-generation.md
// The model is `Chronicle`, not `History`: the DOM owns that global name
import { emptyHistory, type History } from "@/types/history";

class ChronicleModel {
  /** build the chronicle for the finished world; later slices fill it, locked events survive */
  generate(): void {
    pack.history = emptyHistory();
  }

  /** ensure the pack carries the chronicle; safe to call repeatedly, older saves predate it */
  sync(): History {
    pack.history ??= emptyHistory();
    return pack.history;
  }
}

declare global {
  var Chronicle: ChronicleModel;
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const Chronicle = new ChronicleModel();
window.Chronicle = Chronicle;
