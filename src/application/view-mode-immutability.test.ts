import { afterEach, describe, expect, test } from "vitest";
import { createCanonicalDocumentSnapshot } from "@/services/io/document-snapshot";
import { createSerializedMapStyle } from "@/services/io/serialized-map-style";
import type { Style } from "@/types/style";
import {
  endViewSession,
  getDocumentLayerOrder,
  getDocumentLayerVisibility,
  resetViewSessionForTests,
  setViewSessionLayerVisibility,
  setViewSessionSelection,
  startViewSession
} from "./view-session-state";
import { resetWorkspaceModeForTests, setWorkspaceMode } from "./workspace-mode";

afterEach(() => {
  resetViewSessionForTests();
  resetWorkspaceModeForTests();
});

describe("View-mode document immutability", () => {
  test("keeps document data stable while session selection and layers change", async () => {
    const style = {
      labels: { groups: {} },
      mapLayerOrder: ["states", "rivers"],
      mapLayerVisibility: { states: true, rivers: false },
      relief: { density: 0.4, set: "simple", size: 1 }
    } satisfies Style;
    const document = {
      grid: { heights: new Uint8Array([20, 40]) },
      pack: { states: [{ name: "Eldoria" }] },
      style
    };
    const before = createCanonicalDocumentSnapshot(document);

    await setWorkspaceMode("view");
    startViewSession(
      new Map([
        ["toggleStates", true],
        ["toggleRivers", false]
      ]),
      document.style.mapLayerOrder
    );
    setViewSessionSelection({ cellId: 7, domainId: "1", domainKind: "state" });
    setViewSessionLayerVisibility("toggleStates", false);
    createSerializedMapStyle(document.style, getDocumentLayerOrder(document.style.mapLayerOrder), controlId =>
      getDocumentLayerVisibility(controlId, controlId === "toggleStates")
    );
    endViewSession(() => undefined);

    expect(createCanonicalDocumentSnapshot(document)).toBe(before);
  });
});
