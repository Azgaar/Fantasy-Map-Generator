import { Alert } from "@patkepa/kantzen-ui/primitives";
import { WorkspaceToggleField } from "./form-field";

interface WorkspaceConfirmDialogProps {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  rememberChoice?: {
    checked: boolean;
    label: string;
    onChange: (checked: boolean) => void;
  };
  title: string;
}

export function WorkspaceConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel = "Continue",
  description,
  isOpen,
  onCancel,
  onConfirm,
  rememberChoice,
  title
}: WorkspaceConfirmDialogProps): React.JSX.Element {
  return (
    <Alert
      cancelButtonText={cancelLabel}
      canEscapeKeyCancel
      className="fantasia-confirm-dialog"
      confirmButtonText={confirmLabel}
      icon="warning-sign"
      intent="warning"
      isOpen={isOpen}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <h2>{title}</h2>
      <p>{description}</p>
      {rememberChoice ? (
        <WorkspaceToggleField
          checked={rememberChoice.checked}
          label={rememberChoice.label}
          onChange={event => rememberChoice.onChange(event.target.checked)}
        />
      ) : null}
    </Alert>
  );
}
