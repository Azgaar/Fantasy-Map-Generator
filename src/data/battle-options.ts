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
}

export const DEFAULT_BATTLE_SETTINGS: BattleSettings = {
  maxBattalions: 40,
  minBattalions: 10,
  maxMinutes: 8 * 60,
  lullRounds: 10,
  orderRounds: 10,
  planTicks: 360
};

export interface BattleOptions {
  view: { camera: "follow" | "field"; speed: number; log: boolean };
  rendering: {
    relief: "hachures" | "contours" | "none";
    shade: boolean;
    heights: boolean;
    woods: boolean;
    props: boolean;
    labels: boolean;
    colors: "sides" | "states";
    icons: boolean;
    flags: boolean;
    health: boolean;
    fallen: "fade" | "outline";
    arrows: boolean;
    fire: boolean;
    missiles: boolean;
    clashes: boolean;
    weather: boolean;
    title: boolean;
    scale: boolean;
    north: boolean;
  };
  playback: {
    step: "tick" | "round";
    pause: Record<PauseEvent, boolean>;
  };
  simulation: BattleSettings;
  export: {
    format: "gif" | "svg" | "report";
    quality: "low" | "medium" | "high";
    speed: number;
    camera: "follow" | "field";
  };
}

export const DEFAULT_BATTLE_OPTIONS: BattleOptions = {
  view: { camera: "follow", speed: 1, log: false },
  rendering: {
    relief: "hachures",
    shade: true,
    heights: true,
    woods: true,
    props: true,
    labels: true,
    colors: "sides",
    icons: true,
    flags: true,
    health: true,
    fallen: "fade",
    arrows: false,
    fire: true,
    missiles: true,
    clashes: true,
    weather: true,
    title: true,
    scale: true,
    north: true
  },
  playback: { step: "tick", pause: { clash: false, rout: false, surrender: false, breach: false, broken: false } },
  simulation: DEFAULT_BATTLE_SETTINGS,
  export: { format: "gif", quality: "medium", speed: 1, camera: "follow" }
};

export type BattleLook = BattleOptions["rendering"];
