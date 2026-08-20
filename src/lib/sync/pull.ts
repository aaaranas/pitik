import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findRecordMarker,
  putRemoteCapture,
  putRemoteRoll,
  putRemoteStrip,
} from "@/lib/db/repo";
import type { AspectId, Capture, CaptureSource, Roll, Strip } from "@/lib/db/types";
import { makeThumbnail } from "@/lib/filters/canvas";
import { PHOTO_BUCKET } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";
import { batched, decideBlobRecord, decideRoll, toEpoch } from "./merge";

/**
 * Pulling other people's contributions onto this device.
 *
 * This is the half of sync that makes a shared roll actually shared. It is
 * deliberately conservative: it only ever *adds* things this device does not
 * have, and refreshes roll metadata. Nothing it does can delete or overwrite a
 * photograph you took — see the invariants in `merge.ts`.
 *
 * Row Level Security does the access control, so these queries are unfiltered
 * by roll: the server returns exactly the rolls you are a member of and nothing
 * else. That is the whole reason the client is allowed to ask directly.
 */

type Client = SupabaseClient<Database>;

export interface PullResult {
  rolls: number;
  captures: number;
  strips: number;
  /** Records that could not be fetched. Reported, never thrown. */
  failed: number;
}

const EMPTY: PullResult = { rolls: 0, captures: 0, strips: 0, failed: 0 };

/**
 * Downloads one object and derives a thumbnail locally.
 *
 * Only the full-resolution frame is stored server-side — a thumbnail is cheap
 * to regenerate and expensive to store twice, and this keeps a shared roll from
 * doubling everyone's storage usage.
 */
async function fetchBlobWithThumb(
  client: Client,
  path: string,
): Promise<{ blob: Blob; thumb: Blob }> {
  const { data, error } = await client.storage.from(PHOTO_BUCKET).download(path);
  if (error || !data) throw new Error(error?.message ?? "The photo could not be downloaded.");

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(data);
    return { blob: data, thumb: await makeThumbnail(bitmap) };
  } finally {
    bitmap?.close();
  }
}

async function pullRolls(client: Client): Promise<{ ids: string[]; inserted: number }> {
  const { data, error } = await client
    .from("rolls")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const ids: string[] = [];
  let inserted = 0;

  for (const remote of data ?? []) {
    ids.push(remote.id);
    const local = await findRecordMarker("rolls", remote.id);
    const decision = decideRoll(local, { updatedAt: toEpoch(remote.updated_at) ?? 0 });
    if (decision === "skip") continue;

    const roll: Roll = {
      id: remote.id,
      title: remote.title,
      emoji: remote.emoji,
      coverStyle: (remote.cover_style as Roll["coverStyle"]) ?? "envelope",
      mode: (remote.mode as Roll["mode"]) ?? "standard",
      shotLimit: remote.shot_limit,
      revealAt: toEpoch(remote.reveal_at),
      developedAt: toEpoch(remote.developed_at),
      createdAt: toEpoch(remote.created_at) ?? Date.now(),
      updatedAt: toEpoch(remote.updated_at) ?? Date.now(),
      ownerId: remote.owner_id,
      remoteId: remote.id,
      shareCode: remote.share_code,
      syncState: "synced",
      deletedAt: null,
    };
    await putRemoteRoll(roll);
    if (decision === "insert") inserted++;
  }

  return { ids, inserted };
}

async function pullCaptures(
  client: Client,
  rollIds: string[],
): Promise<{ inserted: number; failed: number }> {
  let inserted = 0;
  let failed = 0;

  for (const batch of batched(rollIds)) {
    const { data, error } = await client
      .from("captures")
      .select("*")
      .in("roll_id", batch)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);

    for (const remote of data ?? []) {
      const local = await findRecordMarker("captures", remote.id);
      if (decideBlobRecord(local) === "skip") continue;

      try {
        const { blob, thumb } = await fetchBlobWithThumb(client, remote.storage_path);
        const capture: Capture = {
          id: remote.id,
          rollId: remote.roll_id,
          blob,
          thumb,
          width: remote.width,
          height: remote.height,
          createdAt: toEpoch(remote.taken_at) ?? Date.now(),
          filterId: remote.filter_id,
          profileId: remote.profile_id,
          aspect: remote.aspect as AspectId,
          favorite: remote.favorite,
          source: remote.source as CaptureSource,
          // Not knowable from the server, and only affects how a frame was
          // previewed — the stored pixels are already correct either way.
          mirrored: false,
          authorId: remote.author_id,
          remoteId: remote.id,
          storagePath: remote.storage_path,
          syncState: "synced",
          deletedAt: null,
        };
        await putRemoteCapture(capture);
        inserted++;
      } catch {
        // One unreachable object must not abandon the rest of the roll; the
        // next pull will retry it.
        failed++;
      }
    }
  }

  return { inserted, failed };
}

async function pullStrips(
  client: Client,
  rollIds: string[],
): Promise<{ inserted: number; failed: number }> {
  let inserted = 0;
  let failed = 0;

  for (const batch of batched(rollIds)) {
    const { data, error } = await client
      .from("strips")
      .select("*")
      .in("roll_id", batch)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);

    for (const remote of data ?? []) {
      const local = await findRecordMarker("strips", remote.id);
      if (decideBlobRecord(local) === "skip") continue;

      try {
        const { blob, thumb } = await fetchBlobWithThumb(client, remote.storage_path);
        const strip: Strip = {
          id: remote.id,
          rollId: remote.roll_id,
          templateId: remote.template_id,
          blob,
          thumb,
          width: remote.width,
          height: remote.height,
          captureIds: [],
          caption: remote.caption,
          createdAt: toEpoch(remote.created_at) ?? Date.now(),
          authorId: remote.author_id,
          remoteId: remote.id,
          storagePath: remote.storage_path,
          syncState: "synced",
          deletedAt: null,
        };
        await putRemoteStrip(strip);
        inserted++;
      } catch {
        failed++;
      }
    }
  }

  return { inserted, failed };
}

/**
 * Fetches everything this account can see that this device does not have.
 *
 * Safe to call repeatedly — it is idempotent, and a roll with nothing new costs
 * three cheap queries and no downloads.
 */
export async function pullRemote(client: Client): Promise<PullResult> {
  const { ids, inserted } = await pullRolls(client);
  if (ids.length === 0) return { ...EMPTY, rolls: inserted };

  const captures = await pullCaptures(client, ids);
  const strips = await pullStrips(client, ids);

  return {
    rolls: inserted,
    captures: captures.inserted,
    strips: strips.inserted,
    failed: captures.failed + strips.failed,
  };
}
