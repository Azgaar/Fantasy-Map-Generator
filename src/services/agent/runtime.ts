// Executes model-authored JavaScript against the live map. The script body becomes an async
// function evaluated in page scope, so every global (pack, grid, Burgs, Layers, Controllers…)
// resolves without being injected. Only the returned value and console output travel back.

const MAX_RESULT_CHARS = 8000;
const MAX_ARRAY_ITEMS = 200;
const MAX_LOGS = 50;
const MAX_LOG_CHARS = 500;
const MAX_STACK_LINES = 4;

export interface RunResult {
  ok: boolean;
  value: string;
  logs: string[];
  error?: { message: string; stack: string };
  ms: number;
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

export async function runScript(code: string): Promise<RunResult> {
  const logs: string[] = [];
  const releaseConsole = captureConsole(logs);
  const started = performance.now();

  try {
    const script = new AsyncFunction("describe", code);
    const value = await script(describe);
    return { ok: true, value: serialize(value), logs, ms: elapsed(started) };
  } catch (thrown) {
    const error = thrown instanceof Error ? thrown : new Error(String(thrown));
    const stack = (error.stack ?? "").split("\n").slice(0, MAX_STACK_LINES).join("\n");
    return { ok: false, value: "", logs, error: { message: error.message, stack }, ms: elapsed(started) };
  } finally {
    releaseConsole();
  }
}

const elapsed = (started: number): number => Math.round(performance.now() - started);

// Runtime introspection — the model's way of checking a global's actual shape instead of trusting
// the prompt. Accepts an expression string ("pack.burgs[1]") or a value.
export function describe(target: unknown): unknown {
  if (typeof target === "string") {
    try {
      const resolved = new Function(`return (${target})`)();
      return { path: target, ...inspect(resolved) };
    } catch {
      // not a resolvable expression — fall through and describe the string itself
    }
  }
  return inspect(target);
}

function inspect(value: unknown): Record<string, unknown> {
  if (value === null) return { type: "null" };
  if (value === undefined) return { type: "undefined" };

  if (ArrayBuffer.isView(value)) {
    const typed = value as unknown as {
      constructor: { name: string };
      length: number;
      slice: (a: number, b: number) => ArrayLike<number>;
    };
    return { type: typed.constructor.name, length: typed.length, sample: Array.from(typed.slice(0, 5)) };
  }

  if (Array.isArray(value)) {
    return { type: "Array", length: value.length, sample: value.slice(0, 3).map(summarize) };
  }

  if (typeof value === "function") {
    return { type: "function", name: value.name || "anonymous", arity: value.length };
  }

  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const keys: Record<string, string> = {};
    for (const key of Object.keys(object)) keys[key] = summarize(object[key]);

    const result: Record<string, unknown> = { type: object.constructor?.name ?? "object", keys };
    const methods = prototypeMethods(object);
    if (methods.length) result.methods = methods;
    return result;
  }

  return { type: typeof value, value };
}

function prototypeMethods(object: object): string[] {
  const prototype = Object.getPrototypeOf(object);
  if (!prototype || prototype === Object.prototype) return [];
  return Object.getOwnPropertyNames(prototype).filter(name => name !== "constructor");
}

// One-line type label used for nested values, so describe() stays readable at any depth
function summarize(value: unknown): string {
  if (value === null) return "null";
  if (ArrayBuffer.isView(value)) {
    const typed = value as unknown as { constructor: { name: string }; length: number };
    return `${typed.constructor.name}(${typed.length})`;
  }
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === "string") return `string(${value.length})`;
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    const shown = keys.slice(0, 5).join(", ");
    return `object{${shown}${keys.length > 5 ? ", …" : ""}}`;
  }
  return typeof value;
}

// JSON with the map's awkward values made legible: typed arrays summarized, long arrays clipped,
// cycles broken. Repeated references to one object also read as [Circular] — acceptable here.
export function serialize(value: unknown, limit = MAX_RESULT_CHARS): string {
  if (value === undefined) return "undefined";
  const seen = new WeakSet<object>();

  const replacer = (_key: string, item: unknown): unknown => {
    if (typeof item === "function") return `[Function ${item.name || "anonymous"}]`;
    if (typeof item === "bigint") return String(item);
    if (ArrayBuffer.isView(item)) {
      const typed = item as unknown as {
        constructor: { name: string };
        length: number;
        slice: (a: number, b: number) => ArrayLike<number>;
      };
      const head = Array.from(typed.slice(0, 10)).join(", ");
      return `[${typed.constructor.name}(${typed.length}) ${head}${typed.length > 10 ? ", …" : ""}]`;
    }
    if (item instanceof Set) return { Set: [...item].slice(0, MAX_ARRAY_ITEMS) };
    if (item instanceof Map) return { Map: [...item.entries()].slice(0, MAX_ARRAY_ITEMS) };

    if (item && typeof item === "object") {
      if (typeof (item as { nodeType?: unknown }).nodeType === "number") {
        return `[Node ${(item as { nodeName?: string }).nodeName ?? "?"}]`;
      }
      if (seen.has(item)) return "[Circular]";
      seen.add(item);

      if (Array.isArray(item) && item.length > MAX_ARRAY_ITEMS) {
        return [...item.slice(0, MAX_ARRAY_ITEMS), `… ${item.length - MAX_ARRAY_ITEMS} more items`];
      }
    }

    return item;
  };

  let text: string;
  try {
    text = JSON.stringify(value, replacer, 1) ?? String(value);
  } catch (error) {
    text = `[unserializable: ${error instanceof Error ? error.message : String(error)}]`;
  }

  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n… truncated, ${text.length - limit} more characters. Return less data.`;
}

function captureConsole(logs: string[]): () => void {
  const methods = ["log", "info", "warn", "error"] as const;
  const originals = methods.map(method => console[method]);

  methods.forEach((method, index) => {
    console[method] = (...args: unknown[]): void => {
      if (logs.length < MAX_LOGS) {
        const text = args.map(arg => (typeof arg === "object" ? serialize(arg, MAX_LOG_CHARS) : String(arg))).join(" ");
        logs.push(method === "log" ? text : `[${method}] ${text}`);
      }
      originals[index].apply(console, args);
    };
  });

  return () =>
    methods.forEach((method, index) => {
      console[method] = originals[index];
    });
}
