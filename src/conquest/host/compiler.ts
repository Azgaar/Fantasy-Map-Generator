/**
 * compiler.ts — compile the loaded world, off the main thread when possible.
 *
 * Compiling a 20k-cell world is ~1s of straight-line arithmetic. On the main
 * thread that is a visible freeze: the map stops responding to pans mid-compile,
 * which reads as a crash rather than as work. So the work goes to a Worker.
 *
 * The constraint that makes this interesting: the mod ships as ONE module, so
 * there is no second file to point a Worker at. The Worker is therefore a Blob
 * whose source is `import("<our own URL>")` — it loads this very bundle, finds
 * the engine on its global scope, and calls back into it (see
 * engine/compile/worker-protocol.ts).
 *
 * If any of that is unavailable — no `Worker`, no `Blob`, a CSP that forbids blob
 * workers, or a browser that refuses the import — the compile falls back to the
 * main thread rather than failing. A campaign that takes a second longer to start
 * is a far better outcome than a mod that refuses to compile.
 */

import type { MapPack } from "../engine/common/types";
import type { FmgWorldSnapshot } from "../engine/compile/from-fmg";
import { type CompileResponse, compileWorkerSource, handleRequest } from "../engine/compile/worker-protocol";
import { twWarn } from "../ui/fmg";

export interface CompileResult {
  pack: MapPack;
  contentHash: string;
  elapsedMs: number;
  /** "worker" | "main" — reported so the UI can be honest about the fallback. */
  ran: "worker" | "main";
}

interface Pending {
  resolve: (result: CompileResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * How long a compile may take before we call it dead.
 *
 * Without this a worker that never answers leaves the promise pending forever and
 * the campaign layer silently off — the hardest failure to notice. A timeout turns
 * "nothing happens" into a reported error, and the main-thread path still has a
 * way through.
 */
const COMPILE_TIMEOUT_MS = 120_000;

/** This module's own URL — the Worker imports it. */
function modUrl(): string | null {
  try {
    // Preserved by the bundler; the one honest way to know where we were loaded from.
    const url = import.meta.url;
    return typeof url === "string" && url.startsWith("http") ? url : null;
  } catch {
    return null;
  }
}

let worker: Worker | null = null;
let workerFailed = false;
let nextId = 1;
const pending = new Map<number, Pending>();

/** Start (or reuse) the compile worker. Null when it cannot be used. */
function ensureWorker(): Worker | null {
  if (workerFailed) return null;
  if (worker) return worker;

  const url = modUrl();
  if (
    !url ||
    typeof Worker === "undefined" ||
    typeof Blob === "undefined" ||
    typeof URL?.createObjectURL !== "function"
  ) {
    workerFailed = true;
    return null;
  }

  try {
    const blob = new Blob([compileWorkerSource(url)], { type: "text/javascript" });
    const created = new Worker(URL.createObjectURL(blob));
    created.onmessage = (event: MessageEvent<CompileResponse>) => {
      const message = event.data;
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      clearTimeout(entry.timer);
      if (!message.ok || !message.pack || !message.contentHash) {
        entry.reject(new Error(message.error ?? "compile failed"));
        return;
      }
      entry.resolve({
        pack: message.pack,
        contentHash: message.contentHash,
        elapsedMs: message.elapsedMs ?? 0,
        ran: "worker"
      });
    };
    created.onerror = event => {
      // A worker that cannot even start (CSP, unsupported import) must not leave
      // every pending compile hanging forever.
      twWarn("compile worker failed — falling back to the main thread", event.message ?? event);
      workerFailed = true;
      worker = null;
      for (const [, entry] of pending) {
        clearTimeout(entry.timer);
        entry.reject(new Error("worker unavailable"));
      }
      pending.clear();
    };
    worker = created;
    return worker;
  } catch (error) {
    twWarn("compile worker unavailable — falling back to the main thread", error);
    workerFailed = true;
    return null;
  }
}

/** Compile on the main thread. Same code the worker runs; just not off-thread. */
function compileOnMainThread(request: {
  id: number;
  type: "compile";
  snapshot: FmgWorldSnapshot;
}): Promise<CompileResult> {
  return new Promise((resolve, reject) => {
    // Yield once first, so the caller's paint lands before we block the thread.
    setTimeout(() => {
      const response = handleRequest(request);
      if (!response.ok || !response.pack || !response.contentHash) {
        reject(new Error(response.error ?? "compile failed"));
        return;
      }
      resolve({
        pack: response.pack,
        contentHash: response.contentHash,
        elapsedMs: response.elapsedMs ?? 0,
        ran: "main"
      });
    }, 0);
  });
}

/** Compile a world snapshot into a map pack. */
export function compileSnapshot(snapshot: FmgWorldSnapshot): Promise<CompileResult> {
  const active = ensureWorker();
  const request = { id: nextId++, type: "compile" as const, snapshot };

  if (!active) return compileOnMainThread(request);

  return new Promise<CompileResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(request.id);
      // Fall back rather than fail: a second attempt on this thread is slower
      // but always completes, and the player gets their campaign.
      twWarn("compile worker timed out — retrying on the main thread");
      compileOnMainThread(request).then(resolve, reject);
    }, COMPILE_TIMEOUT_MS);
    pending.set(request.id, { resolve, reject, timer });
    try {
      active.postMessage(request);
    } catch (error) {
      pending.delete(request.id);
      clearTimeout(timer);
      // A snapshot that will not clone is a real error (too big, or a function
      // leaked in) — report it rather than silently retrying on this thread.
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/** Stop the worker (used by `TotalWar.dispose`). */
export function disposeCompiler(): void {
  worker?.terminate();
  worker = null;
  for (const [, entry] of pending) {
    clearTimeout(entry.timer);
    entry.reject(new Error("compiler disposed"));
  }
  pending.clear();
}
