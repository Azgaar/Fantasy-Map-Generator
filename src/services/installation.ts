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
  alertMessage.innerHTML = /* html */ `You can install the tool so that it will look and feel like desktop application:
    have its own icon on your home screen and work offline with some limitations
  `;
  $("#alert").dialog({
    resizable: false,
    title: "Install the Application",
    width: "38em",
    buttons: {
      Install: function (this: HTMLElement) {
        $(this).dialog("close");
        deferredPrompt?.prompt();
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    },
    open: function (this: HTMLElement) {
      const checkbox =
        '<span><input id="dontAsk" class="checkbox" type="checkbox"><label for="dontAsk" class="checkbox-label dontAsk"><i>do not ask again</i></label></span>';
      const pane = this.parentElement!.querySelector(".ui-dialog-buttonpane")!;
      pane.insertAdjacentHTML("afterbegin", checkbox);
    },
    close: function (this: HTMLElement) {
      const box = this.parentElement!.querySelector<HTMLInputElement>(".checkbox");
      if (box?.checked) {
        localStorage.setItem("installationDontAsk", "true");
        cleanup();
      }
      $(this).dialog("destroy");
    }
  });
}

function cleanup(): void {
  installButton?.remove();
  installButton = null;
  deferredPrompt = null;
}

export const Installation = { init };
