import { SearchField } from "@patkepa/kantzen-ui";
import { Icon } from "@patkepa/kantzen-ui/icons";
import { Button } from "@patkepa/kantzen-ui/primitives";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import "./workspace-editor-panel.css";

interface WorkspaceEditorPanelProps {
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  onClose: () => void;
  onSearch?: (query: string) => void;
  title: string;
  width?: number;
}

let openPanelCount = 0;

export function WorkspaceEditorPanel({
  children,
  className,
  footer,
  onClose,
  onSearch,
  title,
  width
}: WorkspaceEditorPanelProps): React.JSX.Element {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const onSearchRef = useRef(onSearch);
  const [search, setSearch] = useState("");
  const titleId = useId();
  const panelTitle = title.replace(/ Editor$/, "");
  onCloseRef.current = onClose;
  onSearchRef.current = onSearch;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openPanelCount++;
    document.body.classList.add("workspace-editor-panel-open");
    const focusPanel = window.requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
      window.dispatchEvent(new Event("resize"));
    });
    const closeOnEscape = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (event.key !== "Escape" || !panel?.contains(document.activeElement)) return;
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
    };

    document.addEventListener("keydown", closeOnEscape, true);
    return () => {
      window.cancelAnimationFrame(focusPanel);
      document.removeEventListener("keydown", closeOnEscape, true);
      onSearchRef.current?.("");
      openPanelCount--;
      if (!openPanelCount) document.body.classList.remove("workspace-editor-panel-open");
      window.dispatchEvent(new Event("resize"));
      const focusTarget = previousFocus?.isConnected ? previousFocus : document.getElementById("workspaceMapTrigger");
      focusTarget?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const property = "--fantasia-active-editor-panel-width";
    const value = `${width ?? 560}px`;
    document.body.style.setProperty(property, value);
    window.dispatchEvent(new Event("resize"));
    return () => {
      if (document.body.style.getPropertyValue(property) === value) document.body.style.removeProperty(property);
    };
  }, [width]);

  return (
    <aside
      aria-labelledby={titleId}
      className={`fantasia-editor-panel${width ? " fantasia-editor-panel--wide" : ""}${className ? ` ${className}` : ""}`}
      ref={panelRef}
      role="dialog"
      style={width ? ({ width } satisfies CSSProperties) : undefined}
      tabIndex={-1}
    >
      <header className="fantasia-editor-panel__header">
        <span aria-hidden="true" className="fantasia-editor-panel__icon">
          <Icon icon="edit" size={18} />
        </span>
        <div className="fantasia-editor-panel__heading">
          <h2 id={titleId}>{panelTitle}</h2>
          <p>Map editor</p>
        </div>
        <Button
          aria-label="Close editor panel"
          className="fantasia-editor-panel__close"
          icon="cross"
          minimal
          onClick={onClose}
        />
      </header>
      {onSearch ? (
        <div className="fantasia-editor-panel__search">
          <SearchField
            ariaLabel={`Search ${panelTitle.toLocaleLowerCase()}`}
            onChange={value => {
              setSearch(value);
              onSearch(value);
            }}
            placeholder={`Search ${panelTitle.toLocaleLowerCase()}`}
            value={search}
          />
        </div>
      ) : null}
      <div className="fantasia-editor-panel__body">{children}</div>
      {footer ? <footer className="fantasia-editor-panel__footer">{footer}</footer> : null}
    </aside>
  );
}
