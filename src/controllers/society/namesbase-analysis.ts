import { max, mean, median, min } from "d3";
import { Corpora } from "@/model/society/names/corpora";
import { Dialog } from "@/ui/dialog/dialog";
import { unique } from "@/utils/array-utils";
import { t } from "@/utils/i18n";
import { rn } from "@/utils/number-utils";
import { escapeHtml } from "@/utils/string-utils";

const GOOD = "green";
const FAIR = "#b36b00";
const BAD = "#b20000";

interface Verdict {
  label: string;
  color: string;
  tip: string;
}

/** Whether a list is long enough to generate names like its own */
function judgeLength(length: number): Verdict {
  if (length < 30)
    return {
      label: t("not enough"),
      color: BAD,
      tip: t("Namesbase contains < 30 names - not enough to generate reasonable data")
    };
  if (length < 100)
    return {
      label: t("low"),
      color: FAIR,
      tip: t("Namesbase contains < 100 names - not enough to generate good names")
    };
  if (length <= 400)
    return { label: t("good"), color: GOOD, tip: t("Namesbase contains a reasonable number of samples") };
  return {
    label: t("overmuch"),
    color: FAIR,
    tip: t("Namesbase contains > 400 names. That is too much, try to reduce it to ~300 names")
  };
}

function judgeVariety(variety: number): Verdict {
  if (variety < 15)
    return {
      label: t("low"),
      color: BAD,
      tip: t("Namesbase average variety < 15 - generated names will be too repetitive")
    };
  if (variety < 30)
    return {
      label: t("mean"),
      color: FAIR,
      tip: t("Namesbase average variety < 30 - names can be too repetitive")
    };
  return { label: t("good"), color: GOOD, tip: t("Namesbase variety is good") };
}

/** Tell how fit a list of names is to generate others like them */
function open(title: string, source: readonly string[]): void {
  const names = source.map(name => name.toLowerCase());
  const lengths = names.map(({ length }) => length);
  const variety = rn(mean(Object.values(Corpora.chainOf(names)), next => next.length) ?? 0);
  const listed = (items: string[], separator = ", ") => escapeHtml(items.join(separator)) || t("none");

  const letters = unique(names.join("").match(/[\u0080-￿]/gu) ?? []);
  const doubles = names.flatMap(name => name.match(/[^\w\s]|(.)(?=\1)/g) ?? []);
  const doubled = unique(doubles).filter(letter => doubles.filter(other => other === letter).length > 3);
  const duplicates = unique(names.filter((name, i) => names.indexOf(name) !== i));
  const endings = Corpora.mineEndings(names).slice(0, 10);
  const multiword = (mean(names, name => +name.includes(" ")) ?? 0) * 100;
  const verdict = ({ label, color, tip }: Verdict) =>
    `<span data-tip="${tip}" style="color: ${color}">(${label})</span>`;

  const rows = [
    [t("Namesbase length"), `${names.length} ${verdict(judgeLength(names.length))}`, ""],
    [
      t("Namesbase variety"),
      `${variety} ${verdict(judgeVariety(variety))}`,
      t("Average number of generation variants for each key in the chain")
    ],
    [t("Length"), `${min(lengths)}–${max(lengths)}`, ""],
    [t("Mean name length"), rn(mean(lengths) ?? 0, 1), ""],
    [t("Median name length"), median(lengths) ?? 0, ""],
    [t("Multi-word names"), `${rn(multiword, 1)}%`, ""],
    [t("Non-basic chars"), listed(letters, ""), t("Characters outside of Basic Latin have bad font support")],
    [t("Doubled chars"), listed(doubled, ""), t("Characters that are frequently (more than 3 times) doubled")],
    [t("Duplicates"), listed(duplicates), ""],
    [t("Common endings"), listed(endings.map(ending => `-${ending}`)), ""]
  ].map(([label, value, tip]) => `<div data-tip="${tip}">${label}:</div><div data-tip="${tip}">${value}</div>`);

  Dialog.message({
    id: "namesbaseAnalysis",
    title,
    message: `<div style="display: grid; grid-template-columns: auto 1fr; gap: 0.3em 1em; max-width: 26em">${rows.join("")}</div>`,
    width: "auto"
  });
}

export const NamesbaseAnalysis = { open, judgeLength };
