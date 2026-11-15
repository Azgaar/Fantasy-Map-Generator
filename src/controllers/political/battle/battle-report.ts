// The battle as one offline page: its summary, and a keyframe of the field at each key moment with its log lines

import { type Battle, Battles, type LogEntry, type LogEvent, ROUND_TICKS } from "@/model/political/battle/battle";
import { BattleScale } from "@/model/political/battle/battle-scale";
import { Keyframes } from "@/model/political/battle/keyframes";
import { BattleCamera } from "@/renderers/battle/battle-camera";
import { BattleOverlayView, OVERLAY_HEIGHT, OVERLAY_WIDTH } from "@/renderers/draw-battle-overlay";
import { BattleSceneView, type Trails } from "@/renderers/draw-battle-scene";
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
      Battles.replay(probe.battle, probe.script);
      const ticks = Keyframes.select(probe.battle.log, text.kinds);
      const frames = await this.takeKeyframes(source, choice, new Set(ticks), signal, share => onProgress(share, ""));
      if (!frames) {
        onProgress(0, t("Cancelled"));
        return false;
      }
      const file = new Blob([this.writeReport(source, text, text.summary(probe.battle), frames)], {
        type: "text/html"
      });
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
  ): Promise<Keyframe[] | null> {
    const { battle, script } = source.start();
    Battles.applyDue(battle, script);
    Battles.plan(battle);
    const stage = BattleAnimation.createStage(battle, source, choice.camera);
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
        BattleSceneView.updateBlocks(stage.svg, battle, null, 1);
        const troops = BattleCamera.toCameraTroops(battle.blocks);
        const view =
          choice.camera === "field" ? BattleCamera.getFieldView(field) : BattleCamera.frameTroops(field, troops);
        BattleSceneView.setView(stage.svg, field, view);
        BattleSceneView.drawArrows(stage.svg, battle, frames.length ? trails : null);
        const clock = BattleScale.formatClock(battle.tick);
        BattleOverlayView.draw(stage.overlay, { title: source.title, clock, viewWidth: view.width, look: source.look });
        const content = BattleAnimation.markup([...stage.svg.children]);
        const box = [view.x, view.y, view.width, view.height].map(value => value.toFixed(1)).join(" ");
        const svg = `<svg viewBox="0 0 ${OVERLAY_WIDTH} ${OVERLAY_HEIGHT}" font-family="Georgia, serif"><svg viewBox="${box}" width="${OVERLAY_WIDTH}" height="${OVERLAY_HEIGHT}">${content}</svg>${BattleAnimation.markup([...stage.overlay.children])}</svg>`;
        const lines = battle.log.slice(logged);
        logged = battle.log.length;
        frames.push({ clock, svg, lines });
        trails = new Map(battle.blocks.map(block => [block.id, [[block.x, block.y] as Point]]));
      }
      if (battle.result || battle.tick >= end) break;
      if (signal.aborted) return null;
      const blocks = battle.blocks.length;
      Battles.applyDue(battle, script);
      if (battle.blocks.length !== blocks) stage.placeBlocks(); // a recorded reinforcement
      Battles.tick(battle);
      if (battle.tick % 20 === 0) {
        onProgress(battle.tick / end);
        await new Promise(resolve => setTimeout(resolve));
      }
    }
    return frames;
  }

  private writeReport(source: BattleSource, text: ReportText, summary: string, frames: Keyframe[]): string {
    const figures = frames
      .map(({ clock, svg, lines }) => {
        const entries = lines
          .map(
            entry =>
              `<div><i>${BattleScale.formatClock(entry.tick)}</i><u style="${text.marks(entry)}"></u><span>${escapeHtml(text.describe(entry))}</span></div>`
          )
          .join("");
        return `<figure>${svg}<figcaption><b>${clock}</b>${entries}</figcaption></figure>`;
      })
      .join("");
    const body = `<main class="report"><header><h1>${escapeHtml(source.title)}</h1><p>${escapeHtml(text.heading)}</p></header>
      <div id="battleSummary">${summary}</div>${figures}</main>`;
    const symbols = this.collectSymbols(body);
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escapeHtml(source.title)}</title><style>${text.style}${PAGE_STYLE}</style></head>
      <body><svg width="0" height="0" style="position: absolute" aria-hidden="true"><defs>${symbols}</defs></svg>${body}</body></html>`;
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
