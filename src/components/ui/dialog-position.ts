export type WorkspaceDialogPlacement =
  | "below-right"
  | "below-center"
  | "bottom-center"
  | "bottom-left"
  | "center"
  | "left-center"
  | "left-top"
  | "right-center"
  | "top-center"
  | "top-left"
  | "top-right";

interface Rectangle {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface Viewport {
  height: number;
  left?: number;
  width: number;
}

export interface WorkspaceDialogOffset {
  x: number;
  y: number;
}

const VIEWPORT_MARGIN = 8;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));

export function getDialogPosition(
  anchor: Rectangle,
  dialog: Pick<Rectangle, "height" | "width">,
  placement: WorkspaceDialogPlacement,
  viewport: Viewport,
  offset: WorkspaceDialogOffset = { x: 10, y: 10 }
): { left: number; top: number } {
  const viewportLeft = viewport.left ?? 0;
  const anchorRight = anchor.left + anchor.width;
  const anchorBottom = anchor.top + anchor.height;
  const centeredLeft = anchor.left + (anchor.width - dialog.width) / 2;

  const left =
    placement === "top-left" || placement === "bottom-left"
      ? anchor.left + offset.x
      : placement === "top-right" || placement === "below-right"
        ? anchorRight - dialog.width - offset.x
        : placement === "left-top" || placement === "left-center"
          ? anchor.left - dialog.width - offset.x
          : placement === "right-center"
            ? anchorRight + offset.x
            : centeredLeft;

  const top =
    placement === "center" || placement === "left-center" || placement === "right-center"
      ? anchor.top + (anchor.height - dialog.height) / 2
      : placement === "bottom-left" || placement === "bottom-center"
        ? anchorBottom - dialog.height - offset.y
        : placement === "below-right" || placement === "below-center"
          ? anchorBottom + offset.y
          : anchor.top + offset.y;

  return {
    left: clamp(left, viewportLeft + VIEWPORT_MARGIN, viewport.width - dialog.width - VIEWPORT_MARGIN),
    top: clamp(top, VIEWPORT_MARGIN, viewport.height - dialog.height - VIEWPORT_MARGIN)
  };
}
