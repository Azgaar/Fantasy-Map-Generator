// The battle as one offline page: its summary, and a keyframe of the field at each key moment with its log lines

import {
  applyDue,
  type Battle,
  type LogEntry,
  type LogEvent,
  plan,
  ROUND_TICKS,
  replay,
  tick
} from "@/model/political/battle/battle";
import { formatClock } from "@/model/political/battle/battle-scale";
import { selectKeyframes } from "@/model/political/battle/keyframes";
import { frameTroops, getFieldView, toCameraTroops } from "@/renderers/battle-camera";
import { drawBattleOverlay, OVERLAY_HEIGHT, OVERLAY_WIDTH } from "@/renderers/draw-battle-overlay";
import { drawArrows, setView, type Trails, updateBlocks } from "@/renderers/draw-battle-scene";
import type { Point } from "@/types/global";
import { downloadFile } from "@/utils/file-utils";
import { t } from "@/utils/i18n";
import { log } from "@/utils/logger";
import { escapeHtml } from "@/utils/string-utils";
import {
  type BattleSource,
  createStage,
  type ExportChoice,
  formatSize,
  markup,
  type Progress
} from "./battle-animation";

/** What a report says besides the field: the screen words it */
export interface ReportText {
  heading: string; // the date and the place
  summary: (battle: Battle) => string; // the battle summary's markup
  style: string; // and its style
  describe: (entry: LogEntry) => string; // a log line, as the screen shows it
  marks: (entry: LogEntry) => string; // the side mark beside it
  kinds: LogEvent[]; // the moments chosen to pause at
}

interface Keyframe {
  clock: string;
  svg: string;
  lines: LogEntry[];
}

/** Replay the battle from its start and download the report; false when stopped */
export async function saveReport(
  source: BattleSource,
  text: ReportText,
  choice: ExportChoice,
  signal: AbortSignal,
  onProgress: Progress
): Promise<boolean> {
  onProgress(0, "");
  try {
    const probe = source.start();
    replay(probe.battle, probe.script);
    const ticks = selectKeyframes(probe.battle.log, text.kinds);
    const frames = await takeKeyframes(source, choice, new Set(ticks), signal, share => onProgress(share, ""));
    if (!frames) {
      onProgress(0, t("Cancelled"));
      return false;
    }
    const file = new Blob([writeReport(source, text, text.summary(probe.battle), frames)], { type: "text/html" });
    downloadFile(file, `${source.fileName}-report.html`, file.type);
    onProgress(1, t("Saved: {{size}}", { size: formatSize(file.size) }));
    return true;
  } catch (error) {
    log.error(error);
    onProgress(0, t("Cannot make the report"));
    return false;
  }
}

async function takeKeyframes(
  source: BattleSource,
  choice: ExportChoice,
  keys: Set<number>,
  signal: AbortSignal,
  onProgress: (share: number) => void
): Promise<Keyframe[] | null> {
  const { battle, script } = source.start();
  applyDue(battle, script);
  plan(battle);
  const stage = createStage(battle, source, choice.camera);
  stage.placeBlocks();
  const end = Math.max(...keys);
  const frames: Keyframe[] = [];
  let trails: Trails = new Map();
  let logged = 0;

  for (;;) {
    if (battle.tick % ROUND_TICKS === 0) {
      for (const block of battle.blocks) trails.set(block.id, [...(trails.get(block.id) ?? []), [block.x, block.y]]);
    }
    if (keys.has(battle.tick)) {
      const { field } = battle;
      updateBlocks(stage.svg, battle, null, 1);
      const troops = toCameraTroops(battle.blocks);
      const view = choice.camera === "field" ? getFieldView(field) : frameTroops(field, troops);
      setView(stage.svg, field, view);
      drawArrows(stage.svg, battle, frames.length ? trails : null);
      const clock = formatClock(battle.tick);
      drawBattleOverlay(stage.overlay, { title: source.title, clock, viewWidth: view.width, look: source.look });
      const content = markup([...stage.svg.children]);
      const box = [view.x, view.y, view.width, view.height].map(value => value.toFixed(1)).join(" ");
      const svg = `<svg viewBox="0 0 ${OVERLAY_WIDTH} ${OVERLAY_HEIGHT}" font-family="Georgia, serif"><svg viewBox="${box}" width="${OVERLAY_WIDTH}" height="${OVERLAY_HEIGHT}">${content}</svg>${markup([...stage.overlay.children])}</svg>`;
      const lines = battle.log.slice(logged);
      logged = battle.log.length;
      frames.push({ clock, svg, lines });
      trails = new Map(battle.blocks.map(block => [block.id, [[block.x, block.y] as Point]]));
    }
    if (battle.result || battle.tick >= end) break;
    if (signal.aborted) return null;
    const blocks = battle.blocks.length;
    applyDue(battle, script);
    if (battle.blocks.length !== blocks) stage.placeBlocks(); // a recorded reinforcement
    tick(battle);
    if (battle.tick % 20 === 0) {
      onProgress(battle.tick / end);
      await new Promise(resolve => setTimeout(resolve));
    }
  }
  return frames;
}

const PAGE_STYLE = /* css */ `
  body { --serif: Georgia, serif; max-width: 60em; margin: 0 auto; padding: 1em; font: 14px/1.4 sans-serif; color: #222; background: #fff; }
  .report > header { text-align: center; }
  .report h1 { margin: 0.2em 0; font-family: var(--serif); }
  .report > header > p { margin: 0; color: #666; }
  #battleSummary { position: static; display: block; padding: 0; background: none; overflow: visible; animation: none; }
  #battleSummary > div { width: auto; box-shadow: none; animation: none; }
  .battleSummaryClose, #battleSummary footer { display: none !important; }
  .report figure { margin: 1.5em 0; break-inside: avoid; }
  .report figure > svg { display: block; width: 100%; height: auto; outline: 1px solid #999; }
  .report figcaption { margin-top: 0.4em; }
  .report figcaption > b { font-variant-numeric: tabular-nums; }
  .report figcaption > div { display: grid; grid-template-columns: 4em 0.6em minmax(0, 1fr); gap: 0 0.4em; align-items: baseline; }
  .report figcaption > div > i { color: #666; font-style: normal; font-variant-numeric: tabular-nums; text-align: right; }
  .report figcaption > div > u { width: 0.6em; height: 0.6em; background: var(--side, transparent); }
`;

function writeReport(source: BattleSource, text: ReportText, summary: string, frames: Keyframe[]): string {
  const figures = frames
    .map(({ clock, svg, lines }) => {
      const entries = lines
        .map(
          entry =>
            `<div><i>${formatClock(entry.tick)}</i><u style="${text.marks(entry)}"></u><span>${escapeHtml(text.describe(entry))}</span></div>`
        )
        .join("");
      return `<figure>${svg}<figcaption><b>${clock}</b>${entries}</figcaption></figure>`;
    })
    .join("");
  const body = `<main class="report"><header><h1>${escapeHtml(source.title)}</h1><p>${escapeHtml(text.heading)}</p></header>
    <div id="battleSummary">${summary}</div>${figures}</main>`;
  const symbols = collectSymbols(body);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(source.title)}</title><style>${text.style}${PAGE_STYLE}</style></head>
    <body><svg width="0" height="0" style="position: absolute" aria-hidden="true"><defs>${symbols}</defs></svg>${body}</body></html>`;
}

const REFERENCE = /(?:href="#|url\(#)([^")]+)/g;

/** The page's symbols the report refers to, unit icons and emblems, and what they refer to in turn */
function collectSymbols(html: string): string {
  const defined = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]));
  const found = new Map<string, string>();
  const queue = [html];
  while (queue.length) {
    for (const [, id] of queue.pop()!.matchAll(REFERENCE)) {
      if (defined.has(id) || found.has(id)) continue;
      const element = document.getElementById(id);
      const symbol = element ? markup([element]) : "";
      found.set(id, symbol);
      if (symbol) queue.push(symbol);
    }
  }
  return [...found.values()].join("");
}
