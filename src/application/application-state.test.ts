import { afterEach, describe, expect, it } from "vitest";
import {
  type ApplicationStateInitial,
  getApplicationState,
  initializeApplicationState,
  resetApplicationStateForTests
} from "./application-state";

const createInitialState = (): ApplicationStateInitial =>
  ({
    DEBUG: {},
    ERROR: true,
    INFO: true,
    MOBILE: false,
    TIME: true,
    WARN: true,
    color: (() => "#000") as unknown as ApplicationStateInitial["color"],
    customization: 0,
    distanceScale: 3,
    graphHeight: 800,
    graphWidth: 1000,
    mapCoordinates: { latT: 0, latN: 0, latS: 0, lonT: 0, lonW: 0, lonE: 0 },
    mapHistory: [],
    modules: {},
    notes: [],
    options: {},
    populationRate: 1,
    scale: 1,
    style: {},
    svgHeight: 800,
    svgWidth: 1000,
    urbanDensity: 10,
    urbanization: 1,
    viewX: 0,
    viewY: 0
  }) as unknown as ApplicationStateInitial;

afterEach(resetApplicationStateForTests);

describe("application state", () => {
  it("keeps transitional global writes synchronized with the typed store", () => {
    const legacyTarget: Record<string, unknown> = {};
    const state = initializeApplicationState(createInitialState(), legacyTarget);

    expect(legacyTarget.graphWidth).toBe(1000);
    legacyTarget.graphWidth = 1600;
    expect(state.graphWidth).toBe(1600);

    state.graphHeight = 900;
    expect(legacyTarget.graphHeight).toBe(900);
    expect(getApplicationState()).toBe(state);
  });

  it("rejects a second bootstrap", () => {
    initializeApplicationState(createInitialState(), {});
    expect(() => initializeApplicationState(createInitialState(), {})).toThrow("already initialized");
  });
});
