// The battle as one offline page: its summary, and a keyframe of the field at each key moment with its log lines

import { type Battle, Battles, type LogEntry, type LogEvent, ROUND_TICKS } from "@/model/political/battle/battle";
import { Keyframes } from "@/model/political/battle/keyframes";
import { BattleTime } from "@/model/political/battle/time";
import { BattleCamera } from "@/renderers/battle/battle-camera";
import { BattleOverlayView, OVERLAY_HEIGHT, OVERLAY_WIDTH } from "@/renderers/battle/draw-battle-overlay";
import { BattleSceneView, MOVING_LAYERS, type Trails } from "@/renderers/battle/draw-battle-scene";
import type { Point } from "@/types/global";
import { downloadFile } from "@/utils/file-utils";
import { t } from "@/utils/i18n";
import { log } from "@/utils/logger";
import { escapeHtml } from "@/utils/string-utils";
import { BattleAnimation, type BattleSource, type ExportChoice, type Progress } from "./battle-animation";

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

const REFERENCE = /(?:href="#|url\(#)([^")]+)/g;
const UNSEEN = ["battleWorkTips", "battleWallTips"]; // the screen's pointer targets
const SHARED_SIZE = 2000; // characters of a still layer that keyframes draw from one copy in the page

/** The still layers of the keyframes, kept once in the page by their markup, and the field's definitions */
interface Shared {
  layers: Map<string, string>; // markup to the id it is used by
  defs: string;
}

class BattleReportExport {
  /** Replay the battle from its start and download the report; false when stopped */
  async save(
    source: BattleSource,
    text: ReportText,
    choice: ExportChoice,
    signal: AbortSignal,
    onProgress: Progress
  ): Promise<boolean> {
    onProgress(0, "");
    try {
      const probe = source.start();
      Battles.replay(probe.battle, probe.script, probe.settled, probe.until);
      const ticks = Keyframes.select(probe.battle.log, text.kinds);
      if (!probe.battle.result) ticks.push(probe.battle.tick); // a past battle applied before its end ends there
      const taken = await this.takeKeyframes(source, choice, new Set(ticks), signal, share => onProgress(share, ""));
      if (!taken) {
        onProgress(0, t("Cancelled"));
        return false;
      }
      const { frames, shared } = taken;
      const page = this.writeReport(source, text, text.summary(probe.battle), frames, shared, probe.battle.hour);
      const file = new Blob([page], { type: "text/html" });
      downloadFile(file, `${source.fileName}-report.html`, file.type);
      onProgress(1, t("Saved: {{size}}", { size: BattleAnimation.formatSize(file.size) }));
      return true;
    } catch (error) {
      log.error(error);
      onProgress(0, t("Cannot make the report"));
      return false;
    }
  }

  private async takeKeyframes(
    source: BattleSource,
    choice: ExportChoice,
    keys: Set<number>,
    signal: AbortSignal,
    onProgress: (share: number) => void
  ): Promise<{ frames: Keyframe[]; shared: Shared } | null> {
    const { battle, script, settled } = source.start();
    Battles.applyDue(battle, script);
    Battles.plan(battle, settled);
    const stage = BattleAnimation.createStage(battle, source, choice.camera);
    const end = Math.max(...keys);
    const frames: Keyframe[] = [];
    const shared: Shared = { layers: new Map(), defs: "" };
    let trails: Trails = new Map();
    let logged = 0;

    for (;;) {
      if (battle.tick % ROUND_TICKS === 0) {
        for (const battalion of battle.battalions)
          trails.set(battalion.id, [...(trails.get(battalion.id) ?? []), [battalion.x, battalion.y]]);
      }
      if (keys.has(battle.tick)) {
        const { field } = battle;
        stage.placeBattalions(); // drawn anew, reinforcements too: those destroyed since the last keyframe are gone
        const troops = BattleCamera.toCameraTroops(battle.battalions);
        const view =
          choice.camera === "field" ? BattleCamera.getSceneBox(field) : BattleCamera.frameTroops(field, troops);
        BattleSceneView.setView(stage.svg, field, view);
        BattleSceneView.drawLight(stage.svg, battle); // the hour of the keyframe
        BattleSceneView.drawArrows(stage.svg, battle, frames.length ? trails : null);
        const clock = BattleTime.formatClock(battle.hour, battle.tick);
        BattleOverlayView.draw(stage.overlay, { title: source.title, clock, viewWidth: view.width, look: source.look });
        const content = [...stage.svg.children].map(node => this.share(node, shared)).join("");
        const box = [view.x, view.y, view.width, view.height].map(value => value.toFixed(1)).join(" ");
        const svg = `<svg viewBox="0 0 ${OVERLAY_WIDTH} ${OVERLAY_HEIGHT}" font-family="Georgia, serif"><svg viewBox="${box}" width="${OVERLAY_WIDTH}" height="${OVERLAY_HEIGHT}">${content}</svg>${BattleAnimation.markup([...stage.overlay.children])}</svg>`;
        const lines = battle.log.slice(logged);
        logged = battle.log.length;
        frames.push({ clock, svg, lines });
        trails = new Map(battle.battalions.map(battalion => [battalion.id, [[battalion.x, battalion.y] as Point]]));
      }
      if (battle.result || battle.tick >= end) break;
      if (signal.aborted) return null;
      Battles.applyDue(battle, script);
      Battles.tick(battle);
      if (battle.tick % 20 === 0) {
        onProgress(battle.tick / end);
        await new Promise(resolve => setTimeout(resolve));
      }
    }
    return { frames, shared };
  }

  /** A layer as a keyframe draws it: a big still one by a use of its one copy */
  private share(node: Element, shared: Shared): string {
    if (node.getAttribute("display") === "none" || UNSEEN.includes(node.id)) return "";
    const markup = BattleAnimation.markup([node]);
    if (node.tagName === "defs") {
      const content = BattleAnimation.markup([...node.children]);
      shared.defs ||= content; // found by their ids anywhere in the page
      return content === shared.defs ? "" : markup;
    }
    if (markup.length < SHARED_SIZE || MOVING_LAYERS.includes(node.id)) return markup;
    if (!shared.layers.has(markup)) shared.layers.set(markup, `reportLayer${shared.layers.size}`);
    return `<use href="#${shared.layers.get(markup)}"/>`;
  }

  private writeReport(
    source: BattleSource,
    text: ReportText,
    summary: string,
    frames: Keyframe[],
    shared: Shared,
    hour: number
  ): string {
    const figures = frames
      .map(({ clock, svg, lines }) => {
        const entries = lines
          .map(
            entry =>
              `<div><i>${BattleTime.formatClock(hour, entry.tick)}</i><u style="${text.marks(entry)}"></u><span>${escapeHtml(text.describe(entry))}</span></div>`
          )
          .join("");
        return `<figure>${svg}<figcaption><b>${clock}</b>${entries}</figcaption></figure>`;
      })
      .join("");
    const body = `<main class="report"><header><h1>${escapeHtml(source.title)}</h1><p>${escapeHtml(text.heading)}</p></header>
      <div id="battleSummary">${summary}</div>${figures}</main>`;
    const layers = [...shared.layers].map(([markup, id]) => `<g id="${id}">${markup}</g>`).join("");
    const defs = shared.defs + layers;
    const symbols = this.collectSymbols(body + defs);
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escapeHtml(source.title)}</title><style>${text.style}${PAGE_STYLE}</style></head>
      <body><svg width="0" height="0" style="position: absolute" aria-hidden="true"><defs>${defs}${symbols}</defs></svg>${body}</body></html>`;
  }

  /** The page's symbols the report refers to, unit icons and emblems, and what they refer to in turn */
  private collectSymbols(html: string): string {
    const defined = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]));
    const found = new Map<string, string>();
    const queue = [html];
    while (queue.length) {
      for (const [, id] of queue.pop()!.matchAll(REFERENCE)) {
        if (defined.has(id) || found.has(id)) continue;
        const element = document.getElementById(id);
        const symbol = element ? BattleAnimation.markup([element]) : "";
        found.set(id, symbol);
        if (symbol) queue.push(symbol);
      }
    }
    return [...found.values()].join("");
  }
}

export const BattleReport = new BattleReportExport();
