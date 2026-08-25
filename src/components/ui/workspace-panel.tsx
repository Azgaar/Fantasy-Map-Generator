import { EmptyState, SearchField } from "@patkepa/kantzen-ui";
import type { IconName } from "@patkepa/kantzen-ui/icons";
import { Button } from "@patkepa/kantzen-ui/primitives";
import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode, Ref } from "react";

interface WorkspacePanelProps {
  children: ReactNode;
  className?: string;
}

interface WorkspacePanelHeaderProps {
  closeLabel?: string;
  onClose: () => void;
  title: string;
}

interface WorkspacePanelSearchProps {
  ariaLabel: string;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
  placeholder: string;
  shortcut?: string;
  value: string;
}

interface WorkspacePanelSectionProps {
  children: ReactNode;
  className?: string;
  description?: string;
  title: string;
}

interface WorkspacePanelActionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  label: string;
  secondaryAction?: {
    ariaLabel: string;
    commandId?: string;
    icon: IconName;
    id: string;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    tip?: string;
  };
  shortcut?: string;
}

interface WorkspacePanelEmptyStateProps {
  description?: string;
  icon?: IconName;
  title: string;
}

function classes(...values: (string | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

export function WorkspacePanel({ children, className }: WorkspacePanelProps): React.JSX.Element {
  return <div className={classes("fantasia-workspace-panel", className)}>{children}</div>;
}

export function WorkspacePanelHeader({
  closeLabel = "Close panel",
  onClose,
  title
}: WorkspacePanelHeaderProps): React.JSX.Element {
  return (
    <header className="fantasia-panel-header">
      <h1>{title}</h1>
      <Button
        aria-label={closeLabel}
        className="fantasia-panel-header__close"
        icon="cross"
        minimal
        onClick={event => {
          event.stopPropagation();
          onClose();
        }}
      />
    </header>
  );
}

export function WorkspacePanelSearch({
  ariaLabel,
  inputRef,
  onChange,
  placeholder,
  shortcut,
  value
}: WorkspacePanelSearchProps): React.JSX.Element {
  return (
    <div className="fantasia-panel-search">
      <SearchField
        ariaLabel={ariaLabel}
        className="fantasia-panel-search__field"
        inputRef={inputRef}
        onChange={onChange}
        placeholder={placeholder}
        value={value}
      />
      {shortcut ? <kbd aria-hidden="true">{shortcut}</kbd> : null}
    </div>
  );
}

export function WorkspacePanelSection({
  children,
  className,
  description,
  title
}: WorkspacePanelSectionProps): React.JSX.Element {
  return (
    <section className={classes("fantasia-panel-section", className)}>
      <header className="fantasia-panel-section__header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function WorkspacePanelAction({
  className,
  icon,
  label,
  secondaryAction,
  shortcut,
  ...buttonProps
}: WorkspacePanelActionProps): React.JSX.Element {
  const action = (
    <Button {...buttonProps} className={classes("fantasia-panel-action", className)} fill icon={icon} minimal>
      <span className="fantasia-panel-action__label">{label}</span>
      {shortcut ? <kbd>{shortcut}</kbd> : null}
    </Button>
  );

  if (!secondaryAction) return action;

  return (
    <div className="fantasia-panel-action-group">
      {action}
      <Button
        aria-label={secondaryAction.ariaLabel}
        className="fantasia-panel-action__secondary"
        data-command-id={secondaryAction.commandId}
        data-tip={secondaryAction.tip}
        icon={secondaryAction.icon}
        id={secondaryAction.id}
        minimal
        onClick={secondaryAction.onClick}
      />
    </div>
  );
}

export function WorkspacePanelEmptyState({
  description,
  icon = "search",
  title
}: WorkspacePanelEmptyStateProps): React.JSX.Element {
  return <EmptyState className="fantasia-panel-empty" description={description} icon={icon} title={title} />;
}
