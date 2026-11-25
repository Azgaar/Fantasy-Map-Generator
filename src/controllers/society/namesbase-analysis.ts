import { max, mean, median, min } from "d3";
import { Lexicon } from "@/model/society/names/lexicon";
import { Names } from "@/model/society/names/names-generator";
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
      tip: t("Too few names, less than 30")
    };
  if (length < 100)
    return {
      label: t("low"),
      color: FAIR,
      tip: t("Few names, less than 100")
    };
  if (length <= 400) return { label: t("good"), color: GOOD, tip: t("Enough names") };
  return {
    label: t("overmuch"),
    color: FAIR,
    tip: t("Too many names, more than 400")
  };
}

function judgeVariety(variety: number): Verdict {
  if (variety < 15)
    return {
      label: t("low"),
      color: BAD,
      tip: t("Names will be too repetitive")
    };
  if (variety < 30)
    return {
      label: t("mean"),
      color: FAIR,
      tip: t("Names can be repetitive")
    };
  return { label: t("good"), color: GOOD, tip: t("Names will be varied") };
}

/** Tell how fit a list of names is to generate others like them */
function open(title: string, source: string[]): void {
  const names = source.map(name => name.toLowerCase());
  const lengths = names.map(({ length }) => length);
  const variety = rn(mean(Object.values(Names.calculateChain(names)), next => next.length) ?? 0);
  const listed = (items: string[], separator = ", ") => escapeHtml(items.join(separator)) || t("none");

  const letters = unique(names.join("").match(/[\u0080-￿]/gu) ?? []);
  const doubles = names.flatMap(name => name.match(/[^\w\s]|(.)(?=\1)/g) ?? []);
  const doubled = unique(doubles).filter(letter => doubles.filter(other => other === letter).length > 3);
  const duplicates = unique(names.filter((name, i) => names.indexOf(name) !== i));
  const endings = Lexicon.mineEndings(names).slice(0, 10);
  const multiword = (mean(names, name => +name.includes(" ")) ?? 0) * 100;
  const verdict = ({ label, color, tip }: Verdict) =>
    `<span data-tip="${tip}" style="color: ${color}">(${label})</span>`;

  const rows = [
    [t("Names"), `${names.length} ${verdict(judgeLength(names.length))}`, ""],
    [t("Variety"), `${variety} ${verdict(judgeVariety(variety))}`, t("Average number of ways a name may go on")],
    [t("Length"), `${min(lengths)}–${max(lengths)}`, ""],
    [t("Mean name length"), rn(mean(lengths) ?? 0, 1), ""],
    [t("Median name length"), median(lengths) ?? 0, ""],
    [t("Multi-word names"), `${rn(multiword, 1)}%`, ""],
    [t("Non-basic chars"), listed(letters, ""), t("May lack font support")],
    [t("Doubled chars"), listed(doubled, ""), t("Doubled more than 3 times")],
    [t("Duplicates"), listed(duplicates), ""],
    [t("Common endings"), listed(endings.map(ending => `-${ending}`)), t("Candidates for the Lexicon")]
  ].map(([label, value, tip]) => `<div data-tip="${tip}">${label}:</div><div data-tip="${tip}">${value}</div>`);

  Dialog.message({
    id: "namesbaseAnalysis",
    title,
    message: `<div style="display: grid; grid-template-columns: auto 1fr; gap: 0.3em 1em; max-width: 26em">${rows.join("")}</div>`,
    width: "auto"
  });
}

export const NamesbaseAnalysis = { open, judgeLength };
