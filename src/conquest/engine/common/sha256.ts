/**
 * sha256.ts — synchronous SHA-256, so `canonicalHash` works anywhere.
 *
 * `Bun.CryptoHasher` was the last platform dependency in the hashing path, and it
 * cannot be replaced with `crypto.subtle`: that API is promise-based, and
 * `canonicalHash` is called from deep inside the engine (state hashes after every
 * command, content hashes at compile time) where a synchronous string is the
 * contract. So the hash is computed here, in ~60 lines of plain arithmetic.
 *
 * Correctness is not assumed: `test/sha256.test.ts` checks every output against
 * `Bun.CryptoHasher` (the implementation this replaced) over FIPS vectors, the
 * padding edge cases, multi-block inputs and the canonical strings of real map
 * packs. Bun's hasher stays in the *tests* as the oracle, which is exactly where
 * a reference implementation belongs.
 *
 * Reference: FIPS 180-4. No allocation beyond the padded buffer and the state.
 */

/** Round constants: the first 32 bits of the fractional parts of cube roots. */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

/** Initial hash: first 32 bits of the fractional parts of square roots of primes. */
const INITIAL = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
]);

const rotr = (value: number, bits: number): number => (value >>> bits) | (value << (32 - bits));

/** Scratch state, reused across calls: hashing is called in tight loops. */
const H = new Uint32Array(INITIAL);
const W = new Uint32Array(64);

/** SHA-256 of raw bytes, as lowercase hex. */
export function sha256Bytes(bytes: Uint8Array): string {
  H.set(INITIAL);

  // Padded length: message + 0x80 + zeros + 8-byte big-endian bit length.
  const bitLength = bytes.length * 8;
  const blocks = Math.floor((bytes.length + 8) / 64) + 1;
  const padded = new Uint8Array(blocks * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  // Bit length as a 64-bit big-endian integer; messages here are far below 2^32
  // bytes, so the high word is a floor division rather than a floating multiply.
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  const tail = padded.length - 8;
  padded[tail] = (high >>> 24) & 0xff;
  padded[tail + 1] = (high >>> 16) & 0xff;
  padded[tail + 2] = (high >>> 8) & 0xff;
  padded[tail + 3] = high & 0xff;
  padded[tail + 4] = (low >>> 24) & 0xff;
  padded[tail + 5] = (low >>> 16) & 0xff;
  padded[tail + 6] = (low >>> 8) & 0xff;
  padded[tail + 7] = low & 0xff;

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      W[i] = ((padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let a = H[0]!;
    let b = H[1]!;
    let c = H[2]!;
    let d = H[3]!;
    let e = H[4]!;
    let f = H[5]!;
    let g = H[6]!;
    let h = H[7]!;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i]! + W[i]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0]! + a) >>> 0;
    H[1] = (H[1]! + b) >>> 0;
    H[2] = (H[2]! + c) >>> 0;
    H[3] = (H[3]! + d) >>> 0;
    H[4] = (H[4]! + e) >>> 0;
    H[5] = (H[5]! + f) >>> 0;
    H[6] = (H[6]! + g) >>> 0;
    H[7] = (H[7]! + h) >>> 0;
  }

  let hex = "";
  for (let i = 0; i < 8; i++) hex += H[i]!.toString(16).padStart(8, "0");
  return hex;
}

const encoder = new TextEncoder();

/**
 * SHA-256 of a string, as lowercase hex.
 *
 * The string is encoded as UTF-8 first — which matters: a campaign whose region
 * names contain "ö" or "Кот" must hash the same in Bun and in a browser, and
 * encoding implicitly would make that a platform difference.
 */
export function sha256Hex(input: string): string {
  return sha256Bytes(encoder.encode(input));
}
