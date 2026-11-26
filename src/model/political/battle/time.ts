// The hour a battle is fought at and the light it gives. See docs/domain/battles.md#time

import { TICK_SECONDS } from "./battle-scale";

export const PERIODS = ["night", "dawn", "morning", "midday", "afternoon", "evening", "dusk"] as const;
export type Period = (typeof PERIODS)[number];

// the hour each period begins at; the day runs from the end of dawn to the start of dusk
const STARTS: [number, Period][] = [
  [3, "dawn"],
  [5, "morning"],
  [11, "midday"],
  [14, "afternoon"],
  [17, "evening"],
  [20, "dusk"],
  [23, "night"]
];
const SUNRISE = 5;
const SUNSET = 20;
const DARK = 23; // twilight ends
const FIRST_LIGHT = 3; // and begins
// the sun stands at noon as at the equinox, the season unknown: 90° less the latitude, and no lower than this
const LOWEST_NOON = 15;
const BY_DAY = 0.8; // share of battles begun in daylight: generals mostly wait for the light

export interface Sun {
  azimuth: number; // radians clockwise from north
  altitude: number; // radians above the horizon, below it negative
}

class TimeModule {
  /** The hour a battle starts at, 0 to 23, by day four times in five: always the same for the same seed */
  getHour(seed: number): number {
    let x = Math.imul(seed ^ 0x5bd1e995, 0x27d4eb2d);
    x = Math.imul(x ^ (x >>> 15), 0x165667b1);
    const roll = ((x ^ (x >>> 16)) >>> 0) / 2 ** 32;
    const day = SUNSET - SUNRISE; // hours begun in daylight
    if (roll < BY_DAY) return SUNRISE + Math.floor((roll / BY_DAY) * day);
    return (SUNSET + Math.floor(((roll - BY_DAY) / (1 - BY_DAY)) * (24 - day))) % 24;
  }

  /** The time of day a tick is at, in hours from midnight */
  getTime(hour: number, tick: number): number {
    return (hour + (tick * TICK_SECONDS) / 3600) % 24;
  }

  getPeriod(time: number): Period {
    let period: Period = "night";
    for (const [start, name] of STARTS) if (time >= start) period = name;
    return period;
  }

  /** How much of the day's light there is: 1 by day, 0 at night, fading through dusk and growing through dawn */
  getDaylight(time: number): number {
    if (time >= SUNRISE && time < SUNSET) return 1;
    if (time >= SUNSET && time < DARK) return this.smooth(1 - (time - SUNSET) / (DARK - SUNSET));
    if (time >= FIRST_LIGHT && time < SUNRISE) return this.smooth((time - FIRST_LIGHT) / (SUNRISE - FIRST_LIGHT));
    return 0;
  }

  /** Where the sun stands: south at midday north of the equator, north south of it; rising at sunrise, setting at sunset */
  getSun(time: number, latitude: number): Sun {
    const noon = (SUNRISE + SUNSET) / 2;
    const turn = ((time - noon) / 24) * Math.PI * 2;
    const azimuth = latitude < 0 ? -turn : Math.PI + turn;
    const highest = (Math.max(90 - Math.abs(latitude), LOWEST_NOON) * Math.PI) / 180;
    const day = SUNSET - SUNRISE;
    const since = (time - SUNRISE + 24) % 24;
    const altitude =
      since < day
        ? highest * Math.sin((Math.PI * since) / day)
        : -highest * Math.sin((Math.PI * (since - day)) / (24 - day));
    return { azimuth: (azimuth + Math.PI * 2) % (Math.PI * 2), altitude };
  }

  /** The time of day of a tick: hh:mm:ss */
  formatClock(hour: number, tick: number): string {
    const seconds = Math.round(hour * 3600 + tick * TICK_SECONDS) % 86400;
    const pad = (value: number): string => String(value).padStart(2, "0");
    return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
  }

  private smooth(t: number): number {
    return t * t * (3 - 2 * t);
  }
}

export const BattleTime = new TimeModule();
