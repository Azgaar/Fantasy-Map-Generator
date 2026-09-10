// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { BurgContext } from "@/generators/burg-context";
import {
  buildSettlemakerUrl,
  MAX_ENCODED_PAYLOAD_BYTES,
  SETTLEMAKER_BASE_URL,
  toSettlemakerInput
} from "./settlemaker";

// Stub WARN global to suppress console output in tests
globalThis.WARN = false;

const ctx = (over: Partial<BurgContext> = {}): BurgContext =>
  ({
    burg: {
      i: 7,
      name: "Toprak",
      population: 13,
      seedKey: "1234560007",
      capital: false,
      port: true,
      citadel: false,
      walls: false,
      plaza: false,
      temple: false,
      shanty: false,
      culture: "Koryo"
    },
    window: { radiusKm: 12, cellCount: 40 },
    approaches: [],
    hydrology: {
      oceanBearingDeg: 200,
      harbourSize: "small",
      coastal: true,
      lakeside: false,
      rivers: [],
      waterFeatures: []
    },
    terrain: {
      elevationM: 144,
      windowMinM: 4,
      windowMaxM: 484,
      reliefM: 480,
      meanGradient: 0,
      setting: "plain"
    },
    climate: {
      temperatureC: 14,
      biome: "Temperate deciduous forest",
      biomeMix: [{ name: "Temperate deciduous forest", share: 1 }]
    },
    economy: {
      isMarketCentre: false,
      topGoods: [],
      treasuryBand: "modest"
    },
    ...over
  }) as BurgContext;

describe("toSettlemakerInput", () => {
  it("always emits all seven booleans, including the false ones", () => {
    const input = toSettlemakerInput(ctx(), {});
    for (const key of ["port", "citadel", "walls", "plaza", "temple", "shanty", "capital"] as const) {
      expect(input).toHaveProperty(key);
      expect(typeof input[key]).toBe("boolean");
    }
    expect(input.port).toBe(true);
    expect(input.capital).toBe(false);
  });

  it("maps name, population and the declared-but-unread fields", () => {
    const input = toSettlemakerInput(ctx(), {});
    expect(input).toMatchObject({
      name: "Toprak",
      population: 13,
      oceanBearing: 200,
      harbourSize: "small",
      biome: "Temperate deciduous forest",
      elevation: 144,
      temperature: 14,
      culture: "Koryo"
    });
  });

  it("omits optional fields rather than sending null", () => {
    const bare = ctx({
      hydrology: { coastal: false, lakeside: false, rivers: [], waterFeatures: [] },
      climate: { temperatureC: 5, biome: "", biomeMix: [] },
      burg: { ...ctx().burg, culture: undefined }
    });
    const input = toSettlemakerInput(bare, {});
    expect("oceanBearing" in input).toBe(false);
    expect("harbourSize" in input).toBe(false);
    expect("biome" in input).toBe(false);
    expect("culture" in input).toBe(false);
    expect("urbanDensity" in input).toBe(false);
  });

  it("sends land approaches as roadBearings and drops sea, trade and air ones", () => {
    const input = toSettlemakerInput(
      ctx({
        approaches: [
          { routeId: 1, group: "roads", type: "royal", bearingDeg: 90, through: true },
          { routeId: 2, group: "searoutes", type: "sea route", bearingDeg: 180, through: false },
          { routeId: 3, group: "airroutes", bearingDeg: 270, through: false },
          { routeId: 4, group: "trails", type: "trail", bearingDeg: 0, through: false },
          { routeId: 5, group: "traderoutes", bearingDeg: 45, through: true }
        ]
      }),
      {}
    );
    // traderoutes are port-to-port sea lanes; drawing them as roads would send
    // approaches out into open water.
    expect(input.roadBearings).toEqual([
      { bearing_deg: 90, route_id: "1", kind: "royal", group: "roads", through: true },
      { bearing_deg: 0, route_id: "4", kind: "trail", group: "trails", through: false }
    ]);
  });

  it.each(["royal", "main", "market", "town", "local", "trail", "footpath"])(
    "preserves the %s road class separately from its group",
    type => {
      const group = type === "trail" || type === "footpath" ? "trails" : "roads";
      const input = toSettlemakerInput(
        ctx({ approaches: [{ routeId: 17, group, type, bearingDeg: 36, through: false }] }),
        {}
      );
      expect(input.roadBearings).toEqual([{ route_id: "17", bearing_deg: 36, kind: type, group, through: false }]);
    }
  );

  it("uses the group default when a route has no recognized class", () => {
    const input = toSettlemakerInput(
      ctx({
        approaches: [
          { routeId: 1, group: "roads", bearingDeg: 36, through: false },
          { routeId: 2, group: "trails", type: "custom path", bearingDeg: 209, through: false }
        ]
      }),
      {}
    );
    expect(input.roadBearings?.map(a => a.kind)).toEqual(["main", "trail"]);
  });

  it("keeps each measured side, shared IDs, coincident approaches and route character", async () => {
    const corridor = {
      sampledKm: 12,
      elevationDeltaM: -80,
      maxGradient: 0.1,
      relief: "descent" as const,
      followsRiver: true,
      biomes: [],
      minTempC: 8
    };
    const { link } = await buildSettlemakerUrl(
      ctx({
        approaches: [
          { routeId: 17, group: "roads", type: "royal", bearingDeg: 36, through: true, corridor },
          {
            routeId: 17,
            group: "roads",
            type: "royal",
            bearingDeg: 209,
            through: true,
            corridor: { ...corridor, relief: "ascent", followsRiver: false }
          },
          { routeId: 23, group: "trails", type: "footpath", bearingDeg: 36, through: false }
        ]
      }),
      {}
    );
    const { burg } = await decodeIParam(link);
    expect(burg.roadBearings).toEqual([
      {
        route_id: "17",
        bearing_deg: 36,
        kind: "royal",
        group: "roads",
        through: true,
        relief: "descent",
        followsRiver: true
      },
      {
        route_id: "17",
        bearing_deg: 209,
        kind: "royal",
        group: "roads",
        through: true,
        relief: "ascent",
        followsRiver: false
      },
      { route_id: "23", bearing_deg: 36, kind: "footpath", group: "trails", through: false }
    ]);
  });

  it("keeps water for non-ports but only requests harbour size for ports", () => {
    const input = toSettlemakerInput(ctx({ burg: { ...ctx().burg, port: false } }), {});
    expect(input.oceanBearing).toBe(200);
    expect(input.harbourSize).toBeUndefined();
    // The context has water summaries, not filled polygons in settlement-local units.
    expect(input.coastlineGeometry).toBeUndefined();
  });

  it("sends an empty roadBearings array for a genuinely routeless burg, never omits it", () => {
    const input = toSettlemakerInput(ctx({ approaches: [] }), {});
    expect(input.roadBearings).toEqual([]);
    expect("roadBearings" in input).toBe(true);
  });

  it("passes urbanDensity only when positive, and trade only when true", () => {
    expect(toSettlemakerInput(ctx(), { urbanDensity: 8, trade: true })).toMatchObject({
      urbanDensity: 8,
      trade: true
    });
    const off = toSettlemakerInput(ctx(), { urbanDensity: 0, trade: false });
    expect("urbanDensity" in off).toBe(false);
    expect("trade" in off).toBe(false);
  });
  it.each([NaN, Infinity, -Infinity, -1, 0])("omits invalid household density %s", urbanDensity => {
    expect(toSettlemakerInput(ctx(), { urbanDensity }).urbanDensity).toBeUndefined();
  });
});

async function decodeIParam(url: string) {
  const encoded = new URL(url).searchParams.get("i") as string;
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return JSON.parse(await new Response(stream).text());
}

describe("buildSettlemakerUrl", () => {
  it("round-trips through the documented codec into a v1 envelope", async () => {
    const { link } = await buildSettlemakerUrl(ctx(), {});
    expect(link.startsWith(`${SETTLEMAKER_BASE_URL}?i=`)).toBe(true);

    const envelope = await decodeIParam(link);
    expect(envelope.v).toBe(1);
    expect(typeof envelope.seed).toBe("number");
    expect(envelope.burg.name).toBe("Toprak");
  });

  it("carries all seven booleans through the encode/decode cycle", async () => {
    const { link } = await buildSettlemakerUrl(ctx(), {});
    const { burg } = await decodeIParam(link);
    for (const key of ["port", "citadel", "walls", "plaza", "temple", "shanty", "capital"]) {
      expect(burg).toHaveProperty(key);
    }
  });

  it("derives a stable numeric seed from the burg seed key", async () => {
    const a = await decodeIParam((await buildSettlemakerUrl(ctx(), {})).link);
    const b = await decodeIParam((await buildSettlemakerUrl(ctx(), {})).link);
    expect(a.seed).toBe(b.seed);

    const other = ctx({ burg: { ...ctx().burg, seedKey: "1234560008" } });
    const c = await decodeIParam((await buildSettlemakerUrl(other, {})).link);
    expect(c.seed).not.toBe(a.seed);
  });

  it("uses the same chrome-free URL for link and preview", async () => {
    const { link, preview } = await buildSettlemakerUrl(ctx(), {});
    expect(preview).toBe(link);
  });

  it("stays inside the payload budget for a heavily-connected burg", async () => {
    const approaches = Array.from({ length: 12 }, (_, i) => ({
      routeId: i,
      group: "roads" as const,
      type: "highway",
      bearingDeg: i * 30,
      through: true
    }));
    const { link } = await buildSettlemakerUrl(ctx({ approaches }), {});
    const encoded = new URL(link).searchParams.get("i") as string;
    expect(encoded.length).toBeLessThan(MAX_ENCODED_PAYLOAD_BYTES);
  });

  it("preserves the compressed contract when a payload exceeds the advisory budget", async () => {
    // Craft a burg with massive data that exceeds the 8KB budget even after compression:
    // - 5000+ approaches with high-entropy types to resist DEFLATE
    // - Large culture string with low compressibility
    // The noise is a deterministic index-derived hash, not Math.random(): a fixture that
    // varies run to run under a size threshold is a latent flake.
    const noise = (n: number) => {
      let x = (n * 2654435761) >>> 0;
      x ^= x >>> 15;
      x = Math.imul(x, 0x2c1b3c6d) >>> 0;
      x ^= x >>> 12;
      return x.toString(36);
    };
    const approaches = Array.from({ length: 5000 }, (_, i) => ({
      routeId: i,
      group: (["roads", "trails", "traderoutes"] as const)[i % 3],
      type: `${noise(i)}${i}${noise(i + 7919)}`,
      bearingDeg: (i * 71) % 360,
      through: i % 2 === 0
    }));
    const culture = Array.from({ length: 500 }, (_, i) => `${i}_${noise(i + 104729)}${noise(i + 15485863)}`).join("|");

    const { link } = await buildSettlemakerUrl(
      ctx({
        burg: { ...ctx().burg, culture },
        approaches
      }),
      { urbanDensity: 8, trade: true }
    );
    expect(new URL(link).searchParams.get("i")!.length).toBeGreaterThan(MAX_ENCODED_PAYLOAD_BYTES);
    const { burg } = await decodeIParam(link);
    expect(burg.culture).toBe(culture);
    expect(burg.roadBearings).toHaveLength(approaches.filter(a => a.group !== "traderoutes").length);
    expect(burg.roadBearings[0].route_id).toBe("0");
  });

  it("fails explicitly if compression is unavailable instead of silently losing route data", async () => {
    const original = globalThis.CompressionStream;
    try {
      (globalThis as Record<string, unknown>).CompressionStream = undefined;
      await expect(buildSettlemakerUrl(ctx(), {})).rejects.toThrow();
    } finally {
      globalThis.CompressionStream = original;
    }
  });
});
