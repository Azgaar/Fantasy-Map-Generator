# Help-first assistant merger — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One "?" assistant dialog that opens on the wiki-grounded Help panel and offers, one click away, the BYOK map assistant with a `write_note` tool that edits notes through the notes editor, model settings behind a gear.

**Architecture:** The upstream help widget (`help-assistant.ts`) becomes a two-panel shell; the AI chat dialog's logic moves into `help-assistant-map.ts` as the second panel; a new `help-assistant-notes.ts` provides the note context text, the `write_note` tool and undo; the agent session gains generic tool dispatch; the notes editor exposes a four-function bridge that is implemented over TinyMCE now and over Quill when the Quill branch merges.

**Tech Stack:** TypeScript, Vite, vitest (jsdom), Playwright (system chromium on NixOS), jQuery UI dialogs, Biome.

**Spec:** `docs/superpowers/specs/2026-09-05-help-assistant-ai-merger-design.md`

## Global Constraints

- Fork-only test build in worktree `.claude/worktrees/help-assistant-ai`, branch `worktree-help-assistant-ai`. Local commits only. **Never push.**
- Commits: explicit `git add <files>` (never `-a`/`add -A`), `git commit --no-verify`, no attribution lines. Any commit touching `public/` or `src/index.html` asset references runs `npm run stamp-assets` first.
- Formatting: Biome (`npx biome check <files>`), double quotes, no trailing commas, 120 columns. Never Prettier.
- Dialog id stays `helpAssistant`, title stays "Azgaar's Assistant". Bubble opens Help; Tools button and notes editor robot button open This map.
- Storage keys unchanged: `fmg-ai-chat-model`, `fmg-ai-kl-<provider>`, `fmg-ai-local-url`, `fmg-ai-local-model`, `fmg-ai-chat-conversations`.
- `run` stays read-only by prompt; the only mutation tool is `write_note`.
- The dev server on port 5173 belongs to the user. Own servers run on 5199. Verify ports with `ss -ltnp`, never `curl`.
- Services (`src/services/agent/*`) import nothing from `src/controllers`.

---

### Task 1: Merge the upstream help-assistant branch

**Files:**
- Merge: `upstream/help-assistant` (26 commits, base 386e0f44 which fork main already contains)
- Conflicts expected: `src/index.html` (two `?v=` hash hunks), `src/utils/markdown.test.ts` (add/add; upstream = fork + one test)

**Interfaces:**
- Produces: `src/controllers/help-assistant.ts` (exports `HelpAssistant = { open }`, `noticeFor`, `shouldAutoRetry`, `limitsLabel`, `normalizeQuestion`, `buildFeedbackControl`), `src/services/help/{api,auth,conversation}.ts`, `Controllers.HelpAssistant` registry entry, `#helpAssistantBubble` in `src/index.html`, `toggleAssistant()` + fragment stash in `public/main.js`, help CSS in `public/index.css`.

- [ ] **Step 1: Confirm the worktree is clean and on the right branch**

Run: `git status --short && git branch --show-current && git log --oneline -1`
Expected: no tracked changes, `worktree-help-assistant-ai`, `b6aa342e docs: design spec…`

- [ ] **Step 2: Merge**

Run: `git merge --no-commit upstream/help-assistant`
Expected: "Automatic merge failed; fix conflicts" naming exactly `src/index.html` and `src/utils/markdown.test.ts`. If any other file conflicts, stop and inspect it block by block — never resolve a whole file with `--theirs`/`--ours`.

- [ ] **Step 3: Resolve `src/utils/markdown.test.ts`**

Both sides are the same renderer's tests; upstream adds one `it("cannot break out of the href attribute…")`. Take upstream's file (it is a superset):

Run: `git checkout upstream/help-assistant -- src/utils/markdown.test.ts`

Then confirm the fork's test names are all still present: `grep -c "^  it(" src/utils/markdown.test.ts` should be one more than `git show cbe08801:src/utils/markdown.test.ts | grep -c "^  it("`.

- [ ] **Step 4: Resolve `src/index.html`**

The two hunks are cache-buster hashes only (`index.css?v=`, `options.js?v=`, `main.js?v=`). Open the file, delete the conflict markers keeping the upstream lines (`07b79718`, `d2008f94`, `b64d6429`), then regenerate them from content so they are right regardless:

Run: `npm run stamp-assets`
Expected: exit 0; `grep -c "<<<<<<<\|>>>>>>>" src/index.html` prints `0`.

- [ ] **Step 5: Type-check and test**

Run: `npx tsc --noEmit && npx vitest run --reporter=dot 2>&1 | tail -5`
Expected: tsc silent; all test files pass (baseline was 92 files / 970 tests; expect more from the help services and controller tests).

- [ ] **Step 6: Smoke the registry wiring**

Run: `grep -n "HelpAssistant" src/controllers/index.ts public/main.js | head` and `grep -n "helpAssistantBubble" src/index.html`
Expected: registry entry present, three `main.js` listeners, the bubble div.

- [ ] **Step 7: Commit the merge**

```bash
git add src/index.html src/utils/markdown.test.ts
git commit --no-verify -m "Merge upstream/help-assistant into the assistant-merger worktree"
```

- [ ] **Step 8: Tick the spec checklist line "upstream/help-assistant merged; unit tests green; tsc clean"** in `docs/superpowers/specs/2026-09-05-help-assistant-ai-merger-design.md` and commit it with `git commit --no-verify -m "docs: tick merge step"`.

---

### Task 2: Generic tool dispatch in the agent session

**Files:**
- Modify: `src/services/agent/providers.ts` (`ToolUseBlock.input` typing)
- Modify: `src/services/agent/session.ts`
- Modify: `src/services/agent/providers-openai.ts` if `parseArguments` returns `{ code?: string }` (widen to `Record<string, unknown>`)
- Test: `src/services/agent/session-tools.test.ts` (new; keeps mocks away from the pure `trimHistory` tests)

**Interfaces:**
- Produces:
  ```ts
  export type ToolInput = Record<string, unknown>;              // providers.ts
  export interface ToolOutcome { content: string; isError?: boolean }  // session.ts
  export interface AgentTool { definition: ToolDefinition; handle: (input: ToolInput) => Promise<ToolOutcome> }
  export interface SessionConfig { key: string; model: string; context?: string }
  export interface SessionHandlers { …existing…; onTool?: (name: string, input: ToolInput) => void }
  export function createSession(getConfig: () => SessionConfig, tools?: AgentTool[]): { ask, cancel }
  ```
- Consumes: `buildSystemPrompt(context?: string)` from Task 3 — until Task 3 lands, `buildSystemPrompt()` ignores the argument; TypeScript accepts the extra argument only after Task 3, so Task 2 calls `buildSystemPrompt()` and Task 3 threads `context` through.

- [ ] **Step 1: Write the failing tests**

Create `src/services/agent/session-tools.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "./conversations";
import type { Completion, Message } from "./providers";

const { complete } = vi.hoisted(() => ({ complete: vi.fn() }));
vi.mock("./providers", () => ({ complete }));
vi.mock("./snapshot", () => ({ capture: () => {} }));
vi.mock("./context", () => ({ buildSystemPrompt: () => [] }));
vi.mock("./runtime", () => ({
  runScript: async (code: string) => ({ ok: true, value: `ran:${code}`, logs: [], ms: 1 })
}));

import { type AgentTool, createSession, type SessionHandlers } from "./session";

const usage = { input: 1, output: 1, cached: 0 };
const text = (value: string): Completion => ({ content: [{ type: "text", text: value }], stopReason: "end_turn", usage });
const toolUse = (name: string, input: Record<string, unknown>): Completion => ({
  content: [{ type: "tool_use", id: `id-${name}`, name, input }],
  stopReason: "tool_use",
  usage
});

const conversation = (): Conversation => ({
  id: "c1",
  title: "t",
  mapId: 0,
  updated: 0,
  entries: [],
  messages: [],
  usage: { input: 0, output: 0, cached: 0 }
});

const handlers = (): SessionHandlers & { texts: string[]; tools: string[] } => {
  const texts: string[] = [];
  const tools: string[] = [];
  return {
    texts,
    tools,
    onText: value => texts.push(value),
    onScript: () => {},
    onScriptResult: () => {},
    onStatus: () => {},
    onUsage: () => {},
    onTool: name => tools.push(name)
  };
};

const toolResults = (messages: Message[]) =>
  messages.flatMap(message => message.content.filter(block => block.type === "tool_result"));

beforeEach(() => complete.mockReset());

describe("createSession tool dispatch", () => {
  it("routes a registered tool and feeds its content back to the model", async () => {
    const handle = vi.fn(async (input: Record<string, unknown>) => ({ content: `wrote ${input.html}` }));
    const tool: AgentTool = {
      definition: { name: "write_note", description: "d", input_schema: { type: "object" } },
      handle
    };
    complete.mockResolvedValueOnce(toolUse("write_note", { html: "<p>x</p>" })).mockResolvedValueOnce(text("done"));

    const session = createSession(() => ({ key: "k", model: "claude-sonnet-5" }), [tool]);
    const chat = conversation();
    const h = handlers();
    await session.ask(chat, "edit it", h);

    expect(handle).toHaveBeenCalledWith({ html: "<p>x</p>" });
    expect(h.tools).toEqual(["write_note"]);
    expect(toolResults(chat.messages)).toEqual([
      { type: "tool_result", tool_use_id: "id-write_note", content: "wrote <p>x</p>", is_error: false }
    ]);
    expect(h.texts).toEqual(["done"]);
    // both tools are offered to the model
    expect(complete.mock.calls[0][0].tools.map((t: { name: string }) => t.name)).toEqual(["run", "write_note"]);
  });

  it("marks a tool's error outcome as an error result", async () => {
    const tool: AgentTool = {
      definition: { name: "write_note", description: "d", input_schema: { type: "object" } },
      handle: async () => ({ content: "no note open", isError: true })
    };
    complete.mockResolvedValueOnce(toolUse("write_note", {})).mockResolvedValueOnce(text("sorry"));
    const chat = conversation();
    await createSession(() => ({ key: "k", model: "m" }), [tool]).ask(chat, "q", handlers());
    expect(toolResults(chat.messages)[0]).toMatchObject({ content: "no note open", is_error: true });
  });

  it("reports an unknown tool name back to the model as an error", async () => {
    complete.mockResolvedValueOnce(toolUse("delete_everything", {})).mockResolvedValueOnce(text("ok"));
    const chat = conversation();
    await createSession(() => ({ key: "k", model: "m" })).ask(chat, "q", handlers());
    const [result] = toolResults(chat.messages);
    expect(result.is_error).toBe(true);
    expect(result.content).toContain('Unknown tool "delete_everything"');
    expect(result.content).toContain("run");
  });

  it("still runs scripts through the built-in run tool", async () => {
    complete.mockResolvedValueOnce(toolUse("run", { code: "return 1" })).mockResolvedValueOnce(text("one"));
    const chat = conversation();
    await createSession(() => ({ key: "k", model: "m" })).ask(chat, "q", handlers());
    expect(toolResults(chat.messages)[0].content).toContain("ran:return 1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/services/agent/session-tools.test.ts`
Expected: FAIL — `createSession` accepts no second argument / `onTool` not called / unknown tool executed as a script.

- [ ] **Step 3: Widen the tool input type**

In `src/services/agent/providers.ts` replace the `ToolUseBlock` interface:

```ts
export type ToolInput = Record<string, unknown>;

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: ToolInput;
}
```

In `src/services/agent/providers-openai.ts`, make `parseArguments` return `ToolInput` (import the type); it already parses JSON into an object, so only the annotation changes. Run `npx tsc --noEmit` and fix any site that read `.input.code` as a string without a type guard (the session is the only one; it changes in the next step).

- [ ] **Step 4: Implement dispatch in `session.ts`**

Replace the handler and config interfaces and the tool loop:

```ts
import { type Completion, complete, type Message, type ToolDefinition, type ToolInput, type ToolResultBlock } from "./providers";

export interface ToolOutcome {
  content: string;
  isError?: boolean;
}

export interface AgentTool {
  definition: ToolDefinition;
  handle: (input: ToolInput) => Promise<ToolOutcome>;
}

export interface SessionHandlers {
  onText: (text: string) => void;
  onScript: (code: string) => void;
  onScriptResult: (result: RunResult) => void;
  onStatus: (status: string) => void;
  onUsage: () => void;
  onTool?: (name: string, input: ToolInput) => void;
}

export interface SessionConfig {
  key: string;
  model: string;
  context?: string; // extra per-turn system text (e.g. the open note) — threaded through in Task 3
}

export function createSession(getConfig: () => SessionConfig, tools: AgentTool[] = []) {
  let controller: AbortController | null = null;
  const definitions = [RUN_TOOL, ...tools.map(tool => tool.definition)];
  const byName = new Map(tools.map(tool => [tool.definition.name, tool]));

  async function runTool(toolUse: { name: string; input: ToolInput }, handlers: SessionHandlers): Promise<ToolOutcome> {
    if (toolUse.name === "run") {
      const code = typeof toolUse.input.code === "string" ? toolUse.input.code : "";
      handlers.onScript(code);
      handlers.onStatus("Running script");
      capture();
      const result = await runScript(code);
      handlers.onScriptResult(result);
      return { content: formatResult(result), isError: !result.ok };
    }
    const tool = byName.get(toolUse.name);
    if (!tool) {
      const known = definitions.map(definition => definition.name).join(", ");
      return { content: `Unknown tool "${toolUse.name}". Available tools: ${known}.`, isError: true };
    }
    handlers.onTool?.(toolUse.name, toolUse.input);
    handlers.onStatus(`Using ${toolUse.name}`);
    try {
      return await tool.handle(toolUse.input);
    } catch (error) {
      return { content: `${toolUse.name} failed: ${error instanceof Error ? error.message : String(error)}`, isError: true };
    }
  }

  async function ask(conversation: Conversation, question: string, handlers: SessionHandlers): Promise<void> {
    // …unchanged up to the completion call; pass `tools: definitions` instead of `[RUN_TOOL]` …
        const results: ToolResultBlock[] = [];
        for (const toolUse of toolUses) {
          const outcome = await runTool(toolUse, handlers);
          results.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: outcome.content,
            is_error: outcome.isError ?? false
          });
        }
        messages.push({ role: "user", content: results });
    // …rest unchanged…
  }

  return { ask, cancel: (): void => controller?.abort() };
}
```

Keep `trimHistory`, `emitText`, `formatResult` as they are. Note `is_error` is now always present (`false` for success) — the test asserts that; the providers accept it.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/services/agent/ && npx tsc --noEmit`
Expected: all agent tests pass including the four new ones; tsc silent.

- [ ] **Step 6: Commit**

```bash
git add src/services/agent/providers.ts src/services/agent/providers-openai.ts src/services/agent/session.ts src/services/agent/session-tools.test.ts
git commit --no-verify -m "feat(agent): generic tool dispatch in the session loop"
```

---

### Task 3: Conversation edit entries and the notes prompt sections

**Files:**
- Modify: `src/services/agent/conversations.ts` (Entry union)
- Modify: `src/services/agent/context.ts` (RULES, `# Notes` section, `buildSystemPrompt(context)`)
- Modify: `src/services/agent/session.ts` (thread `context` into `buildSystemPrompt`)
- Test: `src/services/agent/context.test.ts` (add cases)

**Interfaces:**
- Produces:
  ```ts
  export interface NoteState { legend: string; name: string }                 // conversations.ts
  export type Entry = … | { kind: "edit"; id: string; name: string; chars: number; previous: NoteState | null; undone?: boolean };
  export function buildSystemPrompt(context = ""): SystemBlock[]            // context.ts
  ```

- [ ] **Step 1: Write the failing tests**

Append to `src/services/agent/context.test.ts`:

```ts
import { buildSystemPrompt } from "./context";

test("the static prompt allows notes to change only through write_note", () => {
  const [staticBlock] = buildSystemPrompt();
  expect(staticBlock.text).toContain("write_note");
  expect(staticBlock.text).toContain("# Notes");
  expect(staticBlock.cache_control).toEqual({ type: "ephemeral" });
});

test("per-turn context is appended to the dynamic block, never the cached one", () => {
  const blocks = buildSystemPrompt("# Notes editor\n\nopen on burg1");
  expect(blocks).toHaveLength(2);
  expect(blocks[0].text).not.toContain("open on burg1");
  expect(blocks[1].text).toContain("# Current map");
  expect(blocks[1].text).toContain("open on burg1");
  expect(buildSystemPrompt()[1].text).not.toContain("# Notes editor");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/services/agent/context.test.ts`
Expected: FAIL — "write_note" not in the prompt; extra argument ignored.

- [ ] **Step 3: Edit `context.ts`**

Replace the first RULES bullet with:

```
- **Read-only, except notes.** Do not assign to \`pack\`, \`grid\`, \`options\`, \`style\` or \`notes\`, do not
  call generator methods that regenerate data, and do not call \`draw*\` or \`toggle*\` functions. Notes
  change ONLY through the \`write_note\` tool, never by assigning to \`notes\` in a script. If the user
  asks to change anything else on the map, explain that editing is not supported yet in this build.
```

Add a `NOTES` constant after `GOTCHAS` and include it in `staticPrompt` right after `RULES`:

```ts
const NOTES = `# Notes

Every map element can carry one note: \`{ id, name, legend }\` in the global \`notes\` array, where \`legend\`
is an HTML string shown in the notes box and in hover tooltips. Ids follow the element: \`burg<i>\` for a
burg with index \`i\` (so \`pack.burgs[12]\` → \`burg12\`), \`marker<i>\` for markers, \`state<i>\`, \`route<i>\`,
\`river<i>\` and so on — a note may exist for an element or not. When the user names a place rather than a
note, find the element in a script first and derive the id from it.

Write notes with \`write_note({ id?, name?, html })\`. \`html\` is the WHOLE legend. Omit \`id\` to target the
note open in the notes editor (see the "Notes editor" section of the current-map block when it is open).
The notes editor holds a limited HTML subset: \`p\`, \`br\`, \`strong\`, \`em\`, \`u\`, \`s\`, \`a\`, \`img\`,
\`ul\`/\`ol\`/\`li\`, \`blockquote\`, \`h1\`–\`h6\`, \`sub\`, \`sup\`, \`span\`/\`div\` and simple tables. Inline
styles are fine; classes, scripts, iframes and Markdown are not. Keep the user's existing text and
formatting unless they asked to change it, and tell them in one line what you changed.`;
```

Change the builder signature:

```ts
export function buildSystemPrompt(context = ""): SystemBlock[] {
  const dynamic = context ? `${describeCurrentMap()}\n\n${context}` : describeCurrentMap();
  return [
    { type: "text", text: staticPrompt, cache_control: { type: "ephemeral" } },
    { type: "text", text: dynamic }
  ];
}
```

- [ ] **Step 4: Thread the context through the session**

In `session.ts` `ask()`: `const { key, model, context } = getConfig();` and `system: buildSystemPrompt(context)`.

- [ ] **Step 5: Add the edit entry to `conversations.ts`**

```ts
export interface NoteState {
  legend: string;
  name: string;
}

export type Entry =
  | { kind: "message"; role: MessageRole; text: string }
  | { kind: "script"; code: string; result?: RunResult }
  | { kind: "edit"; id: string; name: string; chars: number; previous: NoteState | null; undone?: boolean };
```

`touch()` finds the first `message` entry for the title, so an `edit` entry needs no change there. The ai-chat renderer's `renderEntry` switch does not handle `edit` yet — that is Task 7; until then tsc is satisfied because `renderEntry` returns the `details` element for any non-message kind (verify with tsc; if it narrows and complains, add a temporary `if (entry.kind === "edit") return document.createElement("div");` in `ai-chat.ts`, removed when the file is deleted in Task 8).

- [ ] **Step 6: Run tests and tsc**

Run: `npx vitest run src/services/agent/ && npx tsc --noEmit`
Expected: pass; silent.

- [ ] **Step 7: Commit**

```bash
git add src/services/agent/context.ts src/services/agent/context.test.ts src/services/agent/conversations.ts src/services/agent/session.ts
git commit --no-verify -m "feat(agent): notes prompt section, per-turn context block, edit entries"
```

(Add `src/controllers/ai-chat.ts` to the `git add` if the temporary branch from Step 5 was needed.)

---

### Task 4: Notes editor bridge (TinyMCE-era) and the rich-text check stub

**Files:**
- Modify: `src/controllers/notes-editor.ts`
- Create: `src/controllers/notes-rich-text.ts` (stub: `canEditAsRichText` only; replaced wholesale by the Quill agent's module in Task 10)
- Test: `src/controllers/notes-editor.test.ts`, `src/controllers/notes-rich-text.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Note { id: string; name: string; legend: string }                       // notes-editor.ts
  export const NotesEditor = { open, current, write, remove, getSelectionHtml };
  function current(): Note | null
  function write(id: string, legend: string, name?: string): Note
  function remove(id: string): void
  function getSelectionHtml(): string | null       // always null until Quill
  export function canEditAsRichText(html: string): boolean                                   // notes-rich-text.ts
  ```

- [ ] **Step 1: Write the failing tests for the rich-text check**

Create `src/controllers/notes-rich-text.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { canEditAsRichText } from "./notes-rich-text";

describe("canEditAsRichText", () => {
  it.each(["", "plain text", "<p>Hi <strong>there</strong></p>", "<ul><li>a</li></ul>", "<table><tbody><tr><td>x</td></tr></tbody></table>", "<h3>T</h3><blockquote>q</blockquote>"])(
    "accepts %j",
    html => expect(canEditAsRichText(html)).toBe(true)
  );

  it.each(["<iframe src='x'></iframe>", "<p>a</p><hr>", "<script>alert(1)</script>", "<video src='x'></video>"])(
    "rejects %j",
    html => expect(canEditAsRichText(html)).toBe(false)
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/controllers/notes-rich-text.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the stub module**

`src/controllers/notes-rich-text.ts`:

```ts
// Pre-Quill stand-in for the Quill module of the same name (Azgaar #1803 branch). Only the
// representable check is needed by the assistant's write_note tool; the Quill branch replaces this
// file wholesale at merge time.

const RICH_TEXT_TAGS = new Set([
  "p", "div", "br", "span", "strong", "b", "em", "i", "u", "s", "strike", "a", "img", "ol", "ul", "li",
  "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "sub", "sup", "table", "tbody", "tr", "td", "th"
]);

export function canEditAsRichText(html: string): boolean {
  if (!html.trim()) return true;
  const body = new DOMParser().parseFromString(html, "text/html").body;
  return [...body.querySelectorAll("*")].every(element => RICH_TEXT_TAGS.has(element.tagName.toLowerCase()));
}
```

Run: `npx vitest run src/controllers/notes-rich-text.test.ts` → PASS.

- [ ] **Step 4: Write the failing bridge tests**

Create `src/controllers/notes-editor.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/renderers/overlays/highlight", () => ({ highlightElement: () => {} }));
vi.mock("@/components/tooltips", () => ({ tip: () => {} }));

import { NotesEditor } from "./notes-editor";

const w = globalThis as unknown as Record<string, unknown>;

beforeEach(() => {
  document.body.innerHTML = `<div id="dialogs"></div><div id="notesHeader"></div><div id="notesBody"></div>
    <input id="legendsToLoad" type="file" />`;
  w.notes = [{ id: "burg1", name: "Kelmora", legend: "<p>old</p>" }];
  w.options = { pinNotes: false };
  w.svgWidth = 1000;
  w.svgHeight = 600;
  w.tinymce = { remove: () => {}, init: () => {}, _setBaseUrl: () => {}, activeEditor: null };
  window.$ = vi.fn(() => ({ dialog: vi.fn() })) as unknown as typeof window.$;
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("NotesEditor bridge", () => {
  it("has no current note while the editor is closed", () => {
    expect(NotesEditor.current()).toBeNull();
    expect(NotesEditor.getSelectionHtml()).toBeNull();
  });

  it("writes to the data only while the editor is closed", () => {
    const note = NotesEditor.write("burg1", "<p>new</p>");
    expect(note).toEqual({ id: "burg1", name: "Kelmora", legend: "<p>new</p>" });
    expect((w.notes as { legend: string }[])[0].legend).toBe("<p>new</p>");
    expect(document.getElementById("notesEditor")).toBeNull();
  });

  it("creates a missing note with the given name, defaulting to the id", () => {
    NotesEditor.write("marker3", "<p>x</p>", "Old Well");
    NotesEditor.write("marker4", "<p>y</p>");
    const list = w.notes as { id: string; name: string }[];
    expect(list.map(n => `${n.id}:${n.name}`)).toEqual(["burg1:Kelmora", "marker3:Old Well", "marker4:marker4"]);
  });

  it("reports and refreshes the note shown in the open editor", () => {
    NotesEditor.open("burg1");
    expect(NotesEditor.current()?.id).toBe("burg1");

    NotesEditor.write("burg1", "<p>rewritten</p>", "Kelmora the Grim");
    expect(document.getElementById("notesLegend")?.innerHTML).toBe("<p>rewritten</p>");
    expect(document.getElementById("notesBody")?.innerHTML).toBe("<p>rewritten</p>");
    expect((document.getElementById("notesName") as HTMLInputElement).value).toBe("Kelmora the Grim");
  });

  it("adds a note created while another is open to the element list", () => {
    NotesEditor.open("burg1");
    NotesEditor.write("burg2", "<p>b</p>", "Varr");
    const options = [...(document.getElementById("notesSelect") as HTMLSelectElement).options].map(o => o.value);
    expect(options).toEqual(["burg1", "burg2"]);
    expect(NotesEditor.current()?.id).toBe("burg1");
  });

  it("removes a note and moves the open editor to the next one", () => {
    w.notes = [
      { id: "burg1", name: "Kelmora", legend: "<p>a</p>" },
      { id: "burg2", name: "Varr", legend: "<p>b</p>" }
    ];
    NotesEditor.open("burg2");
    NotesEditor.remove("burg2");
    expect((w.notes as { id: string }[]).map(n => n.id)).toEqual(["burg1"]);
    expect(NotesEditor.current()?.id).toBe("burg1");
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `npx vitest run src/controllers/notes-editor.test.ts`
Expected: FAIL — `NotesEditor.current is not a function`.

- [ ] **Step 6: Implement the bridge in `notes-editor.ts`**

Export the `Note` interface. Add a shared `showNote(note)` and use it from `open()`, `changeElement`, and the generator apply:

```ts
export interface Note {
  id: string;
  name: string;
  legend: string;
}

const isOpen = (): boolean => document.getElementById("notesEditor") !== null;

// Fill the editor's fields with a note; the TinyMCE-era equivalent of the Quill controller's loadNote
function showNote(note: Note): void {
  ensureEl<HTMLInputElement>("notesName").value = note.name;
  ensureEl("notesLegend").innerHTML = note.legend;
  window.tinymce?.activeEditor?.setContent(note.legend);
  updateNotesBox(note);
}

function current(): Note | null {
  if (!isOpen()) return null;
  const id = ensureEl<HTMLSelectElement>("notesSelect").value;
  return (notes as Note[]).find(note => note.id === id) ?? null;
}

function write(id: string, legend: string, name?: string): Note {
  const list = notes as Note[];
  let note = list.find(note => note.id === id);
  if (note) {
    note.legend = legend;
    if (name !== undefined) note.name = name;
  } else {
    note = { id, name: name ?? id, legend };
    list.push(note);
    if (isOpen()) ensureEl<HTMLSelectElement>("notesSelect").options.add(new Option(id, id));
  }
  if (current()?.id === id) showNote(note);
  return note;
}

function remove(id: string): void {
  const wasCurrent = current()?.id === id;
  notes = (notes as Note[]).filter(note => note.id !== id);
  if (!wasCurrent) return;
  if (!notes.length) {
    $("#notesEditor").dialog("close");
    return;
  }
  open((notes as Note[])[0].id, (notes as Note[])[0].name);
}

// Selection is a Quill feature; the TinyMCE-era editor reports none
const getSelectionHtml = (): string | null => null;

export const NotesEditor = { open, current, write, remove, getSelectionHtml };
```

Refactor the existing functions to use these: `changeElement` becomes `showNote(note)` after the lookup; `removeSelectedNote` becomes `remove(ensureEl<HTMLSelectElement>("notesSelect").value)`; `openAiGenerator`'s `onApply` becomes `if (note) write(note.id, result); else ensureEl("notesLegend").innerHTML = result;`. Remove the local `interface Note` duplicate. `open()` already re-renders the dialog, so `remove()` reopening on the first note matches the previous behaviour exactly.

- [ ] **Step 7: Run the tests and tsc**

Run: `npx vitest run src/controllers/notes-editor.test.ts src/controllers/notes-rich-text.test.ts && npx tsc --noEmit`
Expected: all pass; silent. If `window.tinymce?.activeEditor?.setContent` fails typing, check the `tinymce` declaration in `src/types/global.ts` and match it.

- [ ] **Step 8: Commit**

```bash
git add src/controllers/notes-editor.ts src/controllers/notes-editor.test.ts src/controllers/notes-rich-text.ts src/controllers/notes-rich-text.test.ts
git commit --no-verify -m "feat(notes): editor bridge (current/write/remove/selection) and rich-text check stub"
```

---

### Task 5: Note context and the `write_note` tool with undo

**Files:**
- Create: `src/controllers/help-assistant-notes.ts`
- Test: `src/controllers/help-assistant-notes.test.ts`

**Interfaces:**
- Consumes: `Controllers.NotesEditor.{current,write,remove,getSelectionHtml}` (global lazy registry — every call returns a Promise), `canEditAsRichText` (Task 4), `AgentTool`/`ToolOutcome` (Task 2), `Entry`/`NoteState` (Task 3).
- Produces:
  ```ts
  export type EditEntry = Extract<Entry, { kind: "edit" }>;
  export async function noteContext(): Promise<string | null>;                 // dynamic prompt text or null
  export async function noteChipLabel(): Promise<string | null>;               // "Kelmora" or null
  export function writeNoteTool(onEdit: (entry: EditEntry) => void): AgentTool;
  export async function writeNote(input: ToolInput, onEdit: (entry: EditEntry) => void): Promise<ToolOutcome>;
  export async function undoEdit(entry: EditEntry): Promise<void>;
  export const MAX_CONTEXT_CHARS = 6000;
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/controllers/help-assistant-notes.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type EditEntry, MAX_CONTEXT_CHARS, noteChipLabel, noteContext, undoEdit, writeNote } from "./help-assistant-notes";

const w = globalThis as unknown as Record<string, unknown>;

const editor = {
  current: vi.fn(),
  write: vi.fn(),
  remove: vi.fn(),
  getSelectionHtml: vi.fn()
};

beforeEach(() => {
  editor.current.mockReset().mockResolvedValue(null);
  editor.getSelectionHtml.mockReset().mockResolvedValue(null);
  editor.remove.mockReset().mockResolvedValue(undefined);
  editor.write.mockReset().mockImplementation(async (id: string, legend: string, name?: string) => {
    const list = w.notes as { id: string; name: string; legend: string }[];
    const existing = list.find(note => note.id === id);
    if (existing) {
      existing.legend = legend;
      if (name !== undefined) existing.name = name;
      return existing;
    }
    const note = { id, name: name ?? id, legend };
    list.push(note);
    return note;
  });
  w.Controllers = { NotesEditor: editor };
  w.notes = [{ id: "burg1", name: "Kelmora", legend: "<p>old</p>" }];
});

describe("noteContext", () => {
  it("is null when the editor is closed", async () => {
    expect(await noteContext()).toBeNull();
    expect(await noteChipLabel()).toBeNull();
  });

  it("describes the open note and its selection", async () => {
    editor.current.mockResolvedValue({ id: "burg1", name: "Kelmora", legend: "<p>old</p>" });
    editor.getSelectionHtml.mockResolvedValue("<p>old</p>");
    const text = await noteContext();
    expect(text).toContain("# Notes editor");
    expect(text).toContain("`burg1`");
    expect(text).toContain('"Kelmora"');
    expect(text).toContain("<p>old</p>");
    expect(text).toContain("selected");
    expect(await noteChipLabel()).toBe("Kelmora");
  });

  it("truncates a long legend and points at the rest", async () => {
    const legend = "x".repeat(MAX_CONTEXT_CHARS + 500);
    editor.current.mockResolvedValue({ id: "burg1", name: "K", legend });
    const text = (await noteContext()) ?? "";
    expect(text).not.toContain("x".repeat(MAX_CONTEXT_CHARS + 1));
    expect(text).toContain("500 more characters");
    expect(text).toContain('n.id === "burg1"');
  });
});

describe("writeNote", () => {
  const collect = () => {
    const entries: EditEntry[] = [];
    return { entries, onEdit: (entry: EditEntry) => entries.push(entry) };
  };

  it("updates the open note when no id is given and records the previous state", async () => {
    editor.current.mockResolvedValue({ id: "burg1", name: "Kelmora", legend: "<p>old</p>" });
    const { entries, onEdit } = collect();
    const outcome = await writeNote({ html: "<p>new</p>" }, onEdit);
    expect(outcome.isError).toBeFalsy();
    expect(outcome.content).toContain("updated note burg1");
    expect(editor.write).toHaveBeenCalledWith("burg1", "<p>new</p>", undefined);
    expect(entries).toEqual([{ kind: "edit", id: "burg1", name: "Kelmora", chars: 10, previous: { legend: "<p>old</p>", name: "Kelmora" } }]);
  });

  it("creates a note by id when none exists", async () => {
    const { entries, onEdit } = collect();
    const outcome = await writeNote({ id: "marker2", name: "Old Well", html: "<p>w</p>" }, onEdit);
    expect(outcome.content).toContain("created note marker2");
    expect(entries[0]).toMatchObject({ id: "marker2", name: "Old Well", previous: null });
  });

  it("refuses when there is neither an id nor an open note", async () => {
    const { entries, onEdit } = collect();
    const outcome = await writeNote({ html: "<p>x</p>" }, onEdit);
    expect(outcome.isError).toBe(true);
    expect(outcome.content).toContain("burg<i>");
    expect(entries).toEqual([]);
    expect(editor.write).not.toHaveBeenCalled();
  });

  it("refuses html the editor cannot hold", async () => {
    const { onEdit } = collect();
    const outcome = await writeNote({ id: "burg1", html: "<iframe src='x'></iframe>" }, onEdit);
    expect(outcome.isError).toBe(true);
    expect(outcome.content).toContain("cannot hold");
    expect(editor.write).not.toHaveBeenCalled();
  });

  it("refuses a missing html field", async () => {
    const outcome = await writeNote({ id: "burg1" }, collect().onEdit);
    expect(outcome.isError).toBe(true);
  });
});

describe("undoEdit", () => {
  it("restores the previous legend and name once", async () => {
    const entry: EditEntry = { kind: "edit", id: "burg1", name: "K2", chars: 1, previous: { legend: "<p>old</p>", name: "Kelmora" } };
    await undoEdit(entry);
    await undoEdit(entry);
    expect(editor.write).toHaveBeenCalledTimes(1);
    expect(editor.write).toHaveBeenCalledWith("burg1", "<p>old</p>", "Kelmora");
    expect(entry.undone).toBe(true);
  });

  it("removes a note the assistant created", async () => {
    const entry: EditEntry = { kind: "edit", id: "marker2", name: "Old Well", chars: 1, previous: null };
    await undoEdit(entry);
    expect(editor.remove).toHaveBeenCalledWith("marker2");
    expect(entry.undone).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/controllers/help-assistant-notes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `help-assistant-notes.ts`**

```ts
// Notes editing for the assistant's "This map" panel: the per-turn context describing the note open
// in the notes editor, the write_note tool, and its undo. Writes go through the notes editor bridge
// (Controllers.NotesEditor, lazy) so an open editor stays in sync.

import type { Entry, NoteState } from "@/services/agent/conversations";
import type { ToolInput } from "@/services/agent/providers";
import type { AgentTool, ToolOutcome } from "@/services/agent/session";
import type { Note } from "./notes-editor";
import { canEditAsRichText } from "./notes-rich-text";

export type EditEntry = Extract<Entry, { kind: "edit" }>;

export const MAX_CONTEXT_CHARS = 6000;

const ALLOWED_TAGS =
  "p, br, strong, em, u, s, a, img, ul, ol, li, blockquote, h1-h6, sub, sup, span, div, table/tbody/tr/td/th";

const WRITE_NOTE = {
  name: "write_note",
  description: `Replace the HTML legend of one note, creating the note when it does not exist. Omit \`id\` to
target the note open in the notes editor. \`html\` is the whole legend, not a fragment; allowed tags: ${ALLOWED_TAGS}.
Inline styles are kept, classes and scripts are not. Notes cannot be changed any other way.`,
  input_schema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Note id, e.g. burg12 or marker3. Defaults to the note open in the editor." },
      name: { type: "string", description: "New display name for the note. Omit to keep the current one." },
      html: { type: "string", description: "The complete legend as HTML." }
    },
    required: ["html"]
  }
};

const noteById = (id: string): Note | undefined => (notes as Note[]).find(note => note.id === id);

export async function noteContext(): Promise<string | null> {
  const note = await Controllers.NotesEditor.current();
  if (!note) return null;
  const selection = await Controllers.NotesEditor.getSelectionHtml();
  const legend = clipLegend(note);
  const lines = [
    "# Notes editor",
    "",
    `The notes editor is open on note \`${note.id}\` ("${note.name}"). \`write_note\` without an id targets it.`,
    "",
    "Current legend HTML:",
    "```html",
    legend,
    "```"
  ];
  if (selection) lines.push("", "The user has this part selected:", "```html", selection, "```");
  return lines.join("\n");
}

function clipLegend(note: Note): string {
  if (!note.legend) return "(empty)";
  if (note.legend.length <= MAX_CONTEXT_CHARS) return note.legend;
  const rest = note.legend.length - MAX_CONTEXT_CHARS;
  return `${note.legend.slice(0, MAX_CONTEXT_CHARS)}\n… ${rest} more characters — read notes.find(n => n.id === "${note.id}").legend in a script for the rest`;
}

export async function noteChipLabel(): Promise<string | null> {
  const note = await Controllers.NotesEditor.current();
  return note ? note.name || note.id : null;
}

export function writeNoteTool(onEdit: (entry: EditEntry) => void): AgentTool {
  return { definition: WRITE_NOTE, handle: input => writeNote(input, onEdit) };
}

const failure = (content: string): ToolOutcome => ({ content, isError: true });

export async function writeNote(input: ToolInput, onEdit: (entry: EditEntry) => void): Promise<ToolOutcome> {
  const html = typeof input.html === "string" ? input.html : null;
  if (html === null) return failure("write_note needs an `html` string with the whole legend.");
  if (!canEditAsRichText(html)) {
    return failure(`The notes editor cannot hold that HTML. Use only ${ALLOWED_TAGS}; no iframe, hr, script or media.`);
  }

  const id = typeof input.id === "string" && input.id ? input.id : (await Controllers.NotesEditor.current())?.id;
  if (!id) {
    return failure(
      "No note is open in the notes editor and no id was given. Find the element in a script first and pass its note id (burg<i> for burgs, marker<i> for markers)."
    );
  }
  const name = typeof input.name === "string" ? input.name : undefined;

  const existing = noteById(id);
  const previous: NoteState | null = existing ? { legend: existing.legend, name: existing.name } : null;
  const note = await Controllers.NotesEditor.write(id, html, name);
  onEdit({ kind: "edit", id, name: note.name, chars: html.length, previous });
  return { content: `${previous ? "updated" : "created"} note ${id} "${note.name}" — ${html.length} chars of HTML` };
}

export async function undoEdit(entry: EditEntry): Promise<void> {
  if (entry.undone) return;
  entry.undone = true;
  if (entry.previous) await Controllers.NotesEditor.write(entry.id, entry.previous.legend, entry.previous.name);
  else await Controllers.NotesEditor.remove(entry.id);
}
```

`Controllers` and `notes` are globals (declared in `src/controllers/index.ts` and `src/types/global.ts`); no import. If tsc complains that `Controllers.NotesEditor.current` is unknown, the registry type is derived from the module's export object — Task 4 already added the functions to `NotesEditor`, so re-run tsc after checking the import in `index.ts` is unchanged.

- [ ] **Step 4: Run the tests and tsc**

Run: `npx vitest run src/controllers/help-assistant-notes.test.ts && npx tsc --noEmit`
Expected: pass; silent.

- [ ] **Step 5: Commit**

```bash
git add src/controllers/help-assistant-notes.ts src/controllers/help-assistant-notes.test.ts
git commit --no-verify -m "feat(assistant): note context, write_note tool and undo"
```

---

### Task 6: Two-panel shell in `help-assistant.ts`

**Files:**
- Modify: `src/controllers/help-assistant.ts`
- Modify: `public/index.css` (mode bar + panel rules; help log flex)
- Test: `src/controllers/help-assistant-shell.test.ts` (new; the upstream `help-assistant.test.ts` stays untouched)

**Interfaces:**
- Consumes (Task 7, mocked here): `mountMapPanel(host: HTMLElement): void`, `refreshMapContext(): void`, `unmountMapPanel(): void` from `./help-assistant-map`. Task 6 lands before Task 7, so create `src/controllers/help-assistant-map.ts` in this task as a placeholder exporting those three functions as no-ops with the exact signatures; Task 7 fills it.
- Produces:
  ```ts
  export type AssistantMode = "help" | "map";
  export interface OpenOptions { mode?: AssistantMode }
  export const HelpAssistant = { open };   // open(options?: OpenOptions): void
  export function setMode(mode: AssistantMode): void
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/controllers/help-assistant-shell.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const panel = vi.hoisted(() => ({ mountMapPanel: vi.fn(), refreshMapContext: vi.fn(), unmountMapPanel: vi.fn() }));
vi.mock("./help-assistant-map", () => panel);

import { HelpAssistant } from "./help-assistant";

const limits = { tier: "anonymous", remaining: 5, resetsAt: "2026-09-06T00:00:00.000Z" };

beforeEach(() => {
  document.body.innerHTML = `<div id="dialogs"></div>`;
  window.$ = vi.fn(() => ({ dialog: vi.fn() })) as unknown as typeof window.$;
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(limits), { status: 200 })));
  panel.mountMapPanel.mockClear();
  panel.refreshMapContext.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const visible = (id: string): boolean => !(document.getElementById(id) as HTMLElement).hidden;
const selectedMode = (): string | null =>
  document.querySelector('#helpAssistant .helpAssistantMode[aria-selected="true"]')?.getAttribute("data-mode") ?? null;

describe("HelpAssistant shell", () => {
  it("opens on the Help panel by default", () => {
    HelpAssistant.open();
    expect(document.getElementById("helpAssistant")).not.toBeNull();
    expect(visible("helpAssistantHelp")).toBe(true);
    expect(visible("helpAssistantMap")).toBe(false);
    expect(selectedMode()).toBe("help");
    expect(panel.mountMapPanel).not.toHaveBeenCalled();
  });

  it("opens on This map when asked and mounts the panel once", () => {
    HelpAssistant.open({ mode: "map" });
    expect(visible("helpAssistantMap")).toBe(true);
    expect(visible("helpAssistantHelp")).toBe(false);
    expect(selectedMode()).toBe("map");
    expect(panel.mountMapPanel).toHaveBeenCalledTimes(1);
    expect(panel.mountMapPanel.mock.calls[0][0]).toBe(document.getElementById("helpAssistantMap"));

    HelpAssistant.open({ mode: "map" });
    expect(panel.mountMapPanel).toHaveBeenCalledTimes(1);
    expect(panel.refreshMapContext).toHaveBeenCalledTimes(2);
  });

  it("switches modes on a mounted dialog without rebuilding it", () => {
    HelpAssistant.open();
    const question = document.getElementById("helpAssistantQuestion") as HTMLTextAreaElement;
    question.value = "half typed";
    HelpAssistant.open({ mode: "map" });
    expect(visible("helpAssistantMap")).toBe(true);
    expect((document.getElementById("helpAssistantQuestion") as HTMLTextAreaElement).value).toBe("half typed");
    expect(document.getElementById("helpAssistantQuestion")).toBe(question);
  });

  it("switches with the mode buttons", () => {
    HelpAssistant.open();
    (document.querySelector('.helpAssistantMode[data-mode="map"]') as HTMLButtonElement).click();
    expect(selectedMode()).toBe("map");
    expect(visible("helpAssistantMap")).toBe(true);
    (document.querySelector('.helpAssistantMode[data-mode="help"]') as HTMLButtonElement).click();
    expect(selectedMode()).toBe("help");
    expect(visible("helpAssistantHelp")).toBe(true);
  });
});
```

- [ ] **Step 2: Create the placeholder map panel module and run the tests**

`src/controllers/help-assistant-map.ts` (placeholder, replaced in Task 7):

```ts
// The "This map" panel of the assistant dialog — filled in by the next task.
export function mountMapPanel(_host: HTMLElement): void {}
export function refreshMapContext(): void {}
export function unmountMapPanel(): void {}
```

Run: `npx vitest run src/controllers/help-assistant-shell.test.ts`
Expected: FAIL — no `helpAssistantHelp` element / `open` ignores options.

- [ ] **Step 3: Restructure `help-assistant.ts`**

Add near the top:

```ts
import { mountMapPanel, refreshMapContext, unmountMapPanel } from "./help-assistant-map";

export type AssistantMode = "help" | "map";

export interface OpenOptions {
  mode?: AssistantMode;
}
```

Replace `open()`:

```ts
function open(options: OpenOptions = {}): void {
  const mode = options.mode ?? "help";
  if (isMounted()) {
    setMode(mode);
    return;
  }

  renderDialog();

  $("#helpAssistant").dialog({
    title: "Azgaar's Assistant",
    width: Math.min(460, window.innerWidth - 20),
    height: Math.min(600, window.innerHeight - 40),
    minWidth: 360,
    minHeight: 420,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" },
    resizable: true,
    close: () => {
      if (retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
      autoRetried = false;
      unmountMapPanel();
      destroyDialog("helpAssistant");
    }
  });

  setMode(mode);
  if (isOfficialOrigin()) void refreshLimits();
}

export function setMode(mode: AssistantMode): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>("#helpAssistant .helpAssistantMode")) {
    const active = button.dataset.mode === mode;
    button.setAttribute("aria-selected", String(active));
    button.classList.toggle("selected", active);
  }
  ensureEl("helpAssistantHelp").hidden = mode !== "help";
  const mapHost = ensureEl("helpAssistantMap");
  mapHost.hidden = mode !== "map";
  if (mode === "map") {
    if (!mapHost.dataset.mounted) {
      mountMapPanel(mapHost);
      mapHost.dataset.mounted = "1";
    }
    refreshMapContext();
  }
}
```

In `renderDialog()`, wrap the existing markup:

```ts
  const modes = /* html */ `
    <div class="helpAssistantModes" role="tablist">
      <button type="button" class="helpAssistantMode icon-help-circled" data-mode="help" role="tab" aria-selected="true"
        data-tip="Ask how to use the map generator — answers come from the documentation">Help</button>
      <button type="button" class="helpAssistantMode icon-robot" data-mode="map" role="tab" aria-selected="false"
        data-tip="Ask about, or edit, the map you have open using your own AI key">This map</button>
    </div>`;

  const html = /* html */ `<div id="helpAssistant" class="dialog stable">
    ${modes}
    <div id="helpAssistantHelp" class="helpAssistantPanel">
      ${isOfficialOrigin() ? form : unlisted}
      ${links}
    </div>
    <div id="helpAssistantMap" class="helpAssistantPanel" hidden></div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  for (const button of document.querySelectorAll<HTMLButtonElement>("#helpAssistant .helpAssistantMode")) {
    button.addEventListener("click", () => setMode(button.dataset.mode as AssistantMode));
  }

  if (!isOfficialOrigin()) return;
  // …existing listeners unchanged…
```

Everything else in the file (submit, notices, feedback, auth, limits) stays as it is. `export const HelpAssistant = { open };` keeps its shape; `open` now takes an optional argument.

- [ ] **Step 4: CSS**

In `public/index.css`, after the existing `#helpAssistant > div { width: auto; }` block add:

```css
#helpAssistant {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
  height: 100%;
  user-select: text;
}

#helpAssistant .helpAssistantModes {
  display: flex;
  gap: 0.25em;
  padding: 0.15em;
  border-radius: 0.5em;
  background: rgb(0 0 0 / 6%);
  flex: 0 0 auto;
}

#helpAssistant .helpAssistantMode {
  flex: 1;
  padding: 0.3em 0.6em;
  border: none;
  border-radius: 0.4em;
  background: transparent;
  cursor: pointer;
  opacity: 0.7;
}

#helpAssistant .helpAssistantMode::before {
  margin-right: 0.35em;
}

#helpAssistant .helpAssistantMode.selected {
  background: #fff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 20%);
  opacity: 1;
  font-weight: bold;
}

#helpAssistant .helpAssistantPanel {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

#helpAssistant .helpAssistantPanel[hidden] {
  display: none;
}
```

And change the help log so it fills the panel instead of capping at 40vh:

```css
#helpAssistant .helpAssistantLog {
  flex: 1 1 auto;
  min-height: 8em;
  overflow-y: auto;
  margin-bottom: 0.5em;
}
```

Then `npm run stamp-assets` (it rewrites the `index.css?v=` hash in `src/index.html`).

- [ ] **Step 5: Run tests and tsc**

Run: `npx vitest run src/controllers/help-assistant*.test.ts && npx tsc --noEmit`
Expected: the upstream `help-assistant.test.ts` still passes; the four shell tests pass; tsc silent.

- [ ] **Step 6: Commit**

```bash
git add src/controllers/help-assistant.ts src/controllers/help-assistant-map.ts src/controllers/help-assistant-shell.test.ts public/index.css src/index.html
git commit --no-verify -m "feat(assistant): two-panel shell — Help first, This map behind a click"
```

---

### Task 7: The "This map" panel

**Files:**
- Replace: `src/controllers/help-assistant-map.ts` (port of `ai-chat.ts` into a panel)
- Modify: `public/index.css` (panel styles, moved from `ai-chat.ts`'s inline `<style>`)
- Test: `src/controllers/help-assistant-map.test.ts`

**Interfaces:**
- Consumes: `createSession`, `AgentTool` (Task 2); `Conversation`/`Entry` store (Task 3); `writeNoteTool`, `noteContext`, `noteChipLabel`, `undoEdit`, `EditEntry` (Task 5); `PROVIDERS`, `providerOf`, `keyStorageFor`, `DEFAULT_MODEL`, `LOCAL_MODEL`, `LOCAL_*_STORAGE`, `DEFAULT_LOCAL_URL`, `registerModels`; `cachedModels`, `listModels`, `mergeModels`; `renderMarkdown`; `confirmationDialog`; `tip`; `openURL`.
- Produces:
  ```ts
  export function mountMapPanel(host: HTMLElement): void
  export function refreshMapContext(): void
  export function unmountMapPanel(): void
  export function needsKey(model: string, key: string): boolean
  export const MAP_SUGGESTIONS: string[]; export const NOTE_SUGGESTIONS: string[];
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/controllers/help-assistant-map.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/tooltips", () => ({ tip: vi.fn() }));
vi.mock("@/services/agent/providers-models", () => ({
  cachedModels: () => [],
  listModels: vi.fn().mockRejectedValue(new Error("offline")),
  mergeModels: (curated: string[]) => curated
}));
const notesApi = vi.hoisted(() => ({ label: null as string | null }));
vi.mock("./help-assistant-notes", () => ({
  noteChipLabel: async () => notesApi.label,
  noteContext: async () => (notesApi.label ? `# Notes editor\n\n${notesApi.label}` : null),
  writeNoteTool: () => ({ definition: { name: "write_note", description: "", input_schema: {} }, handle: async () => ({ content: "" }) }),
  undoEdit: vi.fn(async () => {})
}));

import { mountMapPanel, needsKey, NOTE_SUGGESTIONS, refreshMapContext, unmountMapPanel } from "./help-assistant-map";

const w = globalThis as unknown as Record<string, unknown>;
const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = `<div id="host"></div>`;
  w.mapId = 1;
  w.customization = 0;
  window.$ = vi.fn(() => ({ dialog: vi.fn() })) as unknown as typeof window.$;
  notesApi.label = null;
});

afterEach(() => {
  unmountMapPanel();
  document.body.innerHTML = "";
});

describe("needsKey", () => {
  it("is true for a cloud model without a key and false for local models", () => {
    expect(needsKey("claude-sonnet-5", "")).toBe(true);
    expect(needsKey("claude-sonnet-5", "  ")).toBe(true);
    expect(needsKey("claude-sonnet-5", "sk-1")).toBe(false);
    expect(needsKey("local", "")).toBe(false);
  });
});

describe("map panel", () => {
  it("mounts with the drawer closed and the model named in the status line", () => {
    mountMapPanel(el("host"));
    expect(el("helpMapDrawer").hidden).toBe(true);
    expect(el("helpMapStatusModel").textContent).toContain("claude-sonnet-5");
    expect(el("helpMapStatusKey").textContent).toContain("no key");
    expect(el("helpMapContext").hidden).toBe(true);
  });

  it("opens the drawer with a hint instead of sending when the key is missing", () => {
    mountMapPanel(el("host"));
    el<HTMLTextAreaElement>("helpMapInput").value = "hello";
    el<HTMLTextAreaElement>("helpMapInput").dispatchEvent(new Event("input"));
    el<HTMLButtonElement>("helpMapSend").click();
    expect(el("helpMapDrawer").hidden).toBe(false);
    expect(el("helpMapHint").hidden).toBe(false);
    expect(document.activeElement).toBe(el("helpMapKey"));
    expect(el("helpMapLog").querySelector(".helpMapUser")).toBeNull();
  });

  it("toggles the drawer from the gear and the status model button", () => {
    mountMapPanel(el("host"));
    el<HTMLButtonElement>("helpMapSettings").click();
    expect(el("helpMapDrawer").hidden).toBe(false);
    el<HTMLButtonElement>("helpMapSettings").click();
    expect(el("helpMapDrawer").hidden).toBe(true);
    el<HTMLButtonElement>("helpMapStatusModel").click();
    expect(el("helpMapDrawer").hidden).toBe(false);
  });

  it("shows the note chip and note suggestions when the notes editor is open", async () => {
    notesApi.label = "Kelmora";
    mountMapPanel(el("host"));
    refreshMapContext();
    await flush();
    expect(el("helpMapContext").hidden).toBe(false);
    expect(el("helpMapContext").textContent).toContain("Kelmora");
    const chips = [...el("helpMapLog").querySelectorAll("button")].map(button => button.textContent);
    expect(chips).toEqual(NOTE_SUGGESTIONS);
  });

  it("renders an edit entry with a working undo", async () => {
    const { undoEdit } = await import("./help-assistant-notes");
    mountMapPanel(el("host"));
    // reach the renderer through the conversation store: push an entry and re-render by remounting
    const { current } = await import("@/services/agent/conversations");
    current().entries.push({ kind: "edit", id: "burg1", name: "Kelmora", chars: 1200, previous: { legend: "<p>o</p>", name: "Kelmora" } });
    unmountMapPanel();
    mountMapPanel(el("host"));
    const entry = el("helpMapLog").querySelector(".helpMapEdit") as HTMLElement;
    expect(entry.textContent).toContain("Updated note");
    expect(entry.textContent).toContain("Kelmora");
    (entry.querySelector("button") as HTMLButtonElement).click();
    await flush();
    expect(undoEdit).toHaveBeenCalled();
    expect((entry.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/controllers/help-assistant-map.test.ts`
Expected: FAIL — placeholder exports do nothing; `needsKey` missing.

- [ ] **Step 3: Write `help-assistant-map.ts`**

Port `src/controllers/ai-chat.ts` with these changes (everything not listed is copied as is, with `aiChat` ids renamed to `helpMap` and `DIALOG_ID` logic removed):

```ts
// The assistant dialog's "This map" panel: the BYOK agent over the open map (formerly the AI Chat
// dialog), with model settings in a drawer and note editing through write_note.

import { confirmationDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { type Conversation, create, type Entry, forCurrentMap, isEmpty, list, type MessageRole, remove, select, touch } from "@/services/agent/conversations";
import { DEFAULT_LOCAL_URL, DEFAULT_MODEL, keyStorageFor, LOCAL_MODEL, LOCAL_MODEL_STORAGE, LOCAL_URL_STORAGE, PROVIDERS, providerOf, registerModels } from "@/services/agent/providers";
import { cachedModels, listModels, mergeModels } from "@/services/agent/providers-models";
import type { RunResult } from "@/services/agent/runtime";
import { createSession } from "@/services/agent/session";
import { openURL } from "@/utils";
import { renderMarkdown } from "@/utils/markdown";
import { ensureEl } from "../utils";
import { type EditEntry, noteChipLabel, noteContext, undoEdit, writeNoteTool } from "./help-assistant-notes";

const MODEL_STORAGE = "fmg-ai-chat-model";
const MAX_INPUT_HEIGHT = 120;

export const MAP_SUGGESTIONS = [
  "Which states have no ports?",
  "List the five largest burgs and their states",
  "How is the land split between biomes?"
];

export const NOTE_SUGGESTIONS = [
  "Write a description for this note",
  "Make it more ominous",
  "Tighten the wording, keep the facts"
];

export const needsKey = (model: string, key: string): boolean => providerOf(model).id !== "local" && !key.trim();

let host: HTMLElement | null = null;
let conversation: Conversation;
let currentStep: HTMLDetailsElement | null = null;
let busy = false;
let turnContext = "";
let noteLabel: string | null = null;

const session = createSession(
  () => ({
    key: ensureEl<HTMLInputElement>("helpMapKey").value,
    model: ensureEl<HTMLSelectElement>("helpMapModel").value,
    context: turnContext
  }),
  [writeNoteTool(entry => addEntry(entry))]
);

export function mountMapPanel(target: HTMLElement): void {
  host = target;
  conversation = forCurrentMap();
  target.innerHTML = panelHtml();
  bind();
  setInitialValues();
  renderConversations();
  renderTranscript();
  renderUsage();
}

// Called on every open/switch into the panel and before each send: the note chip and the
// suggestions follow the notes editor
export function refreshMapContext(): void {
  void noteChipLabel().then(label => {
    if (!host) return;
    noteLabel = label;
    const chip = ensureEl("helpMapContext");
    chip.hidden = label === null;
    chip.textContent = label === null ? "" : `Note: ${label}`;
    if (isEmpty(conversation)) renderTranscript();
    ensureEl("helpMapInput").focus();
  });
}

export function unmountMapPanel(): void {
  session.cancel();
  busy = false;
  currentStep = null;
  if (host) host.innerHTML = "";
  host = null;
}

function panelHtml(): string {
  return /* html */ `
    <div class="helpMapTop">
      <select id="helpMapConversation" data-tip="Switch between conversations. Each one is sent in full with every question, so a fresh one costs less"></select>
      <button id="helpMapNew" class="icon-plus" data-tip="Start a new conversation"></button>
      <button id="helpMapRemove" class="icon-trash" data-tip="Delete the current conversation"></button>
    </div>
    <div id="helpMapLog" class="helpMapLog"></div>
    <div id="helpMapContext" class="helpMapContext" hidden></div>
    <div class="helpMapComposer">
      <textarea id="helpMapInput" rows="2" placeholder="Ask about this map…" data-tip="Enter to send, Shift + Enter for a new line"></textarea>
      <button id="helpMapSend" class="icon-right-open" data-tip="Send the message"></button>
      <button id="helpMapSettings" class="icon-cog" data-tip="Model and API key" aria-expanded="false"></button>
    </div>
    <div id="helpMapDrawer" class="helpMapDrawer" hidden>
      <div id="helpMapHint" class="helpMapHint" hidden>Add your API key to start. It stays in this browser and goes only to the provider.</div>
      <label>Model <select id="helpMapModel" data-tip="Model to ask. Bigger models reason better and cost more"></select></label>
      <label>API key
        <input id="helpMapKey" type="password" placeholder="API key" class="icon-key" />
        <button id="helpMapKeyHelp" class="icon-help-circled" data-tip="Where to get the key"></button>
      </label>
      <div id="helpMapLocal" hidden>
        <input id="helpMapLocalUrl" type="text" placeholder="${DEFAULT_LOCAL_URL}" data-tip="Base URL of an OpenAI-compatible local server (Ollama, llama.cpp, LM Studio)" />
        <input id="helpMapLocalModel" type="text" placeholder="model name, e.g. llama3.2" data-tip="Name of the model as your local server knows it" />
      </div>
    </div>
    <div class="helpMapStatus">
      <button id="helpMapStatusModel" type="button" data-tip="Change the model or key"></button>
      <span id="helpMapStatusKey"></span>
      <span id="helpMapUsage"></span>
    </div>`;
}
```

`bind()` attaches the listeners `ai-chat.ts` attached in `renderDialog()` (conversation change, new, remove, key help, send/cancel, log link clicks, input autosize + Enter) plus:

```ts
  ensureEl("helpMapSettings").addEventListener("click", () => toggleDrawer());
  ensureEl("helpMapStatusModel").addEventListener("click", () => toggleDrawer(true));
  ensureEl("helpMapKey").addEventListener("input", renderStatus);
```

```ts
function toggleDrawer(open?: boolean): void {
  const drawer = ensureEl("helpMapDrawer");
  drawer.hidden = open === undefined ? !drawer.hidden : !open;
  ensureEl("helpMapSettings").setAttribute("aria-expanded", String(!drawer.hidden));
  if (drawer.hidden) ensureEl("helpMapHint").hidden = true;
}

function renderStatus(): void {
  const model = ensureEl<HTMLSelectElement>("helpMapModel").value;
  const provider = providerOf(model);
  ensureEl("helpMapStatusModel").textContent = model === LOCAL_MODEL ? "local model" : `${model} · ${provider.label}`;
  const key = ensureEl<HTMLInputElement>("helpMapKey").value;
  ensureEl("helpMapStatusKey").textContent = provider.id === "local" ? "" : key ? "· key set" : "· no key";
}
```

`setInitialValues`, `isKnownModel`, `buildModelSelect`, `refreshModels`, `loadKeyForModel` are copied with ids renamed; `loadKeyForModel` ends with `renderStatus()` and toggles `helpMapLocal.hidden` instead of `style.display`. `updateSendButton` copied.

`send()` copied, with the key check replaced by:

```ts
  if (needsKey(model, key)) {
    toggleDrawer(true);
    ensureEl("helpMapHint").hidden = false;
    ensureEl("helpMapKey").focus();
    return;
  }
```

and, just before `session.ask`:

```ts
  toggleDrawer(false);
  turnContext = (await noteContext()) ?? "";
  noteLabel = turnContext ? noteLabel : null;
```

and the handlers object gains `onTool: () => showThinking("Editing the note")`.

`renderEntry` gains the edit kind:

```ts
  if (entry.kind === "edit") return renderEdit(entry);

function renderEdit(entry: EditEntry): HTMLElement {
  const element = document.createElement("div");
  element.className = "helpMapEdit";
  const text = document.createElement("span");
  const verb = entry.previous ? "Updated" : "Created";
  text.textContent = `${verb} note “${entry.name}” · ${thousands(entry.chars)} chars${entry.undone ? " · undone" : ""}`;
  const undo = document.createElement("button");
  undo.type = "button";
  undo.className = "icon-ccw";
  undo.textContent = " Undo";
  undo.disabled = Boolean(entry.undone);
  undo.addEventListener("click", () => {
    undo.disabled = true;
    void undoEdit(entry).then(() => {
      text.textContent = `${verb} note “${entry.name}” · ${thousands(entry.chars)} chars · undone`;
      touch(conversation);
    });
  });
  element.append(text, undo);
  return element;
}
```

`emptyState()` picks `noteLabel ? NOTE_SUGGESTIONS : MAP_SUGGESTIONS` and the hint line reads "I can read this map and answer questions about it, and edit notes in the notes editor." Every `document.getElementById("aiChatLog")` style lookup becomes `helpMapLog`, and the `.aiChat*` class names become `.helpMap*` (`helpMapUser`, `helpMapAssistant`, `helpMapSystem`, `helpMapError`, `helpMapMessage`, `helpMapStep`, `helpMapThinking` id, `helpMapEmpty` id).

- [ ] **Step 4: CSS**

Move the rules from `ai-chat.ts`'s inline `<style>` into `public/index.css` under `#helpAssistant`, renaming `#aiChat` → `#helpAssistantMap` and `.aiChat*` → `.helpMap*`, and add:

```css
#helpAssistantMap .helpMapTop { display: flex; align-items: center; gap: 0.3em; }
#helpAssistantMap .helpMapTop > select { flex: 1; min-width: 0; }
#helpAssistantMap .helpMapLog { flex: 1 1 auto; min-height: 6em; overflow-y: auto; display: flex; flex-direction: column; gap: 0.45em; }
#helpAssistantMap .helpMapContext { align-self: flex-start; font-size: 0.85em; padding: 0.1em 0.6em; border-radius: 1em; background: rgb(53 66 77 / 12%); }
#helpAssistantMap .helpMapComposer { display: flex; align-items: flex-end; gap: 0.3em; }
#helpAssistantMap .helpMapComposer > textarea { flex: 1; resize: none; overflow-y: auto; }
#helpAssistantMap .helpMapDrawer { display: flex; flex-direction: column; gap: 0.3em; padding: 0.5em; border-radius: 0.4em; background: rgb(0 0 0 / 5%); font-size: 0.92em; }
#helpAssistantMap .helpMapDrawer label { display: flex; align-items: center; gap: 0.4em; }
#helpAssistantMap .helpMapDrawer select, #helpAssistantMap .helpMapDrawer input { flex: 1; min-width: 0; }
#helpAssistantMap .helpMapHint { color: #b03030; }
#helpAssistantMap .helpMapStatus { display: flex; flex-wrap: wrap; gap: 0.3em 0.5em; align-items: center; font-size: 0.85em; opacity: 0.8; }
#helpAssistantMap .helpMapStatus > button { background: none; border: none; padding: 0; cursor: pointer; text-decoration: underline dotted; }
#helpAssistantMap .helpMapEdit { align-self: flex-start; display: flex; align-items: center; gap: 0.5em; padding: 0.3em 0.6em; border-radius: 0.4em; background: rgb(53 66 77 / 10%); font-size: 0.92em; }
#helpAssistantMap .helpMapEdit button { padding: 0.1em 0.4em; }
#helpAssistantMap [hidden] { display: none; }
```

Then `npm run stamp-assets`.

- [ ] **Step 5: Run tests and tsc**

Run: `npx vitest run src/controllers/help-assistant-map.test.ts src/controllers/help-assistant-shell.test.ts && npx tsc --noEmit`
Expected: pass; silent. `ai-chat.ts` still compiles (it is deleted in Task 8).

- [ ] **Step 6: Commit**

```bash
git add src/controllers/help-assistant-map.ts src/controllers/help-assistant-map.test.ts public/index.css src/index.html
git commit --no-verify -m "feat(assistant): This map panel with settings drawer, note chip and edit entries"
```

---

### Task 8: Entry points, retire the AI Chat dialog

**Files:**
- Delete: `src/controllers/ai-chat.ts`
- Modify: `src/controllers/index.ts` (remove `AiChat`), `src/components/tools.ts:45`, `src/index.html` (Tools button label/tip), `src/controllers/notes-editor.ts` (robot button → assistant; drop `openAiGenerator`)
- Regenerate: `src/services/agent/context.generated.ts` via `npm run generate:agent-context`

**Interfaces:**
- Consumes: `HelpAssistant.open({ mode: "map" })` (Task 6).

- [ ] **Step 1: Rewire the Tools button**

`src/components/tools.ts`: replace `else if (buttonId === "openAiChatButton") void Controllers.AiChat.open();` with `else if (buttonId === "openAiChatButton") void Controllers.HelpAssistant.open({ mode: "map" });`

`src/index.html` around line 1928: the button becomes

```html
            <button id="openAiChatButton" data-tip="Click to open the assistant on this map: ask about the data or edit notes with your own AI key">
              Assistant
            </button>
```

- [ ] **Step 2: Rewire the notes editor's robot button**

In `src/controllers/notes-editor.ts`: `ensureEl("notesGenerateWithAi").addEventListener("click", () => void Controllers.HelpAssistant.open({ mode: "map" }));`, update its `data-tip` to "Ask the assistant to write or rewrite this note", and delete the `openAiGenerator` function.

- [ ] **Step 3: Delete the old dialog and its registry entry**

```bash
git rm -q src/controllers/ai-chat.ts
```

Remove the `AiChat:` line from `src/controllers/index.ts`. Run `npm run generate:agent-context` (rewrites `REGISTRY_KEYS` in `context.generated.ts`).

- [ ] **Step 4: Check nothing else references it**

Run: `grep -rn "AiChat\|aiChat" src public tests --include='*.ts' --include='*.js' --include='*.html' | grep -v context.generated`
Expected: no output.

- [ ] **Step 5: Type-check, full unit run, format**

Run: `npx tsc --noEmit && npx vitest run --reporter=dot 2>&1 | tail -4 && npx biome check src/controllers src/services/agent src/components/tools.ts`
Expected: silent; all green (including `context.test.ts`'s "context.generated.ts is current"); Biome clean (apply `--write` if it only reports formatting).

- [ ] **Step 6: Commit**

```bash
git add src/components/tools.ts src/index.html src/controllers/notes-editor.ts src/controllers/index.ts src/services/agent/context.generated.ts
git commit --no-verify -m "feat(assistant): route Tools and notes-editor entry points into the assistant; retire AI Chat dialog"
```

---

### Task 9: Browser verification (Playwright on port 5199)

**Files:**
- Create: `playwright.local.config.ts` (repo-local; overrides base URL and server; not committed to CI paths)
- Create: `tests/e2e/help-assistant-ai.spec.ts`

**Interfaces:**
- Consumes: everything above through the running app.

- [ ] **Step 1: Local config**

`playwright.local.config.ts`:

```ts
import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Runs against this worktree's own dev server on 5199. Port 5173 belongs to the user's session.
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://localhost:5199" },
  webServer: {
    command: "npx vite --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: true,
    timeout: 120000
  }
});
```

- [ ] **Step 2: The spec**

`tests/e2e/help-assistant-ai.spec.ts`:

```ts
import { expect, type Page, test } from "@playwright/test";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, authorization, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access",
  "access-control-allow-methods": "GET, POST, OPTIONS"
};

const json = (body: unknown, status = 200) => ({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });

async function stubGateway(page: Page): Promise<void> {
  await page.route("https://ask.azgaarsfmg.com/**", route => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (request.url().endsWith("/v1/limits")) return route.fulfill(json({ tier: "anonymous", remaining: 5, resetsAt: "2099-01-01T00:00:00.000Z" }));
    if (request.url().endsWith("/v1/ask")) {
      return route.fulfill(json({ conversationId: "abcdefghijklmnopqrstuvwx", requestId: 7, answer: "Use **File → Export → SVG**.", model: "stub", usage: null }));
    }
    return route.fulfill({ status: 204, headers: CORS });
  });
}

// First completion asks to edit the note, second answers in text
async function stubAnthropic(page: Page, html: string): Promise<void> {
  let calls = 0;
  await page.route("https://api.anthropic.com/v1/messages", route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    calls += 1;
    const usage = { input_tokens: 10, output_tokens: 5 };
    if (calls === 1) {
      return route.fulfill(json({ content: [{ type: "tool_use", id: "toolu_1", name: "write_note", input: { html } }], stop_reason: "tool_use", usage }));
    }
    return route.fulfill(json({ content: [{ type: "text", text: "Done — I rewrote the note." }], stop_reason: "end_turn", usage }));
  });
}

async function loadMap(page: Page): Promise<void> {
  await page.route("https://azgaar.github.io/**", route => route.abort()); // no remote TinyMCE: plain contenteditable
  await page.goto("/?seed=assistant-e2e&width=1280&height=720");
  await page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 120000 });
  await page.evaluate(() => {
    (window as any).notes.push({ id: "burg1", name: "Kelmora", legend: "<p>Old text.</p>" });
  });
}

test.describe("assistant dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("fmg-ai-chat-model", "claude-sonnet-5");
      localStorage.setItem("fmg-ai-kl-anthropic", "sk-test");
      localStorage.removeItem("fmg-ai-chat-conversations");
    });
    await stubGateway(page);
    await loadMap(page);
  });

  test("the bubble opens Help first and the mode control switches", async ({ page }) => {
    await page.locator("#helpAssistantBubble").click();
    await expect(page.locator("#helpAssistant")).toBeVisible();
    await expect(page.locator("#helpAssistantHelp")).toBeVisible();
    await expect(page.locator("#helpAssistantMap")).toBeHidden();
    await page.locator("#helpAssistantQuestion").fill("half typed");
    await page.locator('.helpAssistantMode[data-mode="map"]').click();
    await expect(page.locator("#helpAssistantMap")).toBeVisible();
    await expect(page.locator("#helpMapDrawer")).toBeHidden();
    await page.locator('.helpAssistantMode[data-mode="help"]').click();
    await expect(page.locator("#helpAssistantQuestion")).toHaveValue("half typed");
  });

  test("help questions round-trip through the gateway", async ({ page }) => {
    await page.locator("#helpAssistantBubble").click();
    await page.locator("#helpAssistantQuestion").fill("How do I export SVG?");
    await page.locator("#helpAssistantAsk").click();
    const answer = page.locator("#helpAssistantLog .helpAssistantAnswer");
    await expect(answer).toContainText("Use");
    await expect(answer.locator("strong")).toHaveText("File → Export → SVG");
    await expect(answer.locator(".helpAssistantFeedback button")).toHaveCount(2);
    await expect(page.locator("#helpAssistantLimits")).toContainText("5 questions left today");
  });

  test("the notes editor's AI button opens This map with the note chip, and write_note edits with undo", async ({ page }) => {
    await stubAnthropic(page, "<p>Kelmora broods beneath a sky of ash.</p>");
    await page.evaluate(() => (window as any).Controllers.NotesEditor.open("burg1"));
    await expect(page.locator("#notesEditor")).toBeVisible();
    await page.locator("#notesGenerateWithAi").click();

    await expect(page.locator("#helpAssistantMap")).toBeVisible();
    await expect(page.locator("#helpMapContext")).toHaveText("Note: Kelmora");
    await expect(page.locator("#helpMapLog button").first()).toHaveText("Write a description for this note");

    await page.locator("#helpMapInput").fill("make it ominous");
    await page.locator("#helpMapInput").press("Enter");

    const edit = page.locator("#helpMapLog .helpMapEdit");
    await expect(edit).toContainText("Updated note “Kelmora”");
    await expect(page.locator("#helpMapLog .helpMapAssistant")).toContainText("Done");
    expect(await page.evaluate(() => (window as any).notes.find((n: any) => n.id === "burg1").legend)).toBe("<p>Kelmora broods beneath a sky of ash.</p>");
    await expect(page.locator("#notesBody")).toHaveText("Kelmora broods beneath a sky of ash.");
    await expect(page.locator("#notesLegend")).toHaveText("Kelmora broods beneath a sky of ash.");

    await edit.locator("button").click();
    await expect(edit).toContainText("undone");
    expect(await page.evaluate(() => (window as any).notes.find((n: any) => n.id === "burg1").legend)).toBe("<p>Old text.</p>");
    await expect(page.locator("#notesBody")).toHaveText("Old text.");
  });

  test("a missing key opens the settings drawer instead of sending", async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem("fmg-ai-kl-anthropic"));
    await page.evaluate(() => (window as any).Controllers.HelpAssistant.open({ mode: "map" }));
    await expect(page.locator("#helpMapStatusKey")).toContainText("no key");
    await page.locator("#helpMapInput").fill("hello");
    await page.locator("#helpMapInput").press("Enter");
    await expect(page.locator("#helpMapDrawer")).toBeVisible();
    await expect(page.locator("#helpMapHint")).toBeVisible();
    await expect(page.locator("#helpMapLog .helpMapUser")).toHaveCount(0);

    await stubAnthropic(page, "<p>unused</p>");
    await page.locator("#helpMapKey").fill("sk-test");
    await page.locator("#helpMapInput").press("Enter");
    await expect(page.locator("#helpMapLog .helpMapUser")).toHaveText("hello");
    await expect(page.locator("#helpMapDrawer")).toBeHidden();
  });
});
```

The last test's second send hits the two-call stub: the first completion is a `write_note` with no open editor and no id, so the tool returns an error and the second completion's text is rendered — that is fine for the assertion, which only checks the user message and the drawer.

- [ ] **Step 3: Make sure no server of ours is already on 5199**

Run: `ss -ltnp | grep :5199 || echo free`
Expected: `free`. (If a stale vite is there, kill its `node …/bin/vite` child and re-check.)

- [ ] **Step 4: Run**

Run: `CHROMIUM_PATH=/run/current-system/sw/bin/chromium npx playwright test --config playwright.local.config.ts tests/e2e/help-assistant-ai.spec.ts --reporter=line 2>&1 | tail -30`
Expected: 4 passed. On a failure, read the trace/screenshot in `test-results/` before touching code; a CORS-blocked stub shows as "unreachable"/"Failed to fetch" text in the log — add the missing header to `CORS`.

- [ ] **Step 5: Stop the server and commit**

Run: `ss -ltnp | grep :5199` — if the vite child is still listening (reuseExistingServer keeps Playwright's own one only for the run), kill it by pid. Then:

```bash
git add playwright.local.config.ts tests/e2e/help-assistant-ai.spec.ts
git commit --no-verify -m "test(e2e): assistant dialog — help first, note editing with undo, key drawer"
```

Tick the "browser scenarios 1–5" line in the spec checklist (scenario 4 is inside the third test).

---

### Task 10: Merge the Quill branch and re-implement the bridge over Quill

**Precondition:** the Quill agent (session `fantasy-map-generator-39`) has reported that `feat/notes-editor-quill` in `~/dev/fmg-quill` builds (tsc + vitest). If it has not by the time Tasks 1–9 are done, skip to Task 11 and record the skip in the report; this task can run later on the same branch.

**Files:**
- Merge: branch `feat/notes-editor-quill` (a local branch of the same repository; check `git branch --list feat/notes-editor-quill`)
- Conflicts expected: `package.json`, `package-lock.json`, `src/services/versioning.ts`, `src/types/global.ts` (their `tinymce` deletion vs nothing), `src/controllers/notes-rich-text.ts` (add/add — take theirs), `src/controllers/notes-editor.ts` (their rewrite vs the bridge — resolve by hand)
- Modify: `src/controllers/notes-editor.ts` (bridge over Quill), `src/controllers/notes-editor.test.ts`
- Regenerate: `src/services/agent/context.generated.ts`

- [ ] **Step 1: Merge**

Run: `git merge --no-commit feat/notes-editor-quill`
Then resolve:
- `src/controllers/notes-rich-text.ts`: `git checkout feat/notes-editor-quill -- src/controllers/notes-rich-text.ts` (theirs is the real module and exports `canEditAsRichText` with the same signature). Delete our `notes-rich-text.test.ts` only if theirs covers the same cases (`git show feat/notes-editor-quill --stat | grep notes-rich-text`); otherwise keep both.
- `package.json` / `package-lock.json`: keep both sides' dependencies (theirs adds `quill`; ours has the fork's devDependencies such as `flatqueue`). After resolving `package.json`, run `npm install --package-lock-only && npm ci` to rebuild the lockfile from the merged manifest.
- `src/types/global.ts`: accept their `tinymce` deletion.
- `src/services/versioning.ts`: keep the fork's version string; keep their what's-new line if any.
- `src/controllers/notes-editor.ts`: start from THEIR file (it is the Quill controller) and re-add the bridge as in Step 2.

- [ ] **Step 2: Bridge over Quill**

In the merged `notes-editor.ts` (which has a module-scope `quill: Quill | null`, `loadNote(note)`, `updateLegend()`, `updateNotesBox(note)`, and the raw-mode textarea `#notesSource`):

```ts
function current(): Note | null {
  if (!isOpen()) return null;
  const id = ensureEl<HTMLSelectElement>("notesSelect").value;
  return (notes as Note[]).find(note => note.id === id) ?? null;
}

function write(id: string, legend: string, name?: string): Note {
  const list = notes as Note[];
  let note = list.find(note => note.id === id);
  if (note) {
    note.legend = legend;
    if (name !== undefined) note.name = name;
  } else {
    note = { id, name: name ?? id, legend };
    list.push(note);
    if (isOpen()) ensureEl<HTMLSelectElement>("notesSelect").options.add(new Option(id, id));
  }
  if (current()?.id === id) {
    ensureEl<HTMLInputElement>("notesName").value = note.name;
    loadNote(note); // the AI-generator apply path: silent Quill load or raw textarea, per representability
    updateNotesBox(note);
  }
  return note;
}

function getSelectionHtml(): string | null {
  if (!isOpen() || !quill || !ensureEl("notesSource").hidden === false) return null;
  const range = quill.getSelection();
  if (!range || !range.length) return null;
  return quill.getSemanticHTML(range.index, range.length);
}
```

(`remove` is unchanged from Task 4. Check the exact raw-mode marker in their controller — the Quill agent described raw mode as "`#notesSource` not hidden" — and adjust the guard to whatever they shipped.)

- [ ] **Step 3: Update the bridge unit test for Quill**

In `src/controllers/notes-editor.test.ts` drop the `w.tinymce` stub. Quill needs a real DOM with `getSelection`; under jsdom `new Quill(host)` works for `setContents`/`getSemanticHTML` but `getSelection` returns null, so:
- keep the closed-editor tests as they are;
- in the open-editor tests assert `#notesBody` innerHTML and `.ql-editor` text (`document.querySelector("#notesLegend .ql-editor")?.textContent`) instead of `#notesLegend.innerHTML`;
- add one test: `getSelectionHtml()` is `null` when nothing is selected.

Run: `npx vitest run src/controllers/ && npx tsc --noEmit` → pass; silent.

- [ ] **Step 4: Regenerate the agent context and rerun everything**

Run: `npm run generate:agent-context && npx vitest run --reporter=dot 2>&1 | tail -4 && npx tsc --noEmit`

- [ ] **Step 5: Rerun the browser spec**

The Quill editor no longer needs the `azgaar.github.io` abort route (harmless to keep). In the spec, change the `#notesLegend` assertion to `page.locator("#notesLegend .ql-editor")` and rerun Task 9 Step 4. Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/types/global.ts src/services/versioning.ts src/controllers/notes-editor.ts src/controllers/notes-editor.test.ts src/controllers/notes-rich-text.ts src/services/agent/context.generated.ts tests/e2e/help-assistant-ai.spec.ts
git commit --no-verify -m "Merge feat/notes-editor-quill; notes bridge over Quill"
```

Tick "Quill branch merged; bridge re-implemented over Quill; scenarios rerun" in the spec checklist.

---

### Task 11: Final verification and hand-off

- [ ] **Step 1: Format and stamp**

Run: `npx biome check src public/main.js tests/e2e/help-assistant-ai.spec.ts playwright.local.config.ts 2>&1 | tail -20`
Expected: no errors (apply `npx biome check --write <files>` for pure formatting diffs, then re-run). Then `npm run stamp-assets` and `git status --short` — if `src/index.html` changed, commit it: `git commit --no-verify -m "chore: stamp assets"`.

- [ ] **Step 2: Full run**

Run: `npx tsc --noEmit && npx vitest run --reporter=dot 2>&1 | tail -4`
Expected: silent; every file green. Record the counts.

- [ ] **Step 3: Tick the spec checklist and commit**

Mark every completed line in `docs/superpowers/specs/2026-09-05-help-assistant-ai-merger-design.md`'s checklist, note anything skipped (e.g. Task 10 if the Quill branch was not ready) with a one-line reason, and commit: `git commit --no-verify -m "docs: verification checklist"`.

- [ ] **Step 4: Memory note**

Write `~/.claude/projects/-home-barrulus-dev-Fantasy-Map-Generator/memory/help_assistant_ai_merger_state.md` (type project) with: worktree path and branch, what landed, test counts, whether Quill merged, and the next step (user review of the build; nothing pushed). Add its line to `MEMORY.md` under Active work.

- [ ] **Step 5: Report**

Final message to the user: where the worktree is, how to try it (`cd .claude/worktrees/help-assistant-ai && npx vite --port 5199`, open the "?" bubble, Tools → Assistant, notes editor robot button), what was verified and how, what was skipped, and the decisions marked *(decision)* in the spec that they may want to revisit.
