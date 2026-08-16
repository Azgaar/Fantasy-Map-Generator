import type { CSSProperties } from "react";
import { useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import {
  type DialogParams,
  registerManagedDialog
} from "@/components/dialog/dialog-helpers";
import { WorkspaceDialog } from "./dialog";
import type { WorkspaceDialogOffset, WorkspaceDialogPlacement } from "./dialog-position";

export interface DomDialogOptions {
  content: HTMLElement;
  destroyOnClose?: boolean;
  height?: CSSProperties["height"];
  isModal?: boolean;
  onClose?: () => void;
  placementOffset?: WorkspaceDialogOffset;
  placement?: WorkspaceDialogPlacement;
  placementTarget?: Element | null;
  resizable?: boolean;
  title: string;
  width?: CSSProperties["width"];
}

export interface DomDialogHandle {
  close: () => void;
  update: (params: DialogParams) => void;
}

const activeDialogs = new Map<string, DomDialogHandle>();

function DomDialogView({ options }: { options: DomDialogOptions }): React.JSX.Element {
  const contentHostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const host = contentHostRef.current;
    if (!host) return;

    const { content, destroyOnClose = true } = options;
    const originalParent = content.parentNode;
    const originalNextSibling = content.nextSibling;
    const originalDisplay = content.style.display;
    const originalHidden = content.hidden;
    content.style.removeProperty("display");
    content.hidden = false;
    host.appendChild(content);

    return () => {
      if (destroyOnClose) return;
      content.style.display = originalDisplay;
      content.hidden = originalHidden;
      if (!originalParent) return;
      if (originalNextSibling?.parentNode === originalParent) originalParent.insertBefore(content, originalNextSibling);
      else originalParent.appendChild(content);
    };
  }, [options.content, options.destroyOnClose]);

  return (
    <WorkspaceDialog
      isModal={options.isModal ?? false}
      isOpen
      height={options.height}
      onClose={() => activeDialogs.get(options.content.id)?.close()}
      placement={options.placement}
      placementOffset={options.placementOffset}
      placementTarget={options.placementTarget}
      resizable={options.resizable}
      title={options.title}
      width={options.width}
    >
      <div className="fmg-dom-dialog__content" ref={contentHostRef} />
    </WorkspaceDialog>
  );
}

export function showDomDialog(initialOptions: DomDialogOptions): DomDialogHandle {
  const id = initialOptions.content.id;
  if (!id) throw new Error("A managed DOM dialog requires content with an id");
  const activeDialog = activeDialogs.get(id);
  if (activeDialog) {
    activeDialog.update({
      height: initialOptions.height,
      resizable: initialOptions.resizable,
      title: initialOptions.title,
      width: initialOptions.width
    });
    return activeDialog;
  }

  const container = document.createElement("div");
  container.dataset.dialogHost = id;
  (document.getElementById("dialogs") ?? document.body).appendChild(container);
  const root: Root = createRoot(container);
  let options = initialOptions;
  let closed = false;
  let unregister = () => {};

  const render = () => root.render(<DomDialogView options={options} />);
  const handle = {
    close: () => {
      if (closed) return;
      closed = true;
      unregister();
      try {
        options.onClose?.();
      } finally {
        if (options.destroyOnClose !== false) options.content.remove();
        if (activeDialogs.get(id) === handle) activeDialogs.delete(id);
        queueMicrotask(() => {
          root.unmount();
          container.remove();
        });
      }
    },
    update: (params: DialogParams) => {
      if (closed) return;
      options = {
        ...options,
        height: params.height ?? options.height,
        resizable: params.resizable ?? options.resizable,
        title: params.title ?? options.title,
        width: params.width ?? options.width
      };
      render();
    }
  } satisfies DomDialogHandle;

  unregister = registerManagedDialog(id, handle.close, initialOptions.content.classList.contains("stable"), handle.update);
  activeDialogs.set(id, handle);
  flushSync(render);
  return handle;
}
