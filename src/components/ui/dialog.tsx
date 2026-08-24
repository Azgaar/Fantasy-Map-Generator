import { Button } from "@patkepa/kantzen-ui/primitives";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  getDialogPosition,
  type WorkspaceDialogOffset,
  type WorkspaceDialogPlacement
} from "./dialog-position";
import "./dialog.css";

interface WorkspaceDialogProps {
  canOutsideClickClose?: boolean;
  children: ReactNode;
  className?: string;
  description?: string;
  dialogId?: string;
  footer?: ReactNode;
  height?: CSSProperties["height"];
  isDraggable?: boolean;
  isModal?: boolean;
  isOpen: boolean;
  maxHeight?: CSSProperties["maxHeight"];
  onClose: () => void;
  onResizeEnd?: () => void;
  placementOffset?: WorkspaceDialogOffset;
  placement?: WorkspaceDialogPlacement;
  placementTarget?: Element | null;
  positionRevision?: number;
  resizable?: boolean;
  size?: "large" | "medium" | "small";
  title: string;
  width?: CSSProperties["width"];
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

const MIN_WORKSPACE_DIALOG_WIDTH = 280;

function getWorkspaceRightEdge(): number {
  const panel = document.body.classList.contains("workspace-panel-open")
    ? document.getElementById("options")
    : null;
  return panel?.getBoundingClientRect().right ?? 0;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    element => !element.hidden && element.getAttribute("aria-hidden") !== "true"
  );
}

interface DragState {
  offsetX: number;
  offsetY: number;
  pointerId: number;
}

export function WorkspaceDialog({
  canOutsideClickClose = false,
  children,
  className,
  description,
  dialogId,
  footer,
  height,
  isDraggable,
  isModal = true,
  isOpen,
  maxHeight,
  onClose,
  onResizeEnd,
  placementOffset,
  placement = "center",
  placementTarget,
  positionRevision = 0,
  resizable = false,
  size = "medium",
  title,
  width
}: WorkspaceDialogProps): React.JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  onCloseRef.current = onClose;
  const canDrag = isDraggable ?? !isModal;

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusDialog = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const initialFocus = dialog.querySelector<HTMLElement>("[data-autofocus]") ?? getFocusableElements(dialog)[0];
      (initialFocus ?? dialog).focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      if (event.key === "Escape") {
        if (!isModal && !dialog.contains(document.activeElement)) return;
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (!isModal || event.key !== "Tab") return;
      const focusable = getFocusableElements(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusDialog);
      document.removeEventListener("keydown", handleKeyDown, true);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [isModal, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || isModal) return;

    const positionDialog = () => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const workspaceRight = placement === "top-right" ? getWorkspaceRightEdge() : 0;
      const availableWidth = window.innerWidth - workspaceRight - 16;
      const viewportLeft = availableWidth >= MIN_WORKSPACE_DIALOG_WIDTH ? workspaceRight : 0;
      dialog.style.maxWidth = viewportLeft ? `${availableWidth}px` : "";

      const targetRect = placementTarget?.getBoundingClientRect() ?? {
        height: window.innerHeight,
        left: 0,
        top: 0,
        width: window.innerWidth
      };
      const dialogRect = dialog.getBoundingClientRect();
      const position = getDialogPosition(
        targetRect,
        dialogRect,
        placement,
        {
          height: window.innerHeight,
          left: viewportLeft,
          width: window.innerWidth
        },
        placementOffset
      );
      dialog.style.left = `${position.left}px`;
      dialog.style.top = `${position.top}px`;
    };

    positionDialog();
    window.addEventListener("resize", positionDialog);
    window.addEventListener("workspace-panel-change", positionDialog);
    return () => {
      window.removeEventListener("resize", positionDialog);
      window.removeEventListener("workspace-panel-change", positionDialog);
    };
  }, [isModal, isOpen, placement, placementOffset, placementTarget, positionRevision]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen || !resizable || !onResizeEnd) return;

    let initialized = false;
    let resizeTimer: number | undefined;
    const observer = new ResizeObserver(() => {
      if (!initialized) {
        initialized = true;
        return;
      }
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(onResizeEnd, 120);
    });
    observer.observe(dialog);
    return () => {
      observer.disconnect();
      window.clearTimeout(resizeTimer);
    };
  }, [isOpen, onResizeEnd, resizable]);

  const handleDragStart = (event: ReactPointerEvent<HTMLElement>) => {
    if (!canDrag || event.button !== 0 || (event.target as Element).closest("button")) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const bounds = dialog.getBoundingClientRect();
    dragStateRef.current = {
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      pointerId: event.pointerId
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;
    const dialog = dialogRef.current;
    if (!dragState || !dialog || dragState.pointerId !== event.pointerId) return;

    const bounds = dialog.getBoundingClientRect();
    const left = Math.max(8, Math.min(event.clientX - dragState.offsetX, window.innerWidth - bounds.width - 8));
    const top = Math.max(8, Math.min(event.clientY - dragState.offsetY, window.innerHeight - bounds.height - 8));
    dialog.style.left = `${left}px`;
    dialog.style.top = `${top}px`;
  };

  const handleDragEnd = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  if (!isOpen || typeof document === "undefined") return null;

  const dialog = (
    <div
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      aria-modal={isModal || undefined}
      className={`fmg-dialog fmg-dialog--${size}${isModal ? "" : " fmg-dialog--modeless"}${resizable ? " fmg-dialog--resizable" : ""}${className ? ` ${className}` : ""}`}
      id={dialogId}
      ref={dialogRef}
      role="dialog"
      style={{ height, maxHeight, width }}
      tabIndex={-1}
    >
      <header
        className={`fmg-dialog__header${canDrag ? " fmg-dialog__header--draggable" : ""}`}
        onPointerCancel={handleDragEnd}
        onPointerDown={handleDragStart}
        onPointerMove={handleDrag}
        onPointerUp={handleDragEnd}
      >
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
        </div>
        <Button aria-label="Close dialog" className="fmg-dialog__close" icon="cross" minimal onClick={onClose} />
      </header>
      <div className="fmg-dialog__body">{children}</div>
      {footer ? <footer className="fmg-dialog__footer">{footer}</footer> : null}
    </div>
  );

  return createPortal(
    isModal ? (
      <div
        className="fmg-dialog-overlay"
        onMouseDown={event => {
          if (canOutsideClickClose && event.target === event.currentTarget) onClose();
        }}
      >
        {dialog}
      </div>
    ) : (
      dialog
    ),
    document.body
  );
}
