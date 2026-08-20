import { CameraError, toCameraError } from "./errors";

/**
 * A thin, honest wrapper over MediaDevices.
 *
 * Two jobs: get the best stream a given device can actually deliver, and report
 * truthfully which optional controls exist. Nothing in the UI may assume torch,
 * zoom, or focus is available — support is wildly uneven, and a control that
 * pretends to work is worse than one that isn't shown.
 */

export type Facing = "user" | "environment";

export interface CameraCapabilities {
  torch: boolean;
  zoom: { min: number; max: number; step: number } | null;
  /** Manual exposure compensation, in the device's own units. */
  exposure: { min: number; max: number; step: number } | null;
  /** Whether `pointsOfInterest` can be applied — i.e. tap-to-focus is real. */
  tapToFocus: boolean;
  /** More than one camera to switch between. */
  multipleCameras: boolean;
}

export interface ActiveCamera {
  stream: MediaStream;
  track: MediaStreamTrack;
  facing: Facing;
  capabilities: CameraCapabilities;
  settings: MediaTrackSettings;
}

/**
 * Non-standard track capabilities. These ship in Chromium and partially in
 * Safari, and are entirely absent in Firefox, so every read is defensive.
 */
interface ExtendedCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
  zoom?: { min: number; max: number; step?: number };
  exposureCompensation?: { min: number; max: number; step?: number };
  focusMode?: string[];
  pointsOfInterest?: unknown;
}

interface ExtendedConstraints {
  torch?: boolean;
  zoom?: number;
  exposureCompensation?: number;
  focusMode?: string;
  pointsOfInterest?: { x: number; y: number }[];
}

export function isCameraSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/**
 * Reads permission state *without* prompting, so the home screen can decide
 * whether to show a permission primer. Not implemented everywhere; `unknown`
 * simply means "ask when the user taps, like normal".
 */
export async function permissionState(): Promise<PermissionState | "unknown"> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";
  try {
    const status = await navigator.permissions.query({
      name: "camera" as PermissionName,
    });
    return status.state;
  } catch {
    return "unknown";
  }
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput");
}

function readCapabilities(
  track: MediaStreamTrack,
  multipleCameras: boolean,
): CameraCapabilities {
  let caps: ExtendedCapabilities = {};
  try {
    caps = (track.getCapabilities?.() ?? {}) as ExtendedCapabilities;
  } catch {
    // Firefox throws rather than returning an empty object.
  }
  return {
    torch: caps.torch === true,
    zoom:
      caps.zoom && caps.zoom.max > caps.zoom.min
        ? { min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step ?? 0.1 }
        : null,
    exposure:
      caps.exposureCompensation &&
      caps.exposureCompensation.max > caps.exposureCompensation.min
        ? {
            min: caps.exposureCompensation.min,
            max: caps.exposureCompensation.max,
            step: caps.exposureCompensation.step ?? 0.1,
          }
        : null,
    tapToFocus: Array.isArray(caps.focusMode) && caps.focusMode.includes("manual"),
    multipleCameras,
  };
}

/**
 * Longest edge requested from the sensor.
 *
 * Deliberately not 4K. A 3840x2160 track is 8.3 megapixels arriving sixty times
 * a second, and every one of them has to be scaled for the preview and pushed
 * through the grading pipeline on capture — which measured at roughly three
 * seconds per photograph. 1920 is a quarter of the pixels, and it is also the
 * honest resolution for this product: the cameras these filters imitate shot
 * between two and five megapixels.
 */
const IDEAL_WIDTH = 1920;
const IDEAL_HEIGHT = 1080;

/**
 * Opens a camera.
 *
 * Resolution is requested as an *ideal*, never exact: asking for an exact size
 * a device can't do fails the whole call, and a lower-resolution photo is
 * infinitely better than no photo. If the browser still refuses, we retry once
 * with bare constraints before giving up.
 */
export async function openCamera(options: {
  facing: Facing;
  deviceId?: string;
}): Promise<ActiveCamera> {
  if (!isCameraSupported()) {
    throw new CameraError(
      "unsupported",
      "This browser can't open a camera.",
      "Try Safari on iOS, or Chrome on Android and desktop.",
    );
  }

  const ideal: MediaStreamConstraints = {
    audio: false,
    video: options.deviceId
      ? {
          deviceId: { exact: options.deviceId },
          width: { ideal: IDEAL_WIDTH },
          height: { ideal: IDEAL_HEIGHT },
        }
      : {
          facingMode: { ideal: options.facing },
          width: { ideal: IDEAL_WIDTH },
          height: { ideal: IDEAL_HEIGHT },
        },
  };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(ideal);
  } catch (error) {
    const mapped = toCameraError(error);
    // Only a constraints problem is worth retrying — a denial won't change.
    if (mapped.code !== "overconstrained") throw mapped;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    } catch (retryError) {
      throw toCameraError(retryError);
    }
  }

  const track = stream.getVideoTracks()[0];
  if (!track) {
    stream.getTracks().forEach((t) => t.stop());
    throw new CameraError("not-found", "The camera opened without a video track.");
  }

  const cameras = await listCameras();
  const settings = track.getSettings();
  return {
    stream,
    track,
    // Trust the track's own report over what we asked for.
    facing: (settings.facingMode as Facing) ?? options.facing,
    capabilities: readCapabilities(track, cameras.length > 1),
    settings,
  };
}

export function closeCamera(camera: ActiveCamera | null): void {
  camera?.stream.getTracks().forEach((track) => track.stop());
}

async function applyExtended(
  track: MediaStreamTrack,
  constraints: ExtendedConstraints,
): Promise<boolean> {
  try {
    await track.applyConstraints({ advanced: [constraints] } as MediaTrackConstraints);
    return true;
  } catch {
    // A rejected optional constraint is normal, not exceptional — the caller
    // reflects the failure by leaving its control unchanged.
    return false;
  }
}

export function setTorch(track: MediaStreamTrack, on: boolean): Promise<boolean> {
  return applyExtended(track, { torch: on });
}

export function setZoom(track: MediaStreamTrack, zoom: number): Promise<boolean> {
  return applyExtended(track, { zoom });
}

export function setExposure(track: MediaStreamTrack, value: number): Promise<boolean> {
  return applyExtended(track, { exposureCompensation: value });
}

/** `x` and `y` are normalised 0..1 in the *unmirrored* frame. */
export function focusAt(track: MediaStreamTrack, x: number, y: number): Promise<boolean> {
  return applyExtended(track, {
    focusMode: "manual",
    pointsOfInterest: [{ x, y }],
  });
}

export { CameraError, toCameraError };

/**
 * Whether a video element can actually be drawn from right now.
 *
 * Both halves matter. `videoWidth` becomes non-zero at HAVE_METADATA, which is
 * when the *dimensions* are known — but no pixels have been decoded yet, and
 * `createImageBitmap` on that element throws "The image source is not usable".
 * Only from HAVE_CURRENT_DATA is there a frame to copy.
 *
 * Getting this wrong is invisible in manual testing (a human is never fast
 * enough to hit the window) and loses roughly one in four photos for anyone who
 * taps the shutter the instant the preview appears.
 */
export function isFrameReady(video: {
  videoWidth: number;
  videoHeight: number;
  readyState: number;
}): boolean {
  return (
    video.videoWidth > 0 &&
    video.videoHeight > 0 &&
    // HTMLMediaElement.HAVE_CURRENT_DATA
    video.readyState >= 2
  );
}

/**
 * Waits until the video element actually has a frame to capture.
 *
 * There is a real window — usually a few hundred milliseconds, longer on cold
 * hardware — between the preview element being bound to a live stream and the
 * first decoded frame arriving.
 *
 * The camera must never silently ignore a press, so callers await this instead
 * of testing readiness and giving up. Resolves `false` only if no frame arrives
 * at all, which is a genuine failure worth telling the user about.
 */
export function waitForFrame(video: HTMLVideoElement, timeoutMs = 3000): Promise<boolean> {
  if (isFrameReady(video)) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    let frame = 0;
    let timer = 0;

    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      video.removeEventListener("loadeddata", onEvent);
      video.removeEventListener("canplay", onEvent);
      video.removeEventListener("resize", onEvent);
      resolve(ready);
    };

    const onEvent = () => {
      if (isFrameReady(video)) finish(true);
    };

    // Events cover the common path; the animation-frame poll covers browsers
    // that reach a usable state without firing any of them.
    const poll = () => {
      if (isFrameReady(video)) finish(true);
      else frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    timer = window.setTimeout(() => finish(false), timeoutMs);

    video.addEventListener("loadeddata", onEvent);
    video.addEventListener("canplay", onEvent);
    video.addEventListener("resize", onEvent);
  });
}
