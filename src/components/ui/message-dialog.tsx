import { Button } from "@patkepa/kantzen-ui/primitives";
import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { registerManagedDialog } from "@/components/dialog/dialog-helpers";
import { WorkspaceDialog } from "./dialog";
import { WorkspaceToggleField } from "./form-field";

type DialogIntent = "danger" | "none" | "primary" | "success" | "warning";

export interface MessageDialogAction {
  close?: boolean;
  intent?: DialogIntent;
  label: string;
  onClick?: () => void;
}

interface RememberChoice {
  defaultChecked?: boolean;
  label: string;
  onChange?: (checked: boolean) => void;
}

export interface MessageDialogOptions {
  actions?: MessageDialogAction[];
  id: string;
  messageHtml: string;
  onClose?: () => void;
  rememberChoice?: RememberChoice;
  title: string;
  width?: string;
}

export interface MessageDialogHandle {
  close: () => void;
}

const activeDialogs = new Map<string, MessageDialogHandle>();

function MessageDialogView({
  close,
  options
}: {
  close: () => void;
  options: MessageDialogOptions;
}): React.JSX.Element {
  const [rememberChoice, setRememberChoice] = useState(options.rememberChoice?.defaultChecked ?? false);
  const actions = options.actions ?? [{ label: "OK", intent: "primary" as const }];

  return (
    <WorkspaceDialog
      footer={
        <>
          {options.rememberChoice ? (
            <div className="fantasia-dialog__footer-leading">
              <WorkspaceToggleField
                checked={rememberChoice}
                label={options.rememberChoice.label}
                onChange={event => {
                  const checked = event.currentTarget.checked;
                  setRememberChoice(checked);
                  options.rememberChoice?.onChange?.(checked);
                }}
              />
            </div>
          ) : null}
          {actions.map((action, index) => (
            <Button
              data-autofocus={index === actions.length - 1 || undefined}
              intent={action.intent}
              key={action.label}
              onClick={() => {
                action.onClick?.();
                if (action.close !== false) close();
              }}
            >
              {action.label}
            </Button>
          ))}
        </>
      }
      isOpen
      onClose={close}
      title={options.title}
      width={options.width}
    >
      <div className="fantasia-message-dialog" dangerouslySetInnerHTML={{ __html: options.messageHtml }} />
    </WorkspaceDialog>
  );
}

export function showMessageDialog(options: MessageDialogOptions): MessageDialogHandle {
  activeDialogs.get(options.id)?.close();

  const container = document.createElement("div");
  container.dataset.dialogHost = options.id;
  (document.getElementById("dialogs") ?? document.body).appendChild(container);
  const root: Root = createRoot(container);
  let closed = false;
  let unregister = () => {};

  const handle = {
    close: () => {
      if (closed) return;
      closed = true;
      unregister();
      try {
        options.onClose?.();
      } finally {
        if (activeDialogs.get(options.id) === handle) activeDialogs.delete(options.id);
        queueMicrotask(() => {
          root.unmount();
          container.remove();
        });
      }
    }
  } satisfies MessageDialogHandle;

  unregister = registerManagedDialog(options.id, handle.close);
  activeDialogs.set(options.id, handle);
  root.render(<MessageDialogView close={handle.close} options={options} />);
  return handle;
}
