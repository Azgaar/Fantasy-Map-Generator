// The sky over a battle and the ground under it. See docs/domain/battles.md#weather

export const WEATHERS = ["clear", "rain", "downpour", "snow", "fog"] as const;
export type Weather = (typeof WEATHERS)[number];

/** What holds apart from the sky, and may come with any of it */
export const CONDITIONS = ["mud", "ice", "heat"] as const;
export type Condition = (typeof CONDITIONS)[number];

interface Sky {
  sight: number; // metres the murk lets a battalion see by day: see sight.ts
  shot: number; // share of the force of shots kept: wet strings and powder
}

export const SKIES: Record<Weather, Sky> = {
  clear: { sight: Infinity, shot: 1 },
  rain: { sight: 1500, shot: 0.6 },
  downpour: { sight: 400, shot: 0.35 },
  snow: { sight: 600, shot: 0.8 },
  fog: { sight: 150, shot: 1 }
};

// pace kept on soaked ground: open ground and roads churn up, woods and bogs were soft already; and the footing.
// Riders keep a share of the open ground's pace again: a horse sinks deeper than a man and is slow to get out
export const MUD = { open: 0.5, riders: 0.6, road: 0.8, cover: 0.75, footing: 0.75 };
export const ICE = 0.75; // pace kept on frozen ground; frozen rivers are crossed anywhere, as at a ford
export const HEAT = 2; // how much faster troops tire in the heat

const WET = 20; // precipitation of a wet climate, in the map's hundreds of mm a year

class WeatherModule {
  /**
   * The day a place is likely to give: rain and mud the likelier the wetter it is, snow for rain in frost, fog in cool damp places;
   * ice the likelier the harder the frost, heat the hotter the place
   */
  getClimate(
    precipitation: number,
    temperature: number,
    seed: number
  ): { weather: Weather } & Record<Condition, boolean> {
    const wet = Math.min(Math.max(precipitation / WET, 0), 1);
    const frost = temperature <= 0;
    const rain = 0.05 + 0.3 * wet;
    const fog = 0.04 + 0.12 * wet * (temperature < 15 ? 1 : 0.3);
    const roll = this.random(seed);
    const falling: Weather = frost ? "snow" : roll < rain / 3 ? "downpour" : "rain";
    const weather: Weather = roll < rain ? falling : roll < rain + fog ? "fog" : "clear";
    const soaked = weather === "rain" || weather === "downpour" ? 0.4 + 0.5 * wet : 0.25 * wet;
    const ice = Math.min(Math.max(-temperature / 12, 0), 0.9);
    const heat = Math.min(Math.max((temperature - 22) / 15, 0), 0.7);
    return {
      weather,
      mud: !frost && this.random(seed + 1) < soaked,
      ice: this.random(seed + 2) < ice,
      heat: this.random(seed + 3) < heat
    };
  }

  /** A number in [0, 1) that is always the same for the same seed */
  private random(seed: number): number {
    let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return ((x ^ (x >>> 16)) >>> 0) / 2 ** 32;
  }
}

export const BattleWeather = new WeatherModule();
