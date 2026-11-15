/** The battle screen every browser starts from, and the numbers a new battle is set up with. See docs/domain/battles.md */

export const BATTLE_SPEEDS = [0.1, 0.2, 0.5, 1, 2, 4, 8, 16]; // playback, ×1 the speed a tick is drawn at
export const PAUSE_EVENTS = ["clash", "rout", "surrender", "breach", "broken"] as const;
export type PauseEvent = (typeof PAUSE_EVENTS)[number];

/** Copied into each battle when it is set up, and stored in its log */
export interface BattleSettings {
  maxBattalions: number; // the troops are split into no more battalions than that
  minBattalions: number; // and smaller ones when they would make fewer
  maxMinutes: number; // a backstop for a battle that neither ends nor dies down
  lullRounds: number; // rounds without losses that end a battle
  orderRounds: number; // an order given by hand stands that long
  planTicks: number; // how far ahead a general plays an open battle through in his mind
  stormPlanTicks: number; // and a storm of walls or of a wagon ring, slow to reckon
}

export const DEFAULT_BATTLE_SETTINGS: BattleSettings = {
  maxBattalions: 40,
  minBattalions: 10,
  maxMinutes: 8 * 60,
  lullRounds: 12,
  orderRounds: 10,
  planTicks: 360,
  stormPlanTicks: 150
};

export const DEFAULT_BATTLE_OPTIONS = {
  view: { camera: "follow" as "follow" | "field", speed: 1, log: false },
  rendering: {
    relief: "hachures" as "hachures" | "contours" | "none",
    shade: true,
    heights: true,
    woods: true,
    props: true,
    labels: true,
    colors: "sides" as "sides" | "states",
    icons: true,
    flags: true,
    health: true,
    fallen: "fade" as "fade" | "outline",
    arrows: false,
    fire: true,
    missiles: true,
    clashes: true,
    weather: true,
    title: true,
    scale: true,
    north: true
  },
  playback: {
    step: "tick" as "tick" | "round",
    pause: { clash: false, rout: false, surrender: false, breach: false, broken: false } as Record<PauseEvent, boolean>
  },
  simulation: DEFAULT_BATTLE_SETTINGS,
  export: {
    format: "gif" as "gif" | "svg" | "report",
    quality: "medium" as "low" | "medium" | "high",
    speed: 1,
    camera: "follow" as "follow" | "field"
  }
};

export type BattleOptions = typeof DEFAULT_BATTLE_OPTIONS;
export type BattleLook = BattleOptions["rendering"];
