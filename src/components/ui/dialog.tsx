import { Button } from "@patkepa/kantzen-ui/primitives";
import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import "./dialog.css";

interface WorkspaceDialogProps {
  canOutsideClickClose?: boolean;
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  size?: "large" | "medium" | "small";
  title: string;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    element => !element.hidden && element.getAttribute("aria-hidden") !== "true"
  );
}

export function WorkspaceDialog({
  canOutsideClickClose = false,
  children,
  description,
  footer,
  isOpen,
  onClose,
  size = "medium",
  title
}: WorkspaceDialogProps): React.JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  onCloseRef.current = onClose;

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
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
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
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fmg-dialog-overlay"
      onMouseDown={event => {
        if (canOutsideClickClose && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`fmg-dialog fmg-dialog--${size}`}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="fmg-dialog__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <Button aria-label="Close dialog" className="fmg-dialog__close" icon="cross" minimal onClick={onClose} />
        </header>
        <div className="fmg-dialog__body">{children}</div>
        {footer ? <footer className="fmg-dialog__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body
  );
}
