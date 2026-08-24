import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { WorkspaceEditorPanel } from "./workspace-editor-panel";

describe("WorkspaceEditorPanel", () => {
  test("renders a docked editor shell with a concise title", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceEditorPanel onClose={() => {}} onSearch={() => {}} title="States Editor">
        State controls
      </WorkspaceEditorPanel>
    );

    expect(markup.includes('class="fmg-editor-panel"')).toBe(true);
    expect(markup.includes(">States<")).toBe(true);
    expect(markup.includes("Map editor")).toBe(true);
    expect(markup.includes("Search states")).toBe(true);
    expect(markup.includes("State controls")).toBe(true);
  });
});
