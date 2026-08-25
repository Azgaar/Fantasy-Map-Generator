import { showDomDialog } from "@/components/ui/dom-dialog";

export function showAlert(messageHtml: string, title = "Alert"): void {
  const content = document.createElement("div");
  content.id = "alertDialog";
  content.innerHTML = messageHtml;
  showDomDialog({
    actions: [{ label: "Close" }],
    content,
    placement: "center",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title,
    width: "fit-content"
  });
}
