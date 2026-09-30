import { MapEntities } from "@/components/map-entities";
import { Controllers } from "@/controllers";
import type { MapTool } from "@/services/assistant/answerer";
import type { ChartRow, Chat, Choice, Widget } from "@/services/assistant/chats";
import type { ToolDefinition, ToolInput } from "@/services/assistant/providers";
import { runScript } from "@/services/assistant/runtime";
import type { Emblem } from "@/types/emblems";
import { rn } from "@/utils/numberUtils";
import {
  convertTemperature,
  formatSpeed,
  getArea,
  getAreaUnit,
  getCellPopulation,
  getDistanceUnit,
  getHeight,
  getPeople,
  getPrecipitation,
  si
} from "@/utils/unitUtils";
import { Proposals } from "./assistant-proposals";
import type { Note } from "./notes-editor";

// The open map as the Assistant sees it: identity, per-question context and tools

type Outcome = Awaited<ReturnType<MapTool["handle"]>>;

interface Tool {
  definition: ToolDefinition;
  status: string;
  handle(input: ToolInput): Promise<Outcome>;
}

const NOTE_CONTEXT_CHARS = 4000;
const MAX_WIDGET_ENTITIES = 50;
const MAX_CHART_ROWS = 30;
const CHANGED_MAP: Outcome = { content: "The map changed during this answer", isError: true };

function id(): number {
  return typeof mapHistory === "undefined" ? 0 : (mapHistory.at(-1)?.created ?? 0);
}

function name(): string {
  return typeof options === "undefined" ? "Unnamed map" : options.map.lore.name || "Unnamed map";
}

async function context(chat: Chat): Promise<string> {
  if (typeof pack === "undefined" || !pack.cells) return "# Current map\n\nNo map is loaded yet.";
  const live = (items?: { i: number; removed?: boolean }[]) =>
    items?.filter(item => item.i && !item.removed).length ?? 0;
  const { distance, height, temperature } = options.map.units;
  const facts = [
    `name: ${name()}`,
    `seed: ${options.map.seed}`,
    `size: ${rn(options.map.graph.width * distance.scale)} × ${rn(options.map.graph.height * distance.scale)} ${distance.unit}`,
    `units: 1 map unit = ${distance.scale} ${distance.unit}; 1 map unit² = ${rn(getArea(1), 4)} ${getAreaUnit()}; elevation in ${height.unit}; temperature in ${temperature.unit}`,
    `cells: ${pack.cells.i.length}`,
    `states: ${live(pack.states)}`,
    `burgs: ${live(pack.burgs)}`,
    `provinces: ${live(pack.provinces)}`,
    `cultures: ${live(pack.cultures)}`,
    `religions: ${live(pack.religions)}`,
    `rivers: ${pack.rivers?.length ?? 0}`,
    `markers: ${pack.markers?.length ?? 0}`
  ];
  const sections = [
    `# Current map\n\n${facts.map(fact => `- ${fact}`).join("\n")}`,
    await noteContext(),
    outcomes(chat)
  ];
  return sections.filter(Boolean).join("\n\n");
}

/** What the user did with this chat's proposals; the map above already reflects the applied ones */
function outcomes(chat: Chat): string | null {
  const proposals = chat.items.flatMap(item => (item.kind === "proposal" ? [item.proposal] : [])).slice(-20);
  if (!proposals.length) return null;
  const state = {
    proposed: "waiting for the user",
    applied: "applied",
    undone: "applied, then undone",
    discarded: "discarded"
  };
  const lines = proposals.map(({ number, summary, state: now }) => `- #${number} ${state[now]}: ${summary}`);
  return `# Proposals in this chat\n\n${lines.join("\n")}`;
}

async function noteContext(): Promise<string | null> {
  const note = await Controllers.NotesEditor.current();
  if (!note) return null;
  const selection = await Controllers.NotesEditor.getSelectionHtml();
  const lines = [
    "# Notes editor",
    "",
    `The notes editor is open on note \`${note.id}\` ("${note.name}"). To rewrite it, propose \`Notes.write\` with the key \`${note.id}\`.`,
    "",
    "Current note HTML:",
    "```html",
    clipNote(note),
    "```"
  ];
  if (selection) lines.push("", "The user has this part selected:", "```html", selection, "```");
  return lines.join("\n");
}

function clipNote(note: Note): string {
  if (!note.legend) return "(empty)";
  if (note.legend.length <= NOTE_CONTEXT_CHARS) return note.legend;
  const rest = note.legend.length - NOTE_CONTEXT_CHARS;
  return `${note.legend.slice(0, NOTE_CONTEXT_CHARS)}\n… ${rest} more characters — read the entity's .note field with read_map for the rest (entity key: ${note.id})`;
}

// The app's own formatters, so answers read like the rest of the UI
const UNITS = {
  si,
  rn,
  getArea,
  getAreaUnit,
  getDistanceUnit,
  getHeight,
  convertTemperature,
  getPrecipitation,
  formatSpeed,
  getCellPopulation,
  getPeople
};

const readMap: Tool = {
  status: "Reading the map",
  definition: {
    name: "read_map",
    description:
      "Run read-only JavaScript in the page. Return the result; describe(value) inspects a value. Scripts may call downloadFile for CSV or JSON.",
    input_schema: { type: "object", properties: { code: { type: "string" } }, required: ["code"] }
  },
  async handle(input) {
    const code = typeof input.code === "string" ? input.code : "";
    const result = await runScript(code, { units: UNITS });
    return {
      content: result.ok ? `${result.value}\n${result.logs.join("\n")}` : result.error?.message || "Script failed",
      item: { kind: "step", code, result },
      isError: !result.ok
    };
  }
};

const OPERATIONS_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      op: { type: "string" },
      args: {
        type: "array",
        items: { description: "A number, string, boolean or array, or { result: n }: what operation n returned" }
      }
    },
    required: ["op", "args"]
  }
};

function proposeChange(chat: Chat): Tool {
  return {
    status: "Preparing a change",
    definition: {
      name: "propose_change",
      description:
        "Propose one batch of registered operations. It never changes the map: the user previews the batch and applies or discards it.",
      input_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          operations: OPERATIONS_SCHEMA
        },
        required: ["summary", "operations"]
      }
    },
    async handle(input) {
      const number = chat.items.filter(item => item.kind === "proposal").length + 1;
      const summary = typeof input.summary === "string" && input.summary.trim() ? input.summary.trim() : "Change";
      const proposal = Proposals.propose(summary, input.operations, number, id());
      if (typeof proposal === "string") return { content: proposal, isError: true };
      const count = proposal.change.length;
      return {
        content: `Proposal #${number} (${count} change${count === 1 ? "" : "s"}) is waiting for the user to apply or discard it. Nothing has changed yet.`,
        item: { kind: "proposal", proposal }
      };
    }
  };
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isLive = (key: unknown) => {
  const ref = typeof key === "string" ? MapEntities.parseKey(key) : undefined;
  return Boolean(ref && MapEntities.get(ref));
};
const missing = (key: unknown) => `No entity ${key} on this map. Keys are type:id, e.g. burg:12`;

/** The widget the input describes, or the first problem for the model to fix */
function parseWidget(input: ToolInput): Widget | string {
  const title = text(input.title);
  if (input.widget === "entities") {
    const entities = Array.isArray(input.entities) ? input.entities.map(String) : [];
    if (!entities.length || entities.length > MAX_WIDGET_ENTITIES)
      return `entities takes 1 to ${MAX_WIDGET_ENTITIES} keys`;
    const invalid = entities.find(key => !isLive(key));
    return invalid ? missing(invalid) : { type: "entities", title: title || "Entities", entities };
  }
  if (input.widget === "card") {
    const entity = text(input.entity);
    if (!isLive(entity)) return missing(entity);
    return entity.startsWith("state:") ? { type: "card", entity } : "Cards show states for now";
  }
  if (input.widget === "chart") {
    if (input.chart !== "bar" && input.chart !== "pie") return "chart is bar or pie";
    const rows = Array.isArray(input.rows) ? input.rows : [];
    if (!rows.length || rows.length > MAX_CHART_ROWS) return `rows takes 1 to ${MAX_CHART_ROWS} items`;
    const parsed: ChartRow[] = [];
    for (const row of rows) {
      const { label, value, entity } = (row ?? {}) as Record<string, unknown>;
      if (!text(label) || typeof value !== "number" || !Number.isFinite(value) || value < 0)
        return `Each row needs a label and a non-negative number value, got ${JSON.stringify(row)}`;
      if (entity !== undefined && !isLive(entity)) return missing(entity);
      parsed.push(
        entity === undefined ? { label: text(label), value } : { label: text(label), value, entity: String(entity) }
      );
    }
    if (input.chart === "pie" && !parsed.some(row => row.value > 0))
      return "A pie needs amounts that add up to more than 0";
    const unit = text(input.unit);
    return { type: "chart", chart: input.chart, title: title || "Chart", ...(unit && { unit }), rows: parsed };
  }
  if (input.widget === "choices") {
    const choices = Array.isArray(input.choices) ? input.choices : [];
    if (choices.length < 2 || choices.length > 4) return "choices takes 2 to 4 options";
    const parsed: Choice[] = [];
    for (const [index, choice] of choices.entries()) {
      const { label, operations } = (choice ?? {}) as Record<string, unknown>;
      if (!text(label)) return `Choice ${index + 1} needs a label`;
      if (operations === undefined) {
        parsed.push({ label: text(label) });
        continue;
      }
      const proposal = Proposals.propose(text(label), operations, 0, id()); // a dry run: validates, changes nothing
      if (typeof proposal === "string") return `Choice ${index + 1}: ${proposal}`;
      parsed.push({ label: text(label), operations: proposal.operations });
    }
    return { type: "choices", title: title || "Choose one", choices: parsed };
  }
  if (input.widget === "inset") {
    if (input.entity !== undefined) {
      const entity = text(input.entity);
      const ref = MapEntities.parseKey(entity);
      if (!ref || !MapEntities.get(ref)) return missing(entity);
      if (!MapEntities.getPoints(ref).length) return `${entity} has no place on the map`;
      return { type: "inset", title: title || MapEntities.getName(ref), entity };
    }
    const box = Array.isArray(input.box) ? input.box : [];
    const { width, height } = options.map.graph;
    const [x0, y0, x1, y1] = box;
    if (
      box.length !== 4 ||
      !box.every(Number.isFinite) ||
      x1 <= x0 ||
      y1 <= y0 ||
      x1 < 0 ||
      y1 < 0 ||
      x0 > width ||
      y0 > height
    )
      return `An inset takes an entity key or a box [x0, y0, x1, y1] in map units within ${width} × ${height}`;
    return { type: "inset", title: title || "Map", box: [x0, y0, x1, y1] };
  }
  return `Unknown widget ${JSON.stringify(input.widget)}. Available: entities, card, chart, choices, inset`;
}

// One tool per widget: a focused schema and a "use it when" description are what get widgets picked
// The emblem widget has no tool of its own: view_emblem places it
const WIDGET_TOOLS: Partial<Record<Widget["type"], Omit<ToolDefinition, "name">>> = {
  entities: {
    description:
      "Show several map entities as a list the user can locate and ring on the map. Use it instead of a Markdown list whenever an answer names 3 or more entities (which, list, find, where are…).",
    input_schema: {
      type: "object",
      properties: { title: { type: "string" }, entities: { type: "array", items: { type: "string" } } },
      required: ["title", "entities"]
    }
  },
  card: {
    description:
      "Show a state's profile card: emblem, full name and form, capital, population, area, burgs, culture, religion and the start of its note. Use it whenever one state is the subject (tell me about, describe, overview, who rules), then add only what the card does not say.",
    input_schema: { type: "object", properties: { entity: { type: "string" } }, required: ["entity"] }
  },
  chart: {
    description:
      "Show numbers you computed with read_map as a chart. bar: one measure compared or ranked across items (largest states, burgs by population, top religions). pie: parts of one whole (population by culture, land by biome), given as amounts, not percentages: the chart computes shares. unit names the amounts (people, mi²). Prefer it to a table when each item has one number.",
    input_schema: {
      type: "object",
      properties: {
        chart: { type: "string", enum: ["bar", "pie"] },
        title: { type: "string" },
        unit: { type: "string" },
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: { label: { type: "string" }, value: { type: "number" }, entity: { type: "string" } },
            required: ["label", "value"]
          }
        }
      },
      required: ["chart", "title", "rows"]
    }
  },
  choices: {
    description:
      "Offer 2-4 alternatives for the user to pick: name ideas, options, directions. Give a choice operations (as in propose_change) when picking it should change the map, such as one rename per name idea; otherwise its label becomes the user's next question. Use it instead of listing suggestions, then stop and wait.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        choices: {
          type: "array",
          items: {
            type: "object",
            properties: { label: { type: "string" }, operations: OPERATIONS_SCHEMA },
            required: ["label"]
          }
        }
      },
      required: ["title", "choices"]
    }
  },
  inset: {
    description:
      "Show a picture of part of the map around an entity key, or a box [x0, y0, x1, y1] in map units; clicking it zooms the map there. Use it when an answer is about where something is or what a place is like.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        entity: { type: "string" },
        box: { type: "array", items: { type: "number" } }
      }
    }
  }
};

function showTool(type: Widget["type"], definition: Omit<ToolDefinition, "name">): Tool {
  return {
    definition: { name: `show_${type}`, ...definition },
    status: "Preparing a widget",
    async handle(input) {
      const widget = parseWidget({ ...input, widget: type });
      if (typeof widget === "string") return { content: widget, isError: true };
      const content =
        widget.type === "choices"
          ? "The choices are waiting for the user. Stop here: their pick arrives as a proposal or as their next question."
          : `Shown the ${widget.type} widget to the user`;
      return { content, item: { kind: "widget", widget } };
    }
  };
}

const showTools = Object.entries(WIDGET_TOOLS).flatMap(([type, definition]) =>
  definition ? [showTool(type as Widget["type"], definition)] : []
);

const EMBLEM_TYPES = ["state", "province", "burg"];
const EMBLEM_SIZE = 256;

const viewEmblem: Tool = {
  status: "Looking at the emblem",
  definition: {
    name: "view_emblem",
    description:
      "See the emblem (coat of arms) of a state, province or burg as an image, to describe it or match lore to it. The user sees it too.",
    input_schema: { type: "object", properties: { entity: { type: "string" } }, required: ["entity"] }
  },
  async handle(input) {
    const key = text(input.entity);
    const ref = MapEntities.parseKey(key);
    if (!ref || !EMBLEM_TYPES.includes(ref.type))
      return { content: "Emblems belong to states, provinces and burgs", isError: true };
    const coa = (MapEntities.get(ref) as { coa?: Emblem } | undefined)?.coa;
    if (!MapEntities.get(ref)) return { content: missing(key), isError: true };
    if (!coa) return { content: `${key} has no emblem`, isError: true };
    const { emblemPng } = await import("@/services/io/emblem-image");
    const png = await emblemPng(`${ref.type}COA${ref.id}`, coa, EMBLEM_SIZE);
    return {
      content: [
        { type: "text", text: `The emblem of ${MapEntities.getName(ref)}` },
        { type: "image", source: { type: "base64", media_type: "image/png", data: png.slice(png.indexOf(",") + 1) } }
      ],
      item: { kind: "widget", widget: { type: "emblem", entity: key } }
    };
  }
};

/** Tools bound to the map open now: once another map loads they refuse to run */
function tools(chat: Chat): MapTool[] {
  const bound = id();
  return [readMap, proposeChange(chat), ...showTools, viewEmblem].map(tool => ({
    definition: tool.definition,
    status: tool.status,
    handle: async input => (bound !== id() ? CHANGED_MAP : tool.handle(input))
  }));
}

export const AssistantMap = { id, name, context, tools };
