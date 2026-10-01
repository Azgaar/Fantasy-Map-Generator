// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import type { Proposal } from "@/services/assistant/chats";

vi.mock("./proposals", () => ({ Proposals: { can: () => true } }));
vi.mock("@/components/icons", () => ({ Icons: { html: () => "" } }));
vi.mock("@/components/map-entities", () => ({ MapEntities: { parseKey: () => undefined } }));

const { proposalHtml } = await import("./proposal-card");

const card = (change: Proposal["change"]) => {
  const proposal: Proposal = { number: 1, mapId: 1, summary: "Notes", operations: [], change, state: "proposed" };
  const host = document.createElement("div");
  host.innerHTML = proposalHtml(proposal, 0, 1);
  return host;
};

it("renders a note in the notes subset as HTML", () => {
  const host = card([
    { key: "marker:1", entity: "Marker", field: "note", before: "", after: "<p><b>Old</b> ruin</p>" }
  ]);
  expect(host.querySelector(".assistantNotePreview b")?.textContent).toBe("Old");
});

it("escapes a note outside the notes subset, also on an added entity", () => {
  const unsafe = `<img src="x" onerror="alert(1)">`;
  const host = card([
    { key: "marker:1", entity: "Marker", field: "note", before: "", after: unsafe },
    { key: "burg:2", entity: "Burg", field: "", before: undefined, after: { i: 2, note: unsafe } }
  ]);
  const previews = [...host.querySelectorAll(".assistantNotePreview")];
  expect(previews).toHaveLength(2);
  for (const preview of previews) {
    expect(preview.querySelector("img")).toBeNull();
    expect(preview.textContent).toBe(unsafe);
  }
});
