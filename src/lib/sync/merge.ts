/**
 * Merge policy for pulling remote records onto this device.
 *
 * Sync in Pitik is asymmetric on purpose: the device is the source of truth for
 * anything it created, and the server is a mirror plus a delivery mechanism for
 * other people's contributions to a shared roll. These rules encode that, and
 * they are pure functions so the policy can be tested without a network, a
 * database, or a Supabase project.
 *
 * Three invariants, in priority order:
 *
 *  1. A deletion made on this device is never undone by a pull. Resurrecting a
 *     photo somebody deliberately deleted is the worst thing sync can do, so a
 *     local tombstone always wins — even over a newer remote record.
 *  2. Local photo bytes are never overwritten. Captures are immutable once
 *     taken; if a frame already exists locally there is nothing to fetch.
 *  3. Work that has not been uploaded yet is never clobbered by remote
 *     metadata. A roll renamed offline keeps its new name until it has been
 *     pushed.
 */

/** The subset of a local record the decision functions need. */
export interface LocalMarker {
  deletedAt: number | null;
  syncState: string;
  updatedAt?: number;
}

export type PullDecision =
  /** Not present locally — create it. */
  | "insert"
  /** Present locally and the remote copy is newer — refresh the metadata. */
  | "update"
  /** Leave the local copy alone. */
  | "skip";

/**
 * Decides what to do with a remote roll.
 *
 * Rolls are the one mutable record — titles get changed, disposables get
 * developed — so they are the only place a last-write-wins comparison happens.
 */
export function decideRoll(
  local: LocalMarker | undefined,
  remote: { updatedAt: number },
): PullDecision {
  if (!local) return "insert";
  // Invariant 1: a local deletion outranks anything the server has.
  if (local.deletedAt) return "skip";
  // Invariant 3: don't overwrite edits that haven't been uploaded yet.
  if (local.syncState === "pending" || local.syncState === "local") return "skip";
  return remote.updatedAt > (local.updatedAt ?? 0) ? "update" : "skip";
}

/**
 * Decides whether to download a remote capture or strip.
 *
 * Immutable records, so there is no "update" case: either the bytes are already
 * here, or a local tombstone says they should not be, or we fetch them.
 */
export function decideBlobRecord(local: LocalMarker | undefined): "download" | "skip" {
  if (!local) return "download";
  // Covers both invariant 1 (deleted here) and invariant 2 (already here).
  return "skip";
}

/** Parses a Postgres timestamptz into epoch milliseconds. */
export function toEpoch(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Splits ids into batches.
 *
 * PostgREST puts filters in the query string, so an `in.(...)` list of a few
 * hundred UUIDs will blow past URL length limits on some proxies. A shared roll
 * from a long night can easily reach that.
 */
export function batched<T>(items: T[], size = 50): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}
