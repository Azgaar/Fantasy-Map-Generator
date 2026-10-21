/**
 * sha256.test.ts — the synchronous SHA-256 against the implementation it replaced.
 *
 * `Bun.CryptoHasher` was the engine's hasher before Phase B. It cannot come back
 * (`Bun.*` does not exist in a browser), so it lives here instead: this file is
 * the oracle. Every assertion compares the two implementations directly, which
 * means the engine's hashes stay byte-identical to every hash the server ever
 * produced — that identity is what makes `.map` files and campaign saves portable
 * between the two runtimes.
 *
 * If these tests are ever deleted instead of kept, every `stateHash` in every
 * saved campaign silently becomes a different number.
 */
import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { canonicalHash, canonicalStringify, hashMapPack } from "@/conquest/engine/common/prng";
import { sha256Bytes, sha256Hex } from "@/conquest/engine/common/sha256";

/** The oracle: node's own SHA-256, independent of the engine's implementation. */
function nodeSha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("sha256", () => {
  test("matches the FIPS 180-4 sample vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  test("agrees with node's SHA-256 on the padding edges", () => {
    // 55/56/63/64 bytes straddle the single-block limit and the length encoding,
    // which is where a hand-written implementation usually goes wrong.
    for (const length of [0, 1, 2, 3, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 1000, 4096]) {
      const text = "a".repeat(length);
      expect(sha256Hex(text)).toBe(nodeSha256(text));
    }
  });

  test("agrees with node's SHA-256 on multi-block and binary-ish content", () => {
    const inputs = [
      JSON.stringify({ regions: Array.from({ length: 500 }, (_, i) => ({ id: i, cells: [i, i + 1] })) }),
      "\u0000\u0001\u007f\u0080\u07ff\u0800\uffff",
      "Кот Ürshel — Ω≈ç√∫˜µ≤≥÷",
      "\u{1F600}\u{1F6E1}🗡",
      "x".repeat(65_536)
    ];
    for (const text of inputs) expect(sha256Hex(text)).toBe(nodeSha256(text));
  });

  test("encodes non-ASCII as UTF-8, not as code units", () => {
    // The distinction the oracle would catch: "ö" is two bytes in UTF-8.
    expect(sha256Hex("ö")).toBe(nodeSha256("ö"));
    expect(sha256Bytes(new TextEncoder().encode("ö")).length).toBe(64);
  });

  test("hashes raw bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const hasher = createHash("sha256");
    hasher.update(bytes);
    expect(sha256Bytes(bytes)).toBe(hasher.digest("hex"));
  });

  test("is stateless across calls (the shared scratch buffer is reset)", () => {
    // H/W are module-level scratch; a missing reset would leak between calls and
    // make every hash after the first depend on history.
    const a = sha256Hex("campaign turn 1");
    sha256Hex("something else entirely");
    sha256Hex("x".repeat(500));
    expect(sha256Hex("campaign turn 1")).toBe(a);
    expect(a).toBe(nodeSha256("campaign turn 1"));
  });
});

describe("canonicalHash", () => {
  const nodeCanonicalHash = (value: unknown): string =>
    createHash("sha256").update(canonicalStringify(value), "utf8").digest("hex");

  test("is byte-identical to the node-based oracle", () => {
    const samples: unknown[] = [
      null,
      0,
      -1,
      3.5,
      "",
      "chia",
      true,
      [],
      {},
      [1, 2, 3],
      { b: 1, a: 2 },
      { turn: 42, factions: { "3": { treasury: 100 }, "1": { treasury: 50 } }, id: "x" },
      Array.from({ length: 200 }, (_, i) => ({ i, name: `r${i}`, cells: [i, i + 1, i + 2] }))
    ];
    for (const sample of samples) expect(canonicalHash(sample)).toBe(nodeCanonicalHash(sample));
  });

  test("hashMapPack keeps its meaning: meta timestamps are excluded", () => {
    const pack = {
      meta: { mapId: "chia-1", compiledAt: "2026-01-01T00:00:00.000Z", sourceFile: "a.json" },
      regions: [{ id: 1, name: "Kut" }]
    };
    const other = { ...pack, meta: { ...pack.meta, compiledAt: "2030-06-06T06:06:06.000Z", sourceFile: "b.json" } };
    expect(hashMapPack(pack as never)).toBe(hashMapPack(other as never));
    expect(hashMapPack(pack as never)).toBe(nodeCanonicalHash({ mapId: "chia-1", regions: pack.regions }));
  });

  test("key order does not change the hash", () => {
    expect(canonicalHash({ a: 1, b: 2 })).toBe(canonicalHash({ b: 2, a: 1 }));
  });
});
