// Economy constants the tuner may change, with their search ranges. makeTunable rewrites a module's source so each one
// becomes a variable with a setter on globalThis.__economyTunables: the Node bundle and the game page apply it alike.

export const TUNABLES = {
  "src/model/economy/goods-generator.ts": {
    SAVINGS_RATE: [0.05, 0.6],
    VARIETY: [1.5, 5],
    NOVELTY: [0, 10]
  },
  "src/model/economy/production-generator.ts": {
    WORKFORCE_SHARE: [0.2, 0.6],
    BURG_SPECIALIZATION: [0, 4],
    MARKET_SPECIALIZATION: [0, 2],
    DEPOSIT_RICHNESS: [0.25, 4],
    BONUS_URBAN_PRODUCTION: [0, 6],
    RURAL_OUTPUT_FACTOR: [0.5, 3]
  },
  "src/model/economy/markets-generator.ts": {
    PRICE_RESPONSE: [0, 4],
    WANTS_ESTIMATE: [0, 3],
    OPENING_ELASTICITY: [0, 1],
    CAPITAL_RENT: [0, 0.7]
  }
};

export const RANGES = Object.assign({}, ...Object.values(TUNABLES));

const DECLARATION = /^(export )?const ([A-Z_]+) = (-?[\d.]+);?/gm;

/** The file a module id or URL belongs to, if it holds tunables */
export const tunableFile = id =>
  Object.keys(TUNABLES).find(file => id.split("?")[0].endsWith(file.replace(/^src/, "")));

/** Each listed constant becomes `let`, with its initial value and a setter registered by name */
export function makeTunable(code, file) {
  const names = TUNABLES[file];
  return code.replace(DECLARATION, (line, exported = "", name, value) =>
    name in names
      ? `${exported}let ${name} = ${value}; (globalThis.__economyTunables ??= {}).${name} = { initial: ${value}, set: v => (${name} = v) };`
      : line
  );
}

/** Each tunable's value in the source; readFile(path) reads a repo file */
export function readTunables(readFile) {
  const values = {};
  for (const [file, names] of Object.entries(TUNABLES))
    for (const [, , name, value] of readFile(file).matchAll(DECLARATION)) if (name in names) values[name] = +value;
  return values;
}

/** The source with the tunables set to new values, each line's comment kept */
export function writeTunables(code, file, values) {
  return code.replace(DECLARATION, (line, exported = "", name) =>
    name in TUNABLES[file] && values[name] !== undefined ? `${exported}const ${name} = ${values[name]};` : line
  );
}

/** Sets every tunable: the given value, or its initial one */
export function setTunables(params = {}) {
  for (const [name, tunable] of Object.entries(globalThis.__economyTunables ?? {}))
    tunable.set(params[name] ?? tunable.initial);
}
