// A self-contained, seedable Alea PRNG implementation for consistent procedural generation.
export type PRNG = () => number;

export function createPRNG(seed: string): PRNG {
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  let c = 1;

  const mash = () => {
    let n = 0xefc8249d;
    return (data: string) => {
      for (let i = 0; i < data.length; i++) {
        n += data.charCodeAt(i);
        let h = 0.02519603282416938 * n;
        n = h >>> 0;
        h -= n;
        h *= n;
        n = h >>> 0;
        h -= n;
        n += h * 0x100000000; // 2^32
      }
      return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
    };
  };

  const m = mash();
  s0 = m(" ");
  s1 = m(" ");
  s2 = m(" ");

  s0 -= m(seed);
  if (s0 < 0) s0 += 1;
  s1 -= m(seed);
  if (s1 < 0) s1 += 1;
  s2 -= m(seed);
  if (s2 < 0) s2 += 1;

  return () => {
    const t = 2091639 * s0 + c * 2.3283064365386963e-10; // 2^-32
    s0 = s1;
    s1 = s2;
    c = t | 0;
    s2 = t - c;
    return s2;
  };
}
