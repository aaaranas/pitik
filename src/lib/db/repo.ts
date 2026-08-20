import { newId, newShareCode } from "@/lib/ids";
import { getDB } from "./schema";
import {
  type Capture,
  DEFAULT_SETTINGS,
  type OutboxItem,
  type OutboxKind,
  type Roll,
  type Settings,
  type Strip,
} from "./types";

/**
 * The only module allowed to talk to IndexedDB.
 *
 * Everything above this line works with plain domain objects and never sees a
 * transaction, which is what keeps the storage engine swappable and the React
 * layer free of async database plumbing.
 */

// ---------------------------------------------------------------- change feed

type ChangeScope = "rolls" | "captures" | "strips" | "outbox" | "settings";

const listeners = new Set<(scope: ChangeScope) => void>();

/**
 * Notifies subscribers that a store changed.
 *
 * Deliberately coarse: hooks re-read the small amount of data they need rather
 * than the repo trying to diff records. At the scale one roll reaches — tens to
 * low hundreds of frames — re-reading an index is cheaper than the bookkeeping
 * a finer-grained feed would cost.
 */
function emit(scope: ChangeScope): void {
  for (const listener of listeners) listener(scope);
}

export function subscribe(listener: (scope: ChangeScope) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// -------------------------------------------------------------------- settings

const SETTINGS_KEY = "singleton";

export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const stored = await db.get("settings", SETTINGS_KEY);
  if (stored) return { ...DEFAULT_SETTINGS, ...stored };
  const created: Settings = { ...DEFAULT_SETTINGS, deviceId: newId() };
  await db.put("settings", created, SETTINGS_KEY);
  return created;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const db = await getDB();
  const current = await getSettings();
  const next = { ...current, ...patch };
  await db.put("settings", next, SETTINGS_KEY);
  emit("settings");
  return next;
}

// ----------------------------------------------------------------------- rolls

export interface CreateRollInput {
  title: string;
  emoji?: string | null;
  coverStyle?: Roll["coverStyle"];
  mode?: Roll["mode"];
  shotLimit?: number | null;
  /** Hours to hold a disposable roll shut. */
  developHours?: number;
}

export async function createRoll(input: CreateRollInput): Promise<Roll> {
  const db = await getDB();
  const now = Date.now();
  const mode = input.mode ?? "standard";
  const roll: Roll = {
    id: newId(),
    kind: "roll",
    title: input.title.trim() || "Untitled roll",
    emoji: input.emoji ?? null,
    coverStyle: input.coverStyle ?? "envelope",
    mode,
    shotLimit: mode === "disposable" ? (input.shotLimit ?? 24) : null,
    revealAt:
      mode === "disposable" && input.developHours
        ? now + input.developHours * 60 * 60 * 1000
        : null,
    developedAt: null,
    createdAt: now,
    updatedAt: now,
    ownerId: null,
    remoteId: null,
    shareCode: null,
    syncState: "local",
    deletedAt: null,
  };
  await db.put("rolls", roll);
  emit("rolls");
  return roll;
}

export async function getRoll(id: string): Promise<Roll | undefined> {
  const db = await getDB();
  const roll = await db.get("rolls", id);
  return roll && !roll.deletedAt ? roll : undefined;
}

export async function getRollByShareCode(code: string): Promise<Roll | undefined> {
  const db = await getDB();
  const roll = await db.getFromIndex("rolls", "by_share_code", code.toUpperCase());
  return roll && !roll.deletedAt ? roll : undefined;
}

/**
 * Named rolls only.
 *
 * The two libraries are deliberately excluded: they are containers, not
 * moments, and listing them among the evenings somebody named would bury the
 * thing this screen is for.
 */
export async function listRolls(): Promise<Roll[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("rolls", "by_updated");
  return all.filter((roll) => !roll.deletedAt && roll.kind !== "library").reverse();
}

export type LibraryKind = "camera" | "booth";

/**
 * Finds — or mints — the standing collection for a kind of shooting.
 *
 * Camera Mode and the photobooth each write here unless the user has
 * explicitly started a roll. That is the whole point: taking a photograph
 * should not silently create a "Thursday night" session nobody asked for.
 */
export async function ensureLibrary(kind: LibraryKind): Promise<Roll> {
  const settings = await getSettings();
  const key = kind === "camera" ? "cameraLibraryId" : "boothLibraryId";
  const existingId = settings[key];

  if (existingId) {
    const existing = await getRoll(existingId);
    if (existing) return existing;
  }

  const db = await getDB();
  const now = Date.now();
  const roll: Roll = {
    id: newId(),
    kind: "library",
    title: kind === "camera" ? "Camera" : "Photobooth",
    emoji: null,
    coverStyle: "contact",
    mode: "standard",
    shotLimit: null,
    revealAt: null,
    developedAt: null,
    createdAt: now,
    updatedAt: now,
    ownerId: null,
    remoteId: null,
    shareCode: null,
    syncState: "local",
    deletedAt: null,
  };
  await db.put("rolls", roll);
  await updateSettings({ [key]: roll.id });
  emit("rolls");
  return roll;
}

export async function updateRoll(id: string, patch: Partial<Roll>): Promise<Roll | undefined> {
  const db = await getDB();
  const current = await db.get("rolls", id);
  if (!current) return undefined;
  const next: Roll = {
    ...current,
    ...patch,
    id,
    // Editing a roll counts as activity, so it floats back up the home screen —
    // unless the caller states a time explicitly, which sync does when it is
    // reconciling a record that was actually modified some time ago.
    updatedAt: patch.updatedAt ?? Date.now(),
  };
  await db.put("rolls", next);
  emit("rolls");
  return next;
}

/** Mints a share code on demand — rolls are private until someone shares one. */
export async function ensureShareCode(id: string): Promise<string | undefined> {
  const roll = await getRoll(id);
  if (!roll) return undefined;
  if (roll.shareCode) return roll.shareCode;
  let code = newShareCode();
  // Collisions are astronomically unlikely, but a duplicate would silently
  // cross-link two people's rolls, so it is worth one lookup.
  while (await getRollByShareCode(code)) code = newShareCode();
  await updateRoll(id, { shareCode: code });
  return code;
}

/**
 * Soft-deletes a roll and everything on it.
 *
 * The tombstone stays so a later sync can mirror the deletion server-side;
 * {@link purgeDeleted} reclaims the space once that has happened.
 */
export async function deleteRoll(id: string): Promise<void> {
  const db = await getDB();
  const now = Date.now();
  const tx = db.transaction(["rolls", "captures", "strips"], "readwrite");
  const roll = await tx.objectStore("rolls").get(id);
  if (roll) await tx.objectStore("rolls").put({ ...roll, deletedAt: now, updatedAt: now });
  for (const capture of await tx.objectStore("captures").index("by_roll").getAll(id)) {
    await tx.objectStore("captures").put({ ...capture, deletedAt: now });
  }
  for (const strip of await tx.objectStore("strips").index("by_roll").getAll(id)) {
    await tx.objectStore("strips").put({ ...strip, deletedAt: now });
  }
  await tx.done;
  emit("rolls");
  emit("captures");
  emit("strips");
}

// -------------------------------------------------------------------- captures

export type NewCapture = Omit<
  Capture,
  | "id"
  | "createdAt"
  | "remoteId"
  | "storagePath"
  | "syncState"
  | "deletedAt"
  | "favorite"
  | "authorId"
> &
  Partial<Pick<Capture, "favorite" | "createdAt" | "authorId">>;

export async function addCapture(input: NewCapture): Promise<Capture> {
  const db = await getDB();
  const capture: Capture = {
    ...input,
    id: newId(),
    createdAt: input.createdAt ?? Date.now(),
    favorite: input.favorite ?? false,
    // Null means "taken on this device"; pulled frames carry a real author.
    authorId: input.authorId ?? null,
    remoteId: null,
    storagePath: null,
    syncState: "local",
    deletedAt: null,
  };
  const tx = db.transaction(["captures", "rolls"], "readwrite");
  await tx.objectStore("captures").put(capture);
  // Touching the roll keeps "continue shooting" ordered by real activity
  // rather than by when the roll happened to be created.
  const roll = await tx.objectStore("rolls").get(capture.rollId);
  if (roll) await tx.objectStore("rolls").put({ ...roll, updatedAt: capture.createdAt });
  await tx.done;
  emit("captures");
  emit("rolls");
  return capture;
}

export async function listCaptures(rollId: string): Promise<Capture[]> {
  const db = await getDB();
  const range = IDBKeyRange.bound([rollId, -Infinity], [rollId, Infinity]);
  const all = await db.getAllFromIndex("captures", "by_roll_created", range);
  return all.filter((capture) => !capture.deletedAt);
}

export async function countCaptures(rollId: string): Promise<number> {
  return (await listCaptures(rollId)).length;
}

export async function getCapture(id: string): Promise<Capture | undefined> {
  const db = await getDB();
  const capture = await db.get("captures", id);
  return capture && !capture.deletedAt ? capture : undefined;
}

export async function updateCapture(
  id: string,
  patch: Partial<Capture>,
): Promise<Capture | undefined> {
  const db = await getDB();
  const current = await db.get("captures", id);
  if (!current) return undefined;
  const next = { ...current, ...patch, id };
  await db.put("captures", next);
  emit("captures");
  return next;
}

export async function toggleFavorite(id: string): Promise<Capture | undefined> {
  const capture = await getCapture(id);
  if (!capture) return undefined;
  return updateCapture(id, { favorite: !capture.favorite });
}

export async function deleteCapture(id: string): Promise<void> {
  await updateCapture(id, { deletedAt: Date.now() });
}

export async function listFavorites(): Promise<Capture[]> {
  const db = await getDB();
  const all = await db.getAll("captures");
  return all
    .filter((capture) => capture.favorite && !capture.deletedAt)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Newest frames across every roll — powers the home screen's recent strip. */
export async function listRecentCaptures(limit = 12): Promise<Capture[]> {
  const db = await getDB();
  const all = await db.getAll("captures");
  return all
    .filter((capture) => !capture.deletedAt)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

/**
 * Picks which frame represents a roll.
 *
 * The most recent live frame, not the first: a roll's cover should show where
 * the evening got to, not how it started. Exported separately from
 * {@link rollCovers} so the rule can be tested without a storage engine.
 */
export function pickCover(captures: Capture[]): Capture | undefined {
  let best: Capture | undefined;
  for (const capture of captures) {
    if (capture.deletedAt) continue;
    if (!best || capture.createdAt > best.createdAt) best = capture;
  }
  return best;
}

/**
 * Cover thumbnails for a set of rolls, in one pass.
 *
 * Reads the thumbnails only — the full frames stay on disk, so rendering the
 * home screen costs a few hundred kilobytes rather than a few hundred megabytes.
 */
export async function rollCovers(rollIds: string[]): Promise<Record<string, Blob>> {
  const db = await getDB();
  const covers: Record<string, Blob> = {};
  for (const rollId of rollIds) {
    const cover = pickCover(await db.getAllFromIndex("captures", "by_roll", rollId));
    if (cover) covers[rollId] = cover.thumb;
  }
  return covers;
}

// ---------------------------------------------------------------------- strips

export type NewStrip = Omit<
  Strip,
  "id" | "createdAt" | "remoteId" | "storagePath" | "syncState" | "deletedAt" | "authorId"
> &
  Partial<Pick<Strip, "authorId">>;

export async function addStrip(input: NewStrip): Promise<Strip> {
  const db = await getDB();
  const strip: Strip = {
    ...input,
    id: newId(),
    createdAt: Date.now(),
    authorId: input.authorId ?? null,
    remoteId: null,
    storagePath: null,
    syncState: "local",
    deletedAt: null,
  };
  await db.put("strips", strip);
  emit("strips");
  return strip;
}

export async function listStrips(rollId?: string): Promise<Strip[]> {
  const db = await getDB();
  const all = rollId
    ? await db.getAllFromIndex("strips", "by_roll", rollId)
    : await db.getAll("strips");
  return all.filter((strip) => !strip.deletedAt).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getStrip(id: string): Promise<Strip | undefined> {
  const db = await getDB();
  const strip = await db.get("strips", id);
  return strip && !strip.deletedAt ? strip : undefined;
}

export async function deleteStrip(id: string): Promise<void> {
  const db = await getDB();
  const current = await db.get("strips", id);
  if (!current) return;
  await db.put("strips", { ...current, deletedAt: Date.now() });
  emit("strips");
}

// ------------------------------------------------------------- pulled records

/**
 * Writes records that came *from* the server.
 *
 * Separate from `addCapture` and friends because these keep the id the server
 * gave them — that id is what makes the record the same photograph on every
 * device, and minting a new one locally would duplicate it on the next pull.
 *
 * The pull engine decides whether a write should happen at all (see
 * `lib/sync/merge.ts`); these functions just perform it.
 */
export async function putRemoteRoll(roll: Roll): Promise<void> {
  const db = await getDB();
  await db.put("rolls", roll);
  emit("rolls");
}

export async function putRemoteCapture(capture: Capture): Promise<void> {
  const db = await getDB();
  await db.put("captures", capture);
  emit("captures");
}

export async function putRemoteStrip(strip: Strip): Promise<void> {
  const db = await getDB();
  await db.put("strips", strip);
  emit("strips");
}

/**
 * Raw lookups that ignore the usual tombstone filtering.
 *
 * The pull engine has to be able to see a local deletion in order to respect
 * it — the public getters hide deleted records, which would make a tombstone
 * look like "not here yet" and resurrect the photo on every sync.
 */
export async function findRecordMarker(
  store: "rolls" | "captures" | "strips",
  id: string,
): Promise<{ deletedAt: number | null; syncState: string; updatedAt?: number } | undefined> {
  const db = await getDB();
  const record = await db.get(store, id);
  if (!record) return undefined;
  return {
    deletedAt: record.deletedAt,
    syncState: record.syncState,
    updatedAt: "updatedAt" in record ? record.updatedAt : undefined,
  };
}

// --------------------------------------------------------------------- outbox

export async function enqueue(kind: OutboxKind, entityId: string): Promise<void> {
  const db = await getDB();
  // One pending item per entity+kind: re-uploading the same photo twice is
  // waste, and the latest record is always the one we want to send.
  const existing = (await db.getAll("outbox")).find(
    (item) => item.kind === kind && item.entityId === entityId,
  );
  if (existing) return;
  const item: OutboxItem = {
    id: newId(),
    kind,
    entityId,
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: Date.now(),
    lastError: null,
  };
  await db.put("outbox", item);
  emit("outbox");
}

export async function dueOutboxItems(limit = 10): Promise<OutboxItem[]> {
  const db = await getDB();
  const range = IDBKeyRange.upperBound(Date.now());
  const items = await db.getAllFromIndex("outbox", "by_next_attempt", range);
  return items.slice(0, limit);
}

export async function countOutbox(): Promise<number> {
  const db = await getDB();
  return db.count("outbox");
}

export async function completeOutboxItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("outbox", id);
  emit("outbox");
}

/** Exponential backoff, capped so a long outage doesn't park an item for days. */
export function backoffDelay(attempts: number): number {
  return Math.min(30 * 60 * 1000, 2 ** attempts * 5000);
}

export async function failOutboxItem(id: string, error: string): Promise<void> {
  const db = await getDB();
  const item = await db.get("outbox", id);
  if (!item) return;
  const attempts = item.attempts + 1;
  await db.put("outbox", {
    ...item,
    attempts,
    lastError: error,
    nextAttemptAt: Date.now() + backoffDelay(attempts),
  });
  emit("outbox");
}

// -------------------------------------------------------------- housekeeping

export interface StorageReport {
  usage: number;
  quota: number;
  rolls: number;
  captures: number;
  strips: number;
}

export async function storageReport(): Promise<StorageReport> {
  const db = await getDB();
  const estimate =
    typeof navigator !== "undefined" && navigator.storage?.estimate
      ? await navigator.storage.estimate()
      : {};
  return {
    usage: estimate.usage ?? 0,
    quota: estimate.quota ?? 0,
    rolls: await db.count("rolls"),
    captures: await db.count("captures"),
    strips: await db.count("strips"),
  };
}

/**
 * Reclaims space from tombstoned records that no longer need to sync.
 *
 * Only touches records that are either already gone from the server or were
 * never on it, so a deletion can never be lost before it propagates.
 */
export async function purgeDeleted(): Promise<number> {
  const db = await getDB();
  let purged = 0;
  for (const store of ["captures", "strips", "rolls"] as const) {
    const all = await db.getAll(store);
    for (const record of all) {
      if (!record.deletedAt) continue;
      if (record.syncState === "pending") continue;
      await db.delete(store, record.id);
      purged++;
    }
  }
  if (purged) {
    emit("rolls");
    emit("captures");
    emit("strips");
  }
  return purged;
}

/** Used by the privacy screen's "erase everything on this device" action. */
export async function eraseAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["rolls", "captures", "strips", "outbox"], "readwrite");
  await Promise.all([
    tx.objectStore("rolls").clear(),
    tx.objectStore("captures").clear(),
    tx.objectStore("strips").clear(),
    tx.objectStore("outbox").clear(),
  ]);
  await tx.done;
  emit("rolls");
  emit("captures");
  emit("strips");
  emit("outbox");
}
