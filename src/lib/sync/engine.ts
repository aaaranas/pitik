import type { SupabaseClient } from "@supabase/supabase-js";
import { getDB } from "@/lib/db/schema";
import {
  completeOutboxItem,
  dueOutboxItems,
  enqueue,
  failOutboxItem,
  updateCapture,
  updateRoll,
} from "@/lib/db/repo";
import type { Capture, Roll, Strip } from "@/lib/db/types";
import { pullRemote } from "./pull";
import { PHOTO_BUCKET } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Outbox-driven sync — the push half.
 *
 * The device is the source of truth and the server is a mirror. Uploads move
 * through the outbox, so an upload interrupted by a dead tunnel resumes on its
 * own and a queued item survives a force-quit.
 *
 * The pull half lives in `pull.ts` and is deliberately additive: it can create
 * records this device is missing, but nothing the server says can delete or
 * overwrite a photograph you took. See `merge.ts` for the invariants.
 */

type Client = SupabaseClient<Database>;

export interface SyncResult {
  processed: number;
  failed: number;
  remaining: number;
}

function storagePath(userId: string, rollId: string, id: string, extension: string): string {
  // The first segment must be the user id: the storage policies key write
  // access off it, so this shape is a security boundary, not a convention.
  return `${userId}/${rollId}/${id}.${extension}`;
}

function extensionFor(blob: Blob): string {
  if (blob.type.includes("png")) return "png";
  if (blob.type.includes("webp")) return "webp";
  return "jpg";
}

async function pushRoll(client: Client, roll: Roll, userId: string): Promise<void> {
  // A roll you joined belongs to somebody else. Pushing it would claim
  // ownership, which RLS rejects outright — and rightly so. The owner keeps the
  // metadata up to date; contributors only ever add captures to it.
  if (roll.ownerId && roll.ownerId !== userId) {
    await updateRoll(roll.id, { syncState: "synced", updatedAt: roll.updatedAt });
    return;
  }

  const { error } = await client.from("rolls").upsert({
    id: roll.id,
    owner_id: userId,
    title: roll.title,
    emoji: roll.emoji,
    cover_style: roll.coverStyle,
    mode: roll.mode,
    shot_limit: roll.shotLimit,
    reveal_at: roll.revealAt ? new Date(roll.revealAt).toISOString() : null,
    developed_at: roll.developedAt ? new Date(roll.developedAt).toISOString() : null,
    share_code: roll.shareCode,
    created_at: new Date(roll.createdAt).toISOString(),
    updated_at: new Date(roll.updatedAt).toISOString(),
    deleted_at: roll.deletedAt ? new Date(roll.deletedAt).toISOString() : null,
  });
  if (error) throw new Error(error.message);
  await updateRoll(roll.id, { remoteId: roll.id, ownerId: userId, syncState: "synced" });
}

async function pushCapture(client: Client, capture: Capture, userId: string): Promise<void> {
  const path = storagePath(userId, capture.rollId, capture.id, extensionFor(capture.blob));

  const upload = await client.storage.from(PHOTO_BUCKET).upload(path, capture.blob, {
    contentType: capture.blob.type || "image/jpeg",
    // Idempotent: a retry after a half-finished upload overwrites rather than
    // failing on a duplicate key.
    upsert: true,
  });
  if (upload.error) throw new Error(upload.error.message);

  const { error } = await client.from("captures").upsert({
    id: capture.id,
    roll_id: capture.rollId,
    author_id: userId,
    storage_path: path,
    width: capture.width,
    height: capture.height,
    filter_id: capture.filterId,
    profile_id: capture.profileId,
    aspect: capture.aspect,
    source: capture.source,
    favorite: capture.favorite,
    taken_at: new Date(capture.createdAt).toISOString(),
    deleted_at: capture.deletedAt ? new Date(capture.deletedAt).toISOString() : null,
  });
  if (error) {
    // The object is uploaded but unreferenced. Leaving it costs a little
    // storage; deleting it would risk removing a photo whose row landed on a
    // previous attempt.
    throw new Error(error.message);
  }

  await updateCapture(capture.id, { storagePath: path, remoteId: capture.id, syncState: "synced" });
}

async function pushStrip(client: Client, strip: Strip, userId: string): Promise<void> {
  const path = storagePath(userId, strip.rollId, `strip-${strip.id}`, extensionFor(strip.blob));
  const upload = await client.storage.from(PHOTO_BUCKET).upload(path, strip.blob, {
    contentType: strip.blob.type || "image/png",
    upsert: true,
  });
  if (upload.error) throw new Error(upload.error.message);

  const { error } = await client.from("strips").upsert({
    id: strip.id,
    roll_id: strip.rollId,
    author_id: userId,
    template_id: strip.templateId,
    storage_path: path,
    width: strip.width,
    height: strip.height,
    caption: strip.caption,
    deleted_at: strip.deletedAt ? new Date(strip.deletedAt).toISOString() : null,
  });
  if (error) throw new Error(error.message);

  const db = await getDB();
  const current = await db.get("strips", strip.id);
  if (current) {
    await db.put("strips", { ...current, storagePath: path, remoteId: strip.id, syncState: "synced" });
  }
}

/**
 * Queues everything that has never been sent.
 *
 * Run on sign-in and whenever sync is switched on, so photos taken as a guest
 * are adopted rather than stranded. Idempotent — `enqueue` collapses duplicates.
 */
export async function reconcile(): Promise<number> {
  const db = await getDB();
  let queued = 0;

  for (const roll of await db.getAll("rolls")) {
    if (roll.syncState === "synced") continue;
    await enqueue(roll.deletedAt ? "roll.delete" : "roll.upsert", roll.id);
    queued++;
  }
  for (const capture of await db.getAll("captures")) {
    if (capture.syncState === "synced") continue;
    await enqueue(capture.deletedAt ? "capture.delete" : "capture.upload", capture.id);
    queued++;
  }
  for (const strip of await db.getAll("strips")) {
    if (strip.syncState === "synced") continue;
    await enqueue(strip.deletedAt ? "strip.delete" : "strip.upload", strip.id);
    queued++;
  }

  return queued;
}

/**
 * Drains the outbox.
 *
 * Rolls are processed before their contents because a capture row has a foreign
 * key to its roll; the queue is otherwise ordered by when items became due.
 */
export async function syncNow(client: Client, userId: string): Promise<SyncResult> {
  const db = await getDB();
  const items = await dueOutboxItems(25);
  const ordered = [...items].sort((a, b) => Number(b.kind.startsWith("roll")) - Number(a.kind.startsWith("roll")));

  let processed = 0;
  let failed = 0;

  for (const item of ordered) {
    try {
      switch (item.kind) {
        case "roll.upsert": {
          const roll = await db.get("rolls", item.entityId);
          if (roll) await pushRoll(client, roll, userId);
          break;
        }
        case "capture.upload": {
          const capture = await db.get("captures", item.entityId);
          if (capture && !capture.deletedAt) await pushCapture(client, capture, userId);
          break;
        }
        case "strip.upload": {
          const strip = await db.get("strips", item.entityId);
          if (strip && !strip.deletedAt) await pushStrip(client, strip, userId);
          break;
        }
        case "roll.delete": {
          const { error } = await client
            .from("rolls")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", item.entityId);
          if (error) throw new Error(error.message);
          break;
        }
        case "capture.delete": {
          const { error } = await client
            .from("captures")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", item.entityId);
          if (error) throw new Error(error.message);
          break;
        }
        case "strip.delete": {
          const { error } = await client
            .from("strips")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", item.entityId);
          if (error) throw new Error(error.message);
          break;
        }
      }
      await completeOutboxItem(item.id);
      processed++;
    } catch (error) {
      await failOutboxItem(item.id, error instanceof Error ? error.message : "Upload failed.");
      failed++;
    }
  }

  return { processed, failed, remaining: await db.count("outbox") };
}

export interface FullSyncResult extends SyncResult {
  pulled: { rolls: number; captures: number; strips: number; failed: number };
}

/**
 * One round of sync: queue anything new, push it, then pull what others added.
 *
 * Push before pull so that a frame taken seconds ago is on the server before we
 * ask what is there — otherwise a shared roll can look, for one refresh, like
 * it is missing your own photo.
 */
export async function syncAll(client: Client, userId: string): Promise<FullSyncResult> {
  await reconcile();
  const pushed = await syncNow(client, userId);
  const pulled = await pullRemote(client);
  return { ...pushed, pulled };
}
