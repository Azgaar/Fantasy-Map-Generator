import { tip } from "@/components/tooltips";

let installButton: HTMLButtonElement | null = null;
let deferredPrompt: (Event & { prompt: () => void }) | null = null;

function init(event: Event & { prompt: () => void }): void {
  const dontAskforInstallation = localStorage.getItem("installationDontAsk");
  if (dontAskforInstallation) return;

  installButton = createButton();
  deferredPrompt = event;

  window.addEventListener("appinstalled", () => {
    tip("Application is installed", false, "success", 8000);
    cleanup();
  });
}

function createButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.style.cssText = `
      position: fixed;
      top: 1em;
      right: 1em;
      padding: 0.6em 0.8em;
      width: auto;
    `;
  button.className = "options glow";
  button.innerHTML = "Install";
  button.onclick = openDialog;
  button.onmouseenter = () => tip("Install the Application");
  document.getElementById("optionsContainer")!.appendChild(button);
  return button;
}

function openDialog(): void {
  const messageHtml = /* html */ `You can install the tool so that it will look and feel like desktop application:
    have its own icon on your home screen and work offline with some limitations
  `;
  let dontAskAgain = false;

  void import("@/components/ui/message-dialog").then(({ showMessageDialog }) => {
    showMessageDialog({
      actions: [{ label: "Cancel" }, { label: "Install", intent: "primary", onClick: () => deferredPrompt?.prompt() }],
      id: "installationDialog",
      messageHtml,
      onClose: () => {
        if (!dontAskAgain) return;
        localStorage.setItem("installationDontAsk", "true");
        cleanup();
      },
      rememberChoice: {
        label: "Do not ask again",
        onChange: checked => {
          dontAskAgain = checked;
        }
      },
      title: "Install the Application",
      width: "38em"
    });
  });
}

function cleanup(): void {
  installButton?.remove();
  installButton = null;
  deferredPrompt = null;
}

export const Installation = { init };
