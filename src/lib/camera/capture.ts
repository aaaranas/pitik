import {
  canvasToBlob,
  formatCameraTimestamp,
  makeThumbnail,
  renderCapture,
} from "@/lib/filters/canvas";
import { composeAdjustments, getProfile } from "@/lib/filters/registry";
import { addCapture } from "@/lib/db/repo";
import { ASPECT_RATIOS, type AspectId, type Capture, type CaptureSource } from "@/lib/db/types";

/**
 * The shutter path: video frame in, stored `Capture` out.
 *
 * Kept deliberately short and synchronous-feeling. The user has already heard
 * the shutter by the time this runs, so anything slow in here shows up as the
 * camera "sticking" between shots.
 */

export interface CaptureRequest {
  source: CanvasImageSource;
  rollId: string;
  filterId: string;
  profileId: string;
  aspect: AspectId;
  mirrored: boolean;
  captureSource?: CaptureSource;
  /** JPEG quality. Lowered only by the booth, which composites afterwards. */
  quality?: number;
}

export async function captureFrame(request: CaptureRequest): Promise<Capture> {
  const profile = getProfile(request.profileId);
  const adjustments = composeAdjustments({
    profileId: request.profileId,
    filterId: request.filterId,
  });

  const canvas = renderCapture(request.source, {
    adjustments,
    mirror: request.mirrored,
    aspect: ASPECT_RATIOS[request.aspect],
    // Seeded per-shot so two photos taken seconds apart don't share a grain
    // pattern, which would read as a static overlay rather than film.
    seed: Date.now() & 0xffff,
    timestamp: profile.timestamp ? formatCameraTimestamp(new Date()) : null,
  });

  const blob = await canvasToBlob(canvas, "image/jpeg", request.quality ?? 0.92);
  const thumb = await makeThumbnail(canvas as CanvasImageSource);

  return addCapture({
    rollId: request.rollId,
    blob,
    thumb,
    width: canvas.width,
    height: canvas.height,
    filterId: request.filterId,
    profileId: request.profileId,
    aspect: request.aspect,
    source: request.captureSource ?? "camera",
    mirrored: request.mirrored,
  });
}

/**
 * Renders a frame without storing it.
 *
 * Used by the photobooth, which holds its sequence in memory until the strip is
 * composed and the user decides to keep it. Takes a numeric aspect rather than
 * an `AspectId` because booth frames are cropped to whatever shape the chosen
 * template's slot happens to be, not to one of the camera's presets.
 */
export async function renderFrame(request: {
  source: CanvasImageSource;
  filterId: string;
  profileId: string;
  aspectRatio: number | null;
  mirrored: boolean;
  quality?: number;
}): Promise<{ blob: Blob; bitmap: ImageBitmap; width: number; height: number }> {
  const profile = getProfile(request.profileId);
  const canvas = renderCapture(request.source, {
    adjustments: composeAdjustments({
      profileId: request.profileId,
      filterId: request.filterId,
    }),
    mirror: request.mirrored,
    aspect: request.aspectRatio,
    seed: Date.now() & 0xffff,
    timestamp: profile.timestamp ? formatCameraTimestamp(new Date()) : null,
  });
  const blob = await canvasToBlob(canvas, "image/jpeg", request.quality ?? 0.94);
  return {
    blob,
    bitmap: await createImageBitmap(canvas as ImageBitmapSource),
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Decodes a user-supplied file.
 *
 * `imageOrientation: "from-image"` is what makes imported phone photos land the
 * right way up: JPEGs carry rotation in EXIF rather than in their pixels, and
 * drawing one to a canvas without this flag silently loses it.
 */
export async function decodeImageFile(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} isn't an image Pitik can read.`);
  }
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Safari <15 ignores the options bag and older engines reject it outright.
    return createImageBitmap(file);
  }
}

/** Brings photos in from the gallery, grading them like any other capture. */
export async function importFiles(options: {
  files: FileList | File[];
  rollId: string;
  filterId: string;
  profileId: string;
  aspect: AspectId;
}): Promise<{ captures: Capture[]; failures: { name: string; reason: string }[] }> {
  const captures: Capture[] = [];
  const failures: { name: string; reason: string }[] = [];

  for (const file of Array.from(options.files)) {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await decodeImageFile(file);
      captures.push(
        await captureFrame({
          source: bitmap,
          rollId: options.rollId,
          filterId: options.filterId,
          profileId: options.profileId,
          aspect: options.aspect,
          mirrored: false,
          captureSource: "import",
        }),
      );
    } catch (error) {
      failures.push({
        name: file.name,
        reason: error instanceof Error ? error.message : "Could not be read.",
      });
    } finally {
      // ImageBitmaps hold real GPU memory; importing an album without closing
      // them will take the tab down.
      bitmap?.close();
    }
  }

  return { captures, failures };
}
