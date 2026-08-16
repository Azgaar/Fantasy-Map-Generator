import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { WorkspaceNotice } from "./feedback";

describe("WorkspaceNotice", () => {
  test("uses an alert role for errors", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceNotice title="Map could not be loaded" tone="danger">
        Check that the file is a supported map.
      </WorkspaceNotice>
    );

    expect(markup.includes('role="alert"')).toBe(true);
    expect(markup.includes("Map could not be loaded")).toBe(true);
  });

  test("uses a status role for non-critical feedback", () => {
    const markup = renderToStaticMarkup(<WorkspaceNotice title="Preset saved" tone="success" />);

    expect(markup.includes('role="status"')).toBe(true);
  });
});
