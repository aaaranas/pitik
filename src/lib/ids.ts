/**
 * Id generation.
 *
 * Ids are minted on the client because records must exist before any server
 * does. UUIDv4 keeps collisions a non-issue when two offline devices later
 * sync into the same shared roll.
 */
/** Fills with cryptographic randomness where available, Math.random otherwise. */
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const source = typeof crypto !== "undefined" ? crypto : undefined;
  if (source?.getRandomValues) {
    source.getRandomValues(bytes);
  } else {
    // Only reachable in an insecure context, where ids are cosmetic anyway.
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Pre-2021 Safari and non-secure contexts.
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

/**
 * Share codes appear in URLs and get read aloud across a table, so the alphabet
 * excludes every pair that is ambiguous when spoken or handwritten: no O/0,
 * no I/1/L, no U/V.
 */
const SHARE_ALPHABET = "ABCDEFGHJKMNPQRSTWXYZ23456789";

export function newShareCode(length = 6): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += SHARE_ALPHABET[bytes[i] % SHARE_ALPHABET.length];
  }
  return code;
}

export function isShareCode(value: string): boolean {
  const upper = value.toUpperCase();
  return upper.length === 6 && [...upper].every((c) => SHARE_ALPHABET.includes(c));
}
