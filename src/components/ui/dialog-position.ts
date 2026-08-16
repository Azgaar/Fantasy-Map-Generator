export type WorkspaceDialogPlacement = "center" | "top-left" | "top-right";

interface Rectangle {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface Viewport {
  height: number;
  width: number;
}

const VIEWPORT_MARGIN = 8;

const clamp = (value: number, maximum: number): number =>
  Math.max(VIEWPORT_MARGIN, Math.min(value, Math.max(VIEWPORT_MARGIN, maximum)));

export function getDialogPosition(
  anchor: Rectangle,
  dialog: Pick<Rectangle, "height" | "width">,
  placement: WorkspaceDialogPlacement,
  viewport: Viewport,
  offset = 10
): { left: number; top: number } {
  const left =
    placement === "top-left"
      ? anchor.left + offset
      : placement === "top-right"
        ? anchor.left + anchor.width - dialog.width - offset
        : anchor.left + (anchor.width - dialog.width) / 2;
  const top = placement === "center" ? anchor.top + (anchor.height - dialog.height) / 2 : anchor.top + offset;

  return {
    left: clamp(left, viewport.width - dialog.width - VIEWPORT_MARGIN),
    top: clamp(top, viewport.height - dialog.height - VIEWPORT_MARGIN)
  };
}
