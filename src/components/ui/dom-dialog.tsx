import { Button } from "@patkepa/kantzen-ui/primitives";
import type { CSSProperties } from "react";
import { useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import {
  type DialogParams,
  registerManagedDialog
} from "@/components/dialog/dialog-helpers";
import { WorkspaceDialog } from "./dialog";
import { getDialogPlacementOverride } from "./dialog-placement-context";
import type { WorkspaceDialogOffset, WorkspaceDialogPlacement } from "./dialog-position";

export interface DomDialogOptions {
  actions?: DomDialogAction[];
  beforeClose?: () => boolean | void;
  className?: string;
  content: HTMLElement;
  destroyOnClose?: boolean;
  height?: CSSProperties["height"];
  isModal?: boolean;
  maxHeight?: CSSProperties["maxHeight"];
  onClose?: () => void;
  onResizeEnd?: () => void;
  placementOffset?: WorkspaceDialogOffset;
  placement?: WorkspaceDialogPlacement;
  placementTarget?: Element | null;
  resizable?: boolean;
  title: string;
  width?: CSSProperties["width"];
}

export interface DomDialogAction {
  close?: boolean;
  label: string;
  onClick?: (button: HTMLButtonElement) => void;
  tip?: string;
}

export interface DomDialogHandle {
  close: () => void;
  update: (params: DialogParams) => void;
}

const activeDialogs = new Map<string, DomDialogHandle>();
const contentOrigins = new WeakMap<
  HTMLElement,
  {
    display: string;
    hidden: boolean;
    nextSibling: ChildNode | null;
    parent: ParentNode | null;
  }
>();

function DomDialogView({
  options,
  positionRevision
}: {
  options: DomDialogOptions;
  positionRevision: number;
}): React.JSX.Element {
  const contentHostRef = useRef<HTMLDivElement>(null);
  const actions = options.actions ?? [];

  useLayoutEffect(() => {
    const host = contentHostRef.current;
    if (!host) return;

    const { content, destroyOnClose = true } = options;
    const origin = contentOrigins.get(content) ?? {
      display: content.style.display,
      hidden: content.hidden,
      nextSibling: content.nextSibling,
      parent: content.parentNode
    };
    contentOrigins.set(content, origin);
    content.style.removeProperty("display");
    content.hidden = false;
    host.appendChild(content);

    return () => {
      if (destroyOnClose || content.parentNode !== host) return;
      content.style.display = origin.display;
      content.hidden = origin.hidden;
      if (origin.parent) {
        if (origin.nextSibling?.parentNode === origin.parent) origin.parent.insertBefore(content, origin.nextSibling);
        else origin.parent.appendChild(content);
      }
      contentOrigins.delete(content);
    };
  }, [options.content, options.destroyOnClose]);

  return (
    <WorkspaceDialog
      className={options.className}
      footer={
        actions.length ? (
          <>
            {actions.map((action, index) => (
              <Button
                data-autofocus={index === actions.length - 1 || undefined}
                data-tip={action.tip}
                key={`${action.label}-${index}`}
                onClick={event => {
                  action.onClick?.(event.currentTarget);
                  if (action.close !== false) activeDialogs.get(options.content.id)?.close();
                }}
              >
                {action.label}
              </Button>
            ))}
          </>
        ) : undefined
      }
      isModal={options.isModal ?? false}
      isOpen
      height={options.height}
      maxHeight={options.maxHeight}
      onClose={() => {
        if (options.beforeClose?.() === false) return;
        activeDialogs.get(options.content.id)?.close();
      }}
      onResizeEnd={options.onResizeEnd}
      placement={options.placement}
      placementOffset={options.placementOffset}
      placementTarget={options.placementTarget}
      positionRevision={positionRevision}
      resizable={options.resizable}
      title={options.title}
      width={options.width ?? "fit-content"}
    >
      <div className="fmg-dom-dialog__content" ref={contentHostRef} />
    </WorkspaceDialog>
  );
}

export function showDomDialog(initialOptions: DomDialogOptions): DomDialogHandle {
  const placementOverride = getDialogPlacementOverride();
  initialOptions = placementOverride ? { ...initialOptions, placement: placementOverride } : initialOptions;
  const id = initialOptions.content.id;
  if (!id) throw new Error("A managed DOM dialog requires content with an id");
  const activeDialog = activeDialogs.get(id);
  if (activeDialog) {
    activeDialog.update({
      height: initialOptions.height,
      maxHeight: initialOptions.maxHeight,
      placement: initialOptions.placement,
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
  let positionRevision = 0;
  let closed = false;
  let unregister = () => {};

  const render = () => root.render(<DomDialogView options={options} positionRevision={positionRevision} />);
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
      positionRevision++;
      options = {
        ...options,
        height: params.height ?? options.height,
        maxHeight: params.maxHeight ?? options.maxHeight,
        placement: params.placement ?? options.placement,
        resizable: params.resizable ?? options.resizable,
        title: params.title ?? options.title,
        width: params.width ?? options.width
      };
      render();
    }
  } satisfies DomDialogHandle;

  const requestClose = () => {
    if (options.beforeClose?.() === false) return;
    handle.close();
  };

  unregister = registerManagedDialog(
    id,
    handle.close,
    initialOptions.content.classList.contains("stable"),
    handle.update,
    requestClose
  );
  activeDialogs.set(id, handle);
  flushSync(render);
  return handle;
}
