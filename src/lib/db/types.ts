/**
 * The Pitik domain model.
 *
 * These types describe the *local* record shape. IndexedDB is the source of
 * truth: a photo exists the moment the shutter fires, whether or not the user
 * has an account and whether or not there is a network. Supabase mirrors these
 * records; it never owns them.
 */

/** Where a record stands relative to the server. */
export type SyncState =
  /** Lives only on this device. Either the user is a guest, or sync is off. */
  | "local"
  /** Queued in the outbox, waiting for connectivity or a retry. */
  | "pending"
  /** Confirmed present on the server. */
  | "synced"
  /** Upload failed permanently enough to tell the user about. */
  | "error";

export type RollMode =
  /** Photos appear the instant they are taken. */
  | "standard"
  /** Fixed shot count, hidden until developed. */
  | "disposable";

/** Purely visual treatment for the roll's card on the home screen. */
export type CoverStyle = "envelope" | "contact" | "sleeve" | "polaroid";

export const COVER_STYLES: CoverStyle[] = ["envelope", "contact", "sleeve", "polaroid"];

export type AspectId = "original" | "1:1" | "4:3" | "3:2" | "16:9";

export interface Roll {
  id: string;
  title: string;
  emoji: string | null;
  coverStyle: CoverStyle;
  mode: RollMode;
  /** Disposable rolls only: how many frames are on the roll. */
  shotLimit: number | null;
  /** Disposable rolls only: epoch ms before which captures stay hidden. */
  revealAt: number | null;
  /** Set once a disposable roll has been developed, so it never re-hides. */
  developedAt: number | null;
  createdAt: number;
  updatedAt: number;
  /** Supabase user id, once the roll has been claimed by an account. */
  ownerId: string | null;
  remoteId: string | null;
  /** Short code used by the join link and QR invite. */
  shareCode: string | null;
  syncState: SyncState;
  /** Soft delete — kept so the tombstone can propagate to the server. */
  deletedAt: number | null;
}

export type CaptureSource = "camera" | "booth" | "import";

export interface Capture {
  id: string;
  rollId: string;
  /** Full-resolution graded JPEG. The only copy that matters. */
  blob: Blob;
  /** Contact-sheet sized JPEG, so galleries never decode full frames. */
  thumb: Blob;
  width: number;
  height: number;
  createdAt: number;
  filterId: string;
  profileId: string;
  aspect: AspectId;
  favorite: boolean;
  source: CaptureSource;
  /** True when the frame came from a mirrored (selfie) preview. */
  mirrored: boolean;
  /**
   * Supabase user id of whoever took it, once known. `null` means "this
   * device" — which is every frame until a shared roll is pulled.
   */
  authorId: string | null;
  remoteId: string | null;
  storagePath: string | null;
  syncState: SyncState;
  deletedAt: number | null;
}

/**
 * A clip of the booth sequence, paired with the strip it came from.
 *
 * Optional on purpose: strips recorded before this existed, and strips from
 * browsers that cannot record, simply have no motion. Making it optional is
 * what lets the field be added without a schema version bump.
 */
export interface MotionAttachment {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export interface Strip {
  id: string;
  rollId: string;
  templateId: string;
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
  captureIds: string[];
  caption: string | null;
  createdAt: number;
  /**
   * The whole shoot as a short clip, when the device could record one.
   *
   * Deliberately excluded from sync — see `lib/sync/engine.ts`.
   */
  motion?: MotionAttachment;
  /** Supabase user id of whoever composed it. `null` means this device. */
  authorId: string | null;
  remoteId: string | null;
  storagePath: string | null;
  syncState: SyncState;
  deletedAt: number | null;
}

export type OutboxKind =
  | "roll.upsert"
  | "roll.delete"
  | "capture.upload"
  | "capture.delete"
  | "strip.upload"
  | "strip.delete";

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  entityId: string;
  createdAt: number;
  attempts: number;
  /** Epoch ms before which this item should not be retried (backoff). */
  nextAttemptAt: number;
  lastError: string | null;
}

export interface Settings {
  /** Stable anonymous id so guest rolls can be claimed on sign-up. */
  deviceId: string;
  shutterSound: boolean;
  haptics: boolean;
  gridOverlay: boolean;
  mirrorSelfie: boolean;
  defaultAspect: AspectId;
  defaultFilterId: string;
  defaultProfileId: string;
  /** Off by default — sync is opt-in, not a dark pattern. */
  syncEnabled: boolean;
  onboarded: boolean;
  /** Live filter preview can be dropped on low-end devices. */
  livePreview: boolean;
  saveOriginals: boolean;
}

export const DEFAULT_SETTINGS: Omit<Settings, "deviceId"> = {
  shutterSound: true,
  haptics: true,
  gridOverlay: false,
  mirrorSelfie: true,
  defaultAspect: "4:3",
  // Camera Mode is a digicam, so it opens on a camera model rather than on a
  // neutral grade. `2003` is PowerShot; see `lib/filters/presets.ts`.
  defaultFilterId: "2003",
  defaultProfileId: "everyday",
  syncEnabled: false,
  onboarded: false,
  livePreview: true,
  saveOriginals: false,
};

/** Numeric width/height ratio for each supported framing. */
export const ASPECT_RATIOS: Record<AspectId, number | null> = {
  original: null,
  "1:1": 1,
  "4:3": 4 / 3,
  "3:2": 3 / 2,
  "16:9": 16 / 9,
};

export const ASPECT_IDS: AspectId[] = ["original", "1:1", "4:3", "3:2", "16:9"];
