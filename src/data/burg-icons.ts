// The burg and port icons a group may draw: inline <symbol>s in index.html, listed by set
import { escapeHtml } from "@/utils/stringUtils";

export type BurgIcon = { id: string; name: string; group: string; viewBox: string };

const SETS = [
  {
    name: "Atlas",
    prefix: "",
    viewBox: "-28 -28 56 56",
    icons: [
      "circle",
      "square",
      "triangle",
      "cross",
      "star",
      "circled",
      "squared",
      "star-circled",
      "star-circled-empty",
      "star-squared",
      "circle-rayed",
      "circle-dotted",
      "diamond-dotted"
    ]
  },
  {
    name: "Watabou",
    prefix: "watabou-",
    viewBox: "-45 -88 90 100",
    icons: ["capital", "city", "town", "village", "hamlet", "fort", "monastery", "caravanserai", "post"]
  },
  {
    name: "Illustrated",
    prefix: "illustrated-",
    viewBox: "-23 -40 46 43",
    icons: ["palace", "burgh", "castle", "abbey", "caravanserai", "camp"]
  }
];

export const BURG_ICONS: BurgIcon[] = SETS.flatMap(({ name, prefix, viewBox, icons }) =>
  icons.map(icon => ({ id: `#icon-${prefix}${icon}`, name: icon.replaceAll("-", " "), group: name, viewBox }))
);

export const PORT_ICONS: BurgIcon[] = [
  { id: "#icon-anchor", name: "anchor", group: "Ports", viewBox: "-23 -23 46 46" },
  { id: "#icon-harbor", name: "harbor", group: "Ports", viewBox: "-28 -28 56 56" }
];

/** The icon by id, or a stand-in for one the lists do not know (a custom symbol) */
export const burgIcon = (id: string): BurgIcon =>
  [...BURG_ICONS, ...PORT_ICONS].find(icon => icon.id === id) ?? {
    id,
    name: "custom icon",
    group: "",
    viewBox: "-28 -28 56 56"
  };

/** An inline svg drawing the icon; fill and stroke are inherited from the container */
export const burgIconPreview = ({ id, viewBox }: BurgIcon): string =>
  `<svg viewBox="${viewBox}" aria-hidden="true"><use href="${escapeHtml(id)}" font-size="40" stroke-width="1.5"/></svg>`;
