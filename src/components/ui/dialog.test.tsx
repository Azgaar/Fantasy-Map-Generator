import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { WorkspaceDialog } from "./dialog";

describe("WorkspaceDialog", () => {
  test("does not render when closed", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceDialog isOpen={false} onClose={() => {}} title="Export map">
        Export settings
      </WorkspaceDialog>
    );

    expect(markup).toBe("");
  });
});
