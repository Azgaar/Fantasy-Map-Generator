import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { WorkspaceTabs } from "./workspace-tabs";

describe("WorkspaceTabs", () => {
  test("renders the active tab and panel", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceTabs
        ariaLabel="Map settings"
        onChange={() => {}}
        tabs={[
          { content: <p>Canvas controls</p>, id: "canvas", label: "Canvas" },
          { content: <p>Label controls</p>, id: "labels", label: "Labels" }
        ]}
        value="labels"
      />
    );

    expect(markup.includes('role="tablist"')).toBe(true);
    expect(markup.includes('aria-selected="true"')).toBe(true);
    expect(markup.includes('role="tabpanel"')).toBe(true);
    expect(markup.includes("Label controls")).toBe(true);
    expect(markup.includes("Canvas controls")).toBe(false);
  });
});
