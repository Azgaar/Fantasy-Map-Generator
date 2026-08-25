import { Button } from "@patkepa/kantzen-ui/primitives";
import type { CSSProperties } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import {
  type DialogAccess,
  type DialogParams,
  registerManagedDialog
} from "@/components/dialog/dialog-helpers";
import { WorkspaceDialog } from "./dialog";
import {
  type DomDialogPresentation,
  getDialogPlacementOverride,
  getDialogPresentationOverride
} from "./dialog-placement-context";
import type { WorkspaceDialogOffset, WorkspaceDialogPlacement } from "./dialog-position";
import { WorkspaceEditorPanel } from "./workspace-editor-panel";

export interface DomDialogOptions {
  access?: DialogAccess;
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
  presentation?: DomDialogPresentation;
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
  const [panelWidth, setPanelWidth] = useState<number>();
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

    let measureFrame = 0;
    const observerOptions: MutationObserverInit = {
      attributes: true,
      attributeFilter: ["hidden", "style"],
      childList: true,
      subtree: true
    };
    const measurePanel = () => {
      if (window.innerWidth <= 760) {
        setPanelWidth(undefined);
        return;
      }

      const table = content.querySelector<HTMLElement>(".table");
      if (!table) {
        setPanelWidth(undefined);
        return;
      }

      mutationObserver.disconnect();
      const measurementTable = table.cloneNode(true) as HTMLElement;
      let intrinsicTableWidth = 0;
      try {
        measurementTable.removeAttribute("id");
        measurementTable.querySelectorAll<HTMLElement>("[id]").forEach(element => element.removeAttribute("id"));
        measurementTable.style.setProperty("position", "fixed", "important");
        measurementTable.style.setProperty("top", "0", "important");
        measurementTable.style.setProperty("left", "-100000px", "important");
        measurementTable.style.setProperty("width", "max-content", "important");
        measurementTable.style.setProperty("min-width", "0", "important");
        measurementTable.style.setProperty("max-width", "none", "important");
        measurementTable.style.setProperty("height", "auto", "important");
        measurementTable.style.setProperty("max-height", "none", "important");
        measurementTable.style.setProperty("overflow", "visible", "important");
        measurementTable.style.setProperty("visibility", "hidden", "important");
        measurementTable.style.setProperty("pointer-events", "none", "important");
        measurementTable.querySelectorAll<HTMLElement>(":scope > .header, :scope > .states").forEach(row => {
          row.style.setProperty("width", "max-content", "important");
          row.style.setProperty("min-width", "0", "important");
        });
        content.appendChild(measurementTable);
        intrinsicTableWidth = measurementTable.scrollWidth;
      } finally {
        measurementTable.remove();
        mutationObserver.takeRecords();
        mutationObserver.observe(content, observerOptions);
      }

      const panel = host.closest<HTMLElement>(".fmg-editor-panel");
      const panelChromeWidth = panel ? Math.max(0, panel.offsetWidth - table.clientWidth) : 0;
      const maximumWidth = window.innerWidth - 40;
      const expandedWidth = Math.min(Math.max(560, Math.ceil(intrinsicTableWidth + panelChromeWidth)), maximumWidth);
      setPanelWidth(expandedWidth > 560 ? expandedWidth : undefined);
    };
    const scheduleMeasurement = () => {
      window.cancelAnimationFrame(measureFrame);
      measureFrame = window.requestAnimationFrame(measurePanel);
    };
    const mutationObserver = new MutationObserver(scheduleMeasurement);
    mutationObserver.observe(content, observerOptions);
    const handleViewportResize = (event: UIEvent) => {
      if (event.isTrusted) scheduleMeasurement();
    };
    window.addEventListener("resize", handleViewportResize);
    scheduleMeasurement();

    return () => {
      window.cancelAnimationFrame(measureFrame);
      mutationObserver.disconnect();
      window.removeEventListener("resize", handleViewportResize);
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

  const close = () => {
    if (options.beforeClose?.() === false) return;
    activeDialogs.get(options.content.id)?.close();
  };
  const footer = actions.length ? (
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
  ) : undefined;
  const content = <div className="fmg-dom-dialog__content" ref={contentHostRef} />;

  if (options.presentation === "panel") {
    const onSearch = options.content.classList.contains("editorDialog")
      ? (query: string) => {
          const normalizedQuery = query.trim().toLocaleLowerCase();
          for (const row of options.content.querySelectorAll<HTMLElement>(".states")) {
            row.hidden = Boolean(normalizedQuery && !row.textContent?.toLocaleLowerCase().includes(normalizedQuery));
          }
        }
      : undefined;
    return (
      <WorkspaceEditorPanel
        className={options.className}
        footer={footer}
        onClose={close}
        onSearch={onSearch}
        title={options.title}
        width={panelWidth}
      >
        {content}
      </WorkspaceEditorPanel>
    );
  }

  return (
    <WorkspaceDialog
      className={options.className}
      footer={footer}
      isModal={options.isModal ?? false}
      isOpen
      height={options.height}
      maxHeight={options.maxHeight}
      onClose={close}
      onResizeEnd={options.onResizeEnd}
      placement={options.placement}
      placementOffset={options.placementOffset}
      placementTarget={options.placementTarget}
      positionRevision={positionRevision}
      resizable={options.resizable}
      title={options.title}
      width={options.width ?? "fit-content"}
    >
      {content}
    </WorkspaceDialog>
  );
}

export function showDomDialog(initialOptions: DomDialogOptions): DomDialogHandle {
  const placementOverride = getDialogPlacementOverride();
  const presentationOverride = getDialogPresentationOverride();
  initialOptions = {
    ...initialOptions,
    placement: placementOverride ?? initialOptions.placement,
    presentation: presentationOverride ?? initialOptions.presentation
  };
  const id = initialOptions.content.id;
  if (!id) throw new Error("A managed DOM dialog requires content with an id");
  const activeDialog = activeDialogs.get(id);
  if (activeDialog) {
    activeDialog.update({
      height: initialOptions.height,
      maxHeight: initialOptions.maxHeight,
      placement: initialOptions.placement,
      presentation: initialOptions.presentation,
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
        presentation: params.presentation ?? options.presentation,
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
    requestClose,
    options.access
  );
  activeDialogs.set(id, handle);
  flushSync(render);
  return handle;
}
