// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const discovery = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/components/map-commands", () => ({ MAP_COMMANDS: [], isLinkable: () => false })); // its import touches the DOM
vi.mock("./map", () => ({
  AssistantMap: {
    id: () => 1,
    name: () => "Test map",
    context: async () => "# Current map",
    tools: () => [],
    canUndo: () => true,
    undo: async () => "undone"
  }
}));
vi.mock("@/controllers", () => ({ Controllers: { NotesEditor: { current: async () => null } } }));
vi.mock("@/services/assistant/provider/models", async importOriginal => ({
  ...(await importOriginal<typeof import("@/services/assistant/provider/models")>()),
  listModels: discovery.list
}));

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  discovery.list.mockReset().mockResolvedValue([]);
  document.body.innerHTML = '<div id="dialogs"></div>';
  vi.stubGlobal("ldb", { get: vi.fn(async () => []), set: vi.fn(async () => {}) });
  window.$ = vi.fn(() => ({ dialog: vi.fn() })) as unknown as typeof window.$;
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

async function openSheet(): Promise<void> {
  const { Assistant } = await import("./index");
  Assistant.open();
  await vi.waitFor(() => expect(document.getElementById("assistantAccount")?.textContent).toContain("key"));
  click("Use key");
}

function click(text: string): void {
  const control = [...document.querySelectorAll("button")].find(button => button.textContent === text);
  expect(control).toBeDefined();
  control!.click();
}

function enterKey(value: string): void {
  const key = document.getElementById("assistantApiKey") as HTMLInputElement;
  key.value = value;
  key.dispatchEvent(new Event("input"));
}

it("does not save a draft local address when the key sheet is cancelled", async () => {
  localStorage.setItem("fmg-ai-local-url", "http://localhost:8080/v1");
  await openSheet();
  const provider = document.getElementById("assistantProvider") as HTMLSelectElement;
  expect(provider.querySelector('option[value="local"]')?.textContent).toBe("Local");
  provider.value = "local";
  provider.dispatchEvent(new Event("change"));
  const server = document.getElementById("assistantLocalUrl") as HTMLInputElement;
  server.value = "http://localhost:9000/v1";
  server.dispatchEvent(new Event("input"));
  await vi.waitFor(() => expect(discovery.list).toHaveBeenCalledWith("local", "", "http://localhost:9000/v1"));
  click("Cancel");
  expect(localStorage.getItem("fmg-ai-local-url")).toBe("http://localhost:8080/v1");
});

it("ignores an old key's discovery error after a new key succeeds", async () => {
  let rejectOld!: (error: Error) => void;
  discovery.list.mockImplementation((_provider, key) =>
    key === "old-key"
      ? new Promise((_resolve, reject) => {
          rejectOld = reject;
        })
      : Promise.resolve(["claude-test"])
  );
  await openSheet();
  enterKey("old-key");
  await vi.waitFor(() => expect(rejectOld).toBeDefined());
  enterKey("new-key");
  await vi.waitFor(() => expect(document.querySelector("#assistantModels option")?.textContent).toBe("claude-test"));
  rejectOld(new Error("Old key rejected"));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(document.getElementById("assistantDiscoveryError")?.textContent).toBe("");
});

it("does not start pending discovery after leaving the key sheet", async () => {
  await openSheet();
  enterKey("draft-key");
  click("Cancel");
  await new Promise(resolve => setTimeout(resolve, 400));
  expect(discovery.list).not.toHaveBeenCalled();
});
