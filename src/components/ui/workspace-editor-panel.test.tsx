import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { WorkspaceEditorPanel } from "./workspace-editor-panel";

describe("WorkspaceEditorPanel", () => {
  test("renders a docked editor shell with a concise title", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceEditorPanel onClose={() => {}} onSearch={() => {}} title="States Editor" width={960}>
        State controls
      </WorkspaceEditorPanel>
    );

    expect(markup.includes("fantasia-editor-panel--wide")).toBe(true);
    expect(markup.includes('style="width:960px"')).toBe(true);
    expect(markup.includes(">States<")).toBe(true);
    expect(markup.includes("Map editor")).toBe(true);
    expect(markup.includes("Search states")).toBe(true);
    expect(markup.includes("State controls")).toBe(true);
  });
});
