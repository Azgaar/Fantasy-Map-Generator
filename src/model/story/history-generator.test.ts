import Alea from "alea";
import { describe, expect, it } from "vitest";
import { History } from "./history-generator";

describe("History.pick", () => {
  it("gives a state a war as often whether its foe rolled many wars or one", () => {
    // state 1 rolled five wars, against 2–6; state 7 one, against a foe now gone
    const wars = [...[2, 3, 4, 5, 6].map(defender => ({ attacker: 1, defender })), { attacker: 7, defender: 0 }];
    const runs = 400;
    const share = (state: number) => {
      let times = 0;
      for (let seed = 0; seed < runs; seed++)
        if (History.pick(wars, 3, Alea(String(seed))).some(war => war.attacker === state || war.defender === state))
          times++;
      return times / runs;
    };
    for (const state of [2, 3, 4, 5, 6]) expect(Math.abs(share(state) - share(7))).toBeLessThan(0.1);
  });

  it("keeps three wars for five states, twenty at most", () => {
    expect(History.sampleSize(25)).toBe(15);
    expect(History.sampleSize(40)).toBe(20);
  });
});
