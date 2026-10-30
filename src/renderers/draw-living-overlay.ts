// Transient on-map juice for the Living HUD: army/raid vectors, floating outcome
// badges and clickable bounty popups. See docs/plans/living-idle-guild.md (slice 1).
import { Living } from "@/model/physical/living-generator";
import type { LivingNewsItem, LivingPopup, LivingPopupKind, LivingWorldState } from "@/types/living";
import { escapeHtml } from "@/utils";

const SVG_NS = "http://www.w3.org/2000/svg";
const OVERLAY_ID = "livingOverlay";
const STYLE_ID = "livingOverlayStyle";
const MAX_BADGES = 5;

const POPUP_META: Record<LivingPopupKind, { icon: string; color: string }> = {
  bounty_trouble: { icon: "📜", color: "#b8860b" },
  bounty_lair: { icon: "🏰", color: "#8b0000" },
  ascension_warning: { icon: "👑", color: "#6a4c93" },
  relic_exposed: { icon: "💎", color: "#2a7f7a" },
  guild_petition: { icon: "⚖️", color: "#444a8a" }
};

const NEWS_ICONS: Partial<Record<LivingNewsItem["kind"], string>> = {
  war: "🏹",
  battle: "⚔️",
  conquest: "⚔️",
  resist: "🛡️",
  revolt: "🔥",
  succession: "👑",
  build: "🏛️",
  develop: "🏗️",
  muster: "🎖️",
  colonize: "🏳️",
  pacify: "🕊️",
  trouble: "🎲",
  lair: "💀"
};

const NEWS_COLORS: Partial<Record<LivingNewsItem["kind"], string>> = {
  battle: "#a33d3d",
  conquest: "#a33d3d",
  revolt: "#a33d3d",
  lair: "#8b0000",
  trouble: "#b8860b",
  succession: "#6a4c93"
};

const OVERLAY_CSS = /* css */ `
  @keyframes livingFloatUp {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-22px); }
  }
  @keyframes livingPopupPulse {
    0%, 100% { opacity: 0.18; transform: scale(0.85); }
    50% { opacity: 0.4; transform: scale(1.25); }
  }
  @keyframes livingDashFlow {
    to { stroke-dashoffset: -20; }
  }
  @keyframes livingRaidPulse {
    0%, 100% { opacity: 0.45; }
    50% { opacity: 0.95; }
  }
  .livingFloatBadgeInner { animation: livingFloatUp 1.8s ease-out forwards; }
  .livingPopupPulse {
    animation: livingPopupPulse 1.6s ease-in-out infinite;
    transform-box: fill-box;
    transform-origin: center;
  }
  .livingVectorPath { animation: livingDashFlow 1.1s linear infinite; }
  .livingVector-quest .livingVectorPath { animation-duration: 1.6s; }
  .livingVector-raid .livingVectorPath {
    animation: livingDashFlow 1.1s linear infinite, livingRaidPulse 1.4s ease-in-out infinite;
  }
`;

export interface LivingVector {
  id: string;
  kind: "raid" | "war" | "quest";
  from: [number, number];
  to: [number, number];
  color: string;
  label: string;
}

export interface LivingBadge {
  id: string;
  cell: number;
  text: string;
  color: string;
}

const VECTOR_COLORS = { raid: "#8b0000", war: "#a33d3d", quest: "#b8860b" } as const;

function cellPoint(cell: number | undefined): [number, number] | null {
  if (cell === undefined) return null;
  const point = pack?.cells?.p?.[cell];
  return point ? [point[0], point[1]] : null;
}

function burgPoint(burgId: number | undefined): [number, number] | null {
  if (!burgId) return null;
  const burg = pack?.burgs?.[burgId];
  if (!burg?.i || burg.removed) return null;
  return [burg.x, burg.y];
}

function nearestBurgPoint(cell: number, provinceId: number | undefined): [number, number] | null {
  const origin = cellPoint(cell);
  if (!origin || !pack?.burgs?.length) return null;

  let best: [number, number] | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const burg of pack.burgs) {
    if (!burg?.i || burg.removed) continue;
    const sameProvince = provinceId !== undefined && pack.cells.province?.[burg.cell] === provinceId;
    const distance = Math.hypot(burg.x - origin[0], burg.y - origin[1]) * (sameProvince ? 0.5 : 1);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = [burg.x, burg.y];
    }
  }
  return best;
}

/** Raid lines from imminent lairs, war arrows from conquer/reclaim agendas, and hero quest lines. */
export function collectLivingVectors(living: LivingWorldState): LivingVector[] {
  if (!pack?.cells?.p) return [];
  const vectors: LivingVector[] = [];

  for (const pSim of Object.values(living.provinces ?? {})) {
    const lair = pSim?.lair;
    if (!lair?.raidPending) continue;
    const from = cellPoint(lair.cell);
    const to = nearestBurgPoint(lair.cell, pack.cells.province?.[lair.cell]);
    if (!from || !to) continue;
    vectors.push({
      id: `raid-${pSim.provinceId}`,
      kind: "raid",
      from,
      to,
      color: VECTOR_COLORS.raid,
      label: lair.name
    });
  }

  for (const sSim of Object.values(living.states ?? {})) {
    const agenda = sSim?.agenda;
    if (!agenda || (agenda.kind !== "conquer" && agenda.kind !== "reclaim")) continue;
    const state = pack.states?.[sSim.stateId];
    const from = burgPoint(state?.capital) ?? cellPoint(state?.center);
    const to = burgPoint(agenda.targetBurgId);
    if (!from || !to) continue;
    vectors.push({
      id: `war-${sSim.stateId}`,
      kind: "war",
      from,
      to,
      color: state?.color ?? VECTOR_COLORS.war,
      label: state?.name ?? "War"
    });
  }

  const hq = burgPoint(living.guild?.hqBurgId);
  for (const mission of living.guild?.missions ?? []) {
    const to = cellPoint(mission.targetCell);
    if (!hq || !to) continue;
    vectors.push({
      id: `quest-${mission.id}`,
      kind: "quest",
      from: hq,
      to,
      color: VECTOR_COLORS.quest,
      label: `${mission.progress}/${mission.required}`
    });
  }

  return vectors;
}

function badgeIcon(item: LivingNewsItem): string {
  if (/proclaim|ascend|crown|throne/i.test(item.text)) return "👑";
  if (/sack|pillage|raid/i.test(item.text)) return "💀";
  return NEWS_ICONS[item.kind] ?? "✦";
}

/** The outcome badges for the season that just resolved. */
export function collectLivingBadges(living: LivingWorldState): LivingBadge[] {
  const news = (living.recentNews ?? [])
    .filter(item => item.tick === living.tick && item.cell !== undefined)
    .slice(0, MAX_BADGES);

  return news.map((item, index) => ({
    id: `${item.tick}-${index}`,
    cell: item.cell!,
    text: `${badgeIcon(item)} ${item.text}`,
    color: NEWS_COLORS[item.kind] ?? "#5e4fa2"
  }));
}

function vectorMarkup(vector: LivingVector): string {
  const [x1, y1] = vector.from;
  const [x2, y2] = vector.to;
  const dash = vector.kind === "raid" ? "3 3" : "7 4";
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return `<g class="livingVector livingVector-${vector.kind}" pointer-events="none">
    <path class="livingVectorPath" d="M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${vector.color}" stroke-width="1.2" stroke-dasharray="${dash}" stroke-linecap="round" opacity="0.8"/>
    <polygon points="0,-1.7 3.4,0 0,1.7" transform="translate(${x2.toFixed(1)}, ${y2.toFixed(1)}) rotate(${angle.toFixed(1)})" fill="${vector.color}"/>
    <text x="${((x1 + x2) / 2).toFixed(1)}" y="${((y1 + y2) / 2 - 2).toFixed(1)}" text-anchor="middle" font-size="3.6" fill="${vector.color}">${escapeHtml(vector.label)}</text>
  </g>`;
}

function badgeMarkup(badge: LivingBadge): string | null {
  const point = cellPoint(badge.cell);
  if (!point) return null;

  const [x, y] = point;
  const width = Math.min(170, badge.text.length * 2.4 + 8);
  return `<g class="livingFloatBadge" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)})" pointer-events="none">
    <g class="livingFloatBadgeInner">
      <rect x="${(-width / 2).toFixed(1)}" y="-12" width="${width.toFixed(1)}" height="7" rx="1.6" fill="${badge.color}" opacity="0.9"/>
      <text y="-7" text-anchor="middle" font-size="3.8" fill="#fff">${escapeHtml(badge.text)}</text>
    </g>
  </g>`;
}

function popupMarkup(popup: LivingPopup, point: [number, number], living: LivingWorldState): string {
  const meta = POPUP_META[popup.kind];
  const remaining = Math.max(0, popup.expiresAtTick - living.tick);
  const [x, y] = point;
  const reward =
    popup.rewardGold || popup.rewardRenown ? ` (+${popup.rewardGold}g / +${popup.rewardRenown} renown)` : "";
  const hint = popup.kind === "guild_petition" ? " — click to decide" : "";

  return `<g class="livingPopup livingPopup-${popup.kind}" data-popup-id="${popup.id}" data-kind="${popup.kind}" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)})" pointer-events="all" style="cursor:pointer">
    <title>${escapeHtml(popup.title)} — ${escapeHtml(popup.subtitle)}${reward}${hint}</title>
    <circle class="livingPopupPulse" r="9" fill="${meta.color}"/>
    <circle class="livingPopupDisc" r="6.5" fill="${meta.color}" stroke="#fff" stroke-width="1"/>
    <text class="livingPopupIcon" y="2.4" text-anchor="middle" font-size="6.5">${meta.icon}</text>
    <g class="livingPopupCountdown" transform="translate(7,-7)">
      <circle r="4" fill="#111" opacity="0.8"/>
      <text y="1.4" text-anchor="middle" font-size="4.6" fill="#fff">${remaining}</text>
    </g>
  </g>`;
}

function ensureOverlay(): SVGGElement | null {
  const viewbox = document.getElementById("viewbox");
  if (!viewbox) return null;

  const existing = document.getElementById(OVERLAY_ID);
  if (existing) return existing as unknown as SVGGElement;

  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("id", OVERLAY_ID);
  viewbox.appendChild(group);
  return group;
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = OVERLAY_CSS;
  document.head.appendChild(style);
}

/** Redraw the Living overlay from the current simulation state. Safe without a map. */
export function drawLivingOverlay(): void {
  const group = ensureOverlay();
  if (!group) return;
  ensureStyle();

  const living = Living.getState();
  const vectors = collectLivingVectors(living);
  const badges = collectLivingBadges(living);
  const popups = living.guild?.popups ?? [];

  group.innerHTML = [
    ...vectors.map(vectorMarkup),
    ...badges.map(badgeMarkup).filter((markup): markup is string => Boolean(markup)),
    ...popups
      .map(popup => {
        const point = cellPoint(popup.cell);
        return point ? popupMarkup(popup, point, living) : null;
      })
      .filter((markup): markup is string => Boolean(markup))
  ].join("");
}

/** Remove the overlay and its stylesheet when the Living HUD closes. */
export function removeLivingOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
}
