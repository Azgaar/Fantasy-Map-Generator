import {tip} from "scripts/tooltips";

// module to prompt PWA installation
let installButton = null;
let deferredPrompt = null;

export function init(event) {
  const dontAskforInstallation = localStorage.getItem("installationDontAsk");
  if (dontAskforInstallation) return;

  installButton = createButton();
  deferredPrompt = event;

  window.addEventListener("appinstalled", () => {
    tip("Application is installed", false, "success", 8000);
    cleanup();
  });
}

function createButton() {
  const button = document.createElement("button");
  button.style = `
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
  document.querySelector("body").appendChild(button);
  return button;
}

function openDialog() {
  alertMessage.innerHTML = /* html */ `You can install the tool so that it will look and feel like desktop application:
    have its own icon on your home screen and work offline with some limitations
  `;
  $("#alert").dialog({
    resizable: false,
    title: "Install the Application",
    width: "38em",
    buttons: {
      Install: function () {
        $(this).dialog("close");
        deferredPrompt.prompt();
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    },
    open: function () {
      const checkbox =
        '<span><input id="dontAsk" class="checkbox" type="checkbox"><label for="dontAsk" class="checkbox-label dontAsk"><i>do not ask again</i></label><span>';
      const pane = this.parentElement.querySelector(".ui-dialog-buttonpane");
      pane.insertAdjacentHTML("afterbegin", checkbox);
    },
    close: function () {
      const box = this.parentElement.querySelector(".checkbox");
      if (box?.checked) {
        localStorage.setItem("installationDontAsk", true);
        cleanup();
      }
      $(this).dialog("destroy");
    }
  });

  function cleanup() {
    installButton.remove();
    installButton = null;
    deferredPrompt = null;
  }
}
