import { Meanings } from "@/model/society/names/meanings";
import { Names } from "@/model/society/names/names-generator";
import { localGloss } from "@/renderers/labels/name-display";
import type { Meaning } from "@/types/names";
import { Dialog } from "@/ui/dialog/dialog";
import { sentences, t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { escapeHtml } from "@/utils/string-utils";

/** Show what a name means and how every name base renders that meaning; `apply` takes the name the user picks */
function open(meaning: Meaning, apply: (name: string) => void): void {
  Dialog.destroy("nameTranslations");
  const origin = Names.find(meaning.origin)?.name ?? meaning.origin;
  const rows = Names.nameBases.map(base => {
    const name = escapeHtml(Meanings.render(meaning, base.id));
    return /* html */ `<div style="${base.id === meaning.origin ? "font-weight: bold" : ""}">${escapeHtml(base.name)}</div>
      <div>${name}</div>
      <span data-name="${name}" data-tip="${t("Use this name")}" class="icon-check pointer"></span>`;
  });

  const dialogHtml = /* html */ `<div id="nameTranslations" class="dialog stable">
      <div data-tip="${sentences(t("What the name says, apart from any language"), t("The same meaning gives the same name in a name base"))}" style="margin-bottom: 0.5em">
        <b>${escapeHtml(localGloss(meaning))}</b> <i>(${escapeHtml(origin)})</i>
      </div>
      <div style="display: grid; grid-template-columns: auto 1fr auto; gap: 0.25em 1.5em; max-height: 60vh; overflow-y: auto; padding-right: 0.5em">
        ${rows.join("")}
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", dialogHtml);

  ensureEl("nameTranslations").addEventListener("click", event => {
    const name = (event.target as HTMLElement).closest<HTMLElement>("[data-name]")?.dataset.name;
    if (name) apply(name);
  });

  Dialog.open("nameTranslations", {
    title: t("Name in other name bases"),
    position: { my: "center", at: "center", of: "svg" },
    onClose: () => Dialog.destroy("nameTranslations")
  });
}

export const NameTranslations = { open };
