// What a nation is told at the start of its turn: its realm, its forces, the powers it knows of, and what happened
// since its last orders. Built from plain data so it stays testable without a map on screen.

import { type Game, type Letter, REFEREE, type TurnRecord } from "./game";

export interface BriefRegiment {
  i: number;
  name: string;
  a: number; // total troops
  n: number; // naval flag
  x: number;
  y: number;
  u: Record<string, number>;
}

export interface BriefState {
  i: number;
  name: string;
  fullName?: string;
  form?: string;
  removed?: boolean;
  capital?: number;
  culture?: number;
  area?: number;
  burgs?: number;
  rural?: number;
  urban?: number;
  neighbors?: number[];
  provinces?: number[];
  diplomacy?: string[];
  military?: BriefRegiment[];
  alert?: number;
  salesTax?: number;
  pollTax?: number;
  treasury?: number;
}

export interface BriefBurg {
  i: number;
  name?: string;
  state?: number;
  x: number;
  y: number;
  population?: number;
  capital?: number;
  port?: number;
  removed?: boolean;
}

/** The map as a briefing reads it, with the app's own formatters */
export interface World {
  states: BriefState[];
  burgs: (BriefBurg | number)[];
  provinces: ({ i: number; name: string; removed?: boolean } | number)[];
  cultures: { i: number; name: string }[];
  chronicle: string[][];
  year: number;
  era: string;
  /** The state owning the land at a point: 0 for none, undefined off the map */
  stateAt(x: number, y: number): number | undefined;
  people(rural: number, urban: number): number;
  area(raw: number): string;
  money(amount: number): string;
}

const TOP_BURGS = 8;
const CHRONICLE_ENTRIES = 5;
const LOG_TURNS = 3;

const count = (value: number): string => Math.round(value).toLocaleString("en-US");
const percent = (rate = 0): string => `${Math.round(rate * 100)}%`;
const alive = (state: BriefState | undefined): state is BriefState => Boolean(state?.i && !state.removed);
const troops = (state: BriefState): number => (state.military ?? []).reduce((sum, regiment) => sum + regiment.a, 0);
const label = (state: BriefState): string => `${state.fullName || state.name} (state:${state.i})`;

/** Other states' strength is an estimate: two significant digits */
function rough(value: number): string {
  if (value < 100) return count(value);
  const magnitude = 10 ** (Math.floor(Math.log10(value)) - 1);
  return `about ${count(Math.round(value / magnitude) * magnitude)}`;
}

/** How this state stands towards another, with the one-sided relations spelled out */
function relation(own: BriefState, other: BriefState): string {
  const value = own.diplomacy?.[other.i] ?? "Unknown";
  if (value === "Enemy") return "at war";
  if (value === "Vassal") return "you are their vassal";
  if (value === "Suzerain") return "they are your vassal";
  if (value === "Unknown") return "no relations";
  return value.toLowerCase();
}

/** A state whose details the nation may read */
export function isKnown(own: BriefState, other: BriefState, fog: Game["settings"]["fog"]): boolean {
  if (fog === "full") return true;
  return Boolean(own.neighbors?.includes(other.i)) || (own.diplomacy?.[other.i] ?? "Unknown") !== "Unknown";
}

export function buildBriefing(game: Game, stateId: number, world: World): string {
  const own = world.states[stateId];
  if (!alive(own)) throw new Error(`State ${stateId} is not on this map`);
  const nation = game.nations.find(item => item.state === stateId);
  const burgs = world.burgs.filter((burg): burg is BriefBurg => typeof burg === "object" && !burg.removed);
  const others = world.states.filter(state => alive(state) && state.i !== stateId);
  const name = (id: number): string => (id === REFEREE ? "The referee" : (world.states[id]?.name ?? `state:${id}`));

  const sections = [
    `# Turn ${game.current.turn} · ${world.year} ${world.era}`.trim(),
    `Each turn covers ${game.settings.turnLength || "one season"}. You rule **${label(own)}**.`,
    nation?.persona.trim() && `## Who you are\n\n${nation.persona.trim()}`,
    game.settings.rules.trim() && `## House rules\n\n${game.settings.rules.trim()}`,
    realm(own, burgs, world),
    forces(own, burgs, world),
    intruders(own, others, burgs, world),
    powers(own, others, game.settings.fog, world),
    chronicle(world.chronicle),
    sinceLastTurn(game, stateId, name),
    log(game.history.slice(0, -1).slice(-LOG_TURNS), stateId),
    `## Your private notes\n\n${nation?.notes.trim() || "(none yet)"}`
  ];
  return sections.filter(Boolean).join("\n\n");
}

function nearest(x: number, y: number, burgs: BriefBurg[]): BriefBurg | undefined {
  let best: BriefBurg | undefined;
  let bestDistance = Infinity;
  for (const burg of burgs) {
    const distance = (burg.x - x) ** 2 + (burg.y - y) ** 2;
    if (distance < bestDistance) [best, bestDistance] = [burg, distance];
  }
  return best;
}

function realm(own: BriefState, burgs: BriefBurg[], world: World): string {
  const mine = burgs.filter(burg => burg.state === own.i).sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  const capital = mine.find(burg => burg.capital);
  const provinces = (own.provinces ?? [])
    .map(id => world.provinces[id])
    .filter((province): province is { i: number; name: string } => typeof province === "object" && !province.removed)
    .map(province => province.name);
  const culture = world.cultures.find(item => item.i === own.culture)?.name;
  const { rural = 0, urban = 0 } = own;
  const towns = mine.slice(0, TOP_BURGS).map(burg => {
    const tags = [burg.capital ? "capital" : "", burg.port ? "port" : ""].filter(Boolean).join(", ");
    return `${burg.name} (${count(world.people(0, burg.population ?? 0))}${tags ? `, ${tags}` : ""})`;
  });
  const lines = [
    `Government: ${own.form ?? "unknown"}${culture ? `; culture: ${culture}` : ""}${capital ? `; capital: ${capital.name}` : ""}`,
    `Population: ${count(world.people(rural, urban))} (${count(world.people(rural, 0))} rural, ${count(world.people(0, urban))} urban)`,
    `Land: ${world.area(own.area ?? 0)}, ${mine.length} burgs, ${mine.filter(burg => burg.port).length} ports`,
    `Treasury: ${world.money(own.treasury ?? 0)}; sales tax ${percent(own.salesTax)}, poll tax ${own.pollTax ?? 0} per head`,
    provinces.length ? `Provinces: ${provinces.join(", ")}` : "",
    towns.length ? `Largest burgs: ${towns.join("; ")}` : ""
  ];
  return `## Your realm\n\n${lines
    .filter(Boolean)
    .map(line => `- ${line}`)
    .join("\n")}`;
}

function regimentLine(regiment: BriefRegiment, viewer: number, burgs: BriefBurg[], world: World): string {
  const units = Object.entries(regiment.u)
    .filter(([, amount]) => amount > 0)
    .map(([unit, amount]) => `${count(amount)} ${unit}`)
    .join(", ");
  const owner = world.stateAt(regiment.x, regiment.y);
  const land =
    owner === viewer
      ? "in your territory"
      : owner
        ? `in the territory of ${world.states[owner]?.name ?? "another state"}`
        : "outside any state's borders";
  const burg = nearest(regiment.x, regiment.y, burgs);
  const kind = regiment.n ? "fleet" : "regiment";
  const size = regiment.n ? `${count(regiment.a)} ships` : `${count(regiment.a)} troops${units ? ` (${units})` : ""}`;
  return `${regiment.name} (${kind} #${regiment.i}): ${size}, ${burg ? `near ${burg.name}, ` : ""}${land}`;
}

function forces(own: BriefState, burgs: BriefBurg[], world: World): string {
  const regiments = own.military ?? [];
  const lines = regiments.map(regiment => `- ${regimentLine(regiment, own.i, burgs, world)}`);
  const total = `${count(troops(own))} troops in ${regiments.length} units`;
  return `## Your forces\n\n${regiments.length ? `${total}.\n\n${lines.join("\n")}` : "You have no standing forces."}`;
}

function intruders(own: BriefState, others: BriefState[], burgs: BriefBurg[], world: World): string {
  const lines = others.flatMap(state =>
    (state.military ?? [])
      .filter(regiment => world.stateAt(regiment.x, regiment.y) === own.i)
      .map(regiment => {
        const burg = nearest(regiment.x, regiment.y, burgs);
        return `- ${state.name}: ${regiment.name}, ${rough(regiment.a)} troops${burg ? `, near ${burg.name}` : ""}`;
      })
  );
  return lines.length ? `## Foreign forces on your soil\n\n${lines.join("\n")}` : "";
}

function powers(own: BriefState, others: BriefState[], fog: Game["settings"]["fog"], world: World): string {
  const known = others.filter(state => isKnown(own, state, fog));
  const distant = others.filter(state => !known.includes(state));
  const lines = known.map(state => {
    const facts = [
      relation(own, state),
      own.neighbors?.includes(state.i) ? "borders you" : "",
      state.form ?? "",
      `${rough(world.people(state.rural ?? 0, state.urban ?? 0))} people`,
      `${rough(troops(state))} troops`
    ];
    return `- ${label(state)}: ${facts.filter(Boolean).join("; ")}`;
  });
  const far = distant.length
    ? `\n\nLands you know only by name: ${distant.map(state => `${state.name} (state:${state.i})`).join(", ")}.`
    : "";
  return `## Other powers\n\n${lines.join("\n") || "You know of no other states."}${far}`;
}

function chronicle(entries: string[][]): string {
  const recent = entries.slice(-CHRONICLE_ENTRIES).map(lines => `- ${lines.filter(Boolean).join(" — ")}`);
  return recent.length ? `## Recent chronicle of the world\n\n${recent.join("\n")}` : "";
}

function sinceLastTurn(game: Game, stateId: number, name: (id: number) => string): string {
  const previous = game.history.at(-1);
  const mine = previous?.submissions.find(item => item.state === stateId);
  const rulings = (mine?.orders ?? []).map(order => {
    const verdict = order.ruling === "pending" ? "no ruling: assume it did not happen" : order.ruling;
    return `- [${verdict}] ${order.title}${order.outcome.trim() ? ` — ${order.outcome.trim()}` : ""}`;
  });
  const proclamations = (previous?.submissions ?? [])
    .filter(item => item.state !== stateId && item.statement.trim())
    .map(item => `- ${name(item.state)}: ${item.statement.trim()}`);
  const received: Letter[] = [
    ...(previous?.submissions ?? []).flatMap(item => item.letters),
    ...game.current.letters
  ].filter(letter => letter.to === stateId && letter.delivered);
  const letters = received.map(letter => `- From ${name(letter.from)}: ${letter.text.trim()}`);

  const parts = [
    game.current.news.trim() && `### News of the world\n\n${game.current.news.trim()}`,
    rulings.length ? `### What became of your orders\n\n${rulings.join("\n")}` : "",
    proclamations.length ? `### Proclamations of other rulers\n\n${proclamations.join("\n")}` : "",
    letters.length ? `### Letters you received\n\n${letters.join("\n")}` : ""
  ].filter(Boolean);
  const opening = previous ? "" : "This is the first turn: nothing has happened yet.";
  return `## Since your last orders\n\n${[opening, ...parts].filter(Boolean).join("\n\n") || "Nothing to report."}`;
}

function log(turns: TurnRecord[], stateId: number): string {
  const lines = turns.flatMap(turn =>
    (turn.submissions.find(item => item.state === stateId)?.orders ?? []).map(
      order => `- Turn ${turn.turn}: [${order.ruling}] ${order.title}`
    )
  );
  return lines.length ? `## Your earlier orders\n\n${lines.join("\n")}` : "";
}
