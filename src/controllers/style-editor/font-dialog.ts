import { destroyDialog } from "@/components/dialog/dialog-helpers";
import { ensureEl, escapeHtml } from "@/utils";

export const FONT_DIALOG = "fontDialog";

const STYLE = /* css */ `
  #fontDialog { display: flex; flex-direction: column; gap: .4em; }
  #fontDialog input { width: 100%; box-sizing: border-box; }
  #fontDialog .choices { display: flex; flex-direction: column; gap: 0.3em; width: auto; max-height: 40vh; overflow-y: auto; }
  #fontDialog button { flex: none; padding: .3em .5em; border: 1px solid transparent; border-radius: 0; text-align: left; white-space: nowrap; overflow: hidden; }
  #fontDialog button:hover { border-color: var(--dark-solid); }
  #fontDialog button.pressed { border: 1px solid var(--dark-solid); }
  #fontDialog button .sample { display: block; font-size: 1.5em; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; }
  #fontDialog button .family { display: block; font-size: 0.9em; line-height: 1em; opacity: .7; }
`;

type Options = {
  selected: string;
  sample: string; // what the labels say, drawn in each family
  onPick: (family: string) => void;
  onAdd: (refresh: (family: string) => void) => void; // opens the add-font flow; the callback lists the new family
};

function choices(sample: string, selected: string): string {
  const families = [...new Set(fonts.map(({ family }) => family))];
  if (selected && !families.includes(selected)) families.push(selected);
  return families
    .map(
      family => /* html */ `
        <button type="button" data-family="${escapeHtml(family)}" class="${family === selected ? "pressed" : ""}">
          <span class="sample" style="font-family: '${escapeHtml(family)}'">${escapeHtml(sample)}</span>
          <span class="family">${escapeHtml(family)}</span>
        </button>`
    )
    .join("");
}

export function openFontDialog({ selected, sample, onPick, onAdd }: Options): void {
  destroyDialog(FONT_DIALOG);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${FONT_DIALOG}" class="dialog">
      <style>${STYLE}</style>
      <input type="text" placeholder="Search fonts" />
      <div class="choices">${choices(sample, selected)}</div>
    </div>`
  );
  const dialog = ensureEl(FONT_DIALOG);

  const search = dialog.querySelector("input")!;
  const list = dialog.querySelector<HTMLElement>(".choices")!;

  const filter = () => {
    const query = search.value.trim().toLowerCase();
    for (const button of list.querySelectorAll<HTMLElement>("button[data-family]")) {
      button.hidden = !button.dataset.family!.toLowerCase().includes(query);
    }
  };
  search.addEventListener("input", filter);

  const select = (family: string) => {
    for (const pressed of list.querySelectorAll(".pressed")) pressed.classList.remove("pressed");
    list.querySelector(`button[data-family="${CSS.escape(family)}"]`)?.classList.add("pressed");
    onPick(family);
  };
  list.addEventListener("click", event => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-family]");
    if (button) select(button.dataset.family!);
  });

  $(dialog).dialog({
    title: "Select font",
    width: "24em",
    position: { my: "center", at: "center", of: "svg" },
    close: () => destroyDialog(FONT_DIALOG),
    buttons: {
      "Add font": () =>
        onAdd(family => {
          list.innerHTML = choices(sample, family);
          filter();
          select(family);
        }),
      Close: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
  list.querySelector(".pressed")?.scrollIntoView({ block: "center" });
}
