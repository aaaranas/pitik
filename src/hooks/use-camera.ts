"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCapability } from "./use-now";
import {
  type ActiveCamera,
  CameraError,
  type CameraCapabilities,
  closeCamera,
  type Facing,
  findUltraWide,
  focusAt as focusTrackAt,
  isCameraSupported,
  listCameras,
  ultraWideZoom,
  openCamera,
  permissionState,
  setExposure as setTrackExposure,
  setTorch as setTrackTorch,
  setZoom as setTrackZoom,
  toCameraError,
} from "@/lib/camera/service";

export type CameraStatus = "idle" | "starting" | "ready" | "error";

export interface CameraController {
  /** Read `.current` to grab a frame. Do NOT put this on the element. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /**
   * Callback ref for the <video> element itself.
   *
   * A callback ref rather than the object above, because the preview can be
   * re-parented — swapping camera profiles wraps it in a body shell, which
   * unmounts one element and mounts another. An object ref would silently point
   * at the new node with no signal to re-bind, leaving a black preview behind a
   * perfectly healthy stream. This fires on every mount, so binding cannot be
   * missed.
   */
  attachVideo: (node: HTMLVideoElement | null) => void;
  /**
   * The live stream, for consumers that need the media itself rather than a
   * preview of it — currently the booth's clip recorder. Null whenever the
   * camera is not running. Consumers must never stop its tracks; this hook owns
   * the lifetime.
   */
  stream: MediaStream | null;
  /**
   * Width/height of the frames the sensor is actually delivering.
   *
   * The viewfinder is shaped to this so that what is on screen is exactly what
   * the shutter will capture — there is no aspect-ratio control any more, and a
   * preview cropped differently from the photograph would be a lie.
   */
  frameAspect: number | null;
  status: CameraStatus;
  error: CameraError | null;
  facing: Facing;
  capabilities: CameraCapabilities | null;
  torch: boolean;
  zoom: number;
  exposure: number;
  supported: boolean;
  /** `prompt` means the browser will ask when `start` is called. */
  permission: PermissionState | "unknown";
  start: () => Promise<void>;
  stop: () => void;
  flip: () => Promise<void>;
  toggleTorch: () => Promise<void>;
  setZoom: (value: number) => Promise<void>;
  setExposure: (value: number) => Promise<void>;
  /** `x`/`y` normalised 0..1 in displayed-frame space. */
  focusAt: (x: number, y: number) => Promise<boolean>;

  /**
   * Whether this device has an ultra-wide lens on the current side.
   *
   * False on most phones and on every laptop, which is precisely when the 0.5x
   * control must not be rendered.
   */
  hasUltraWide: boolean;
  /** Which lens is live. */
  lens: Lens;
  setLens: (lens: Lens) => Promise<void>;
  /**
   * Labels of every camera this browser will name.
   *
   * Surfaced in Settings purely as a diagnostic: lens detection depends on
   * vendor labels, and when it fails the only way to find out why is to see
   * what the device actually reported.
   */
  cameraLabels: string[];
}

/** 1x main camera, or the 0.5x ultra-wide module beside it. */
export type Lens = "wide" | "ultra";

const EMPTY_CAPABILITIES: CameraCapabilities = {
  torch: false,
  zoom: null,
  exposure: null,
  tapToFocus: false,
  multipleCameras: false,
};

/**
 * Owns the live camera for one screen.
 *
 * Three rules this hook exists to enforce:
 *  - Exactly one stream is open at a time. Two `getUserMedia` calls racing each
 *    other is the single most common way a camera app ends up with a black
 *    preview on Android.
 *  - The stream is released when the page is hidden. iOS will otherwise keep
 *    the privacy indicator lit and may drop the track without telling us.
 *  - Opening is explicit. With `autoStart` the screen asks for it on mount, so
 *    the camera is live the moment you arrive rather than behind a tap; without
 *    it nothing opens until `start()` is called.
 */
export function useCamera(options: {
  initialFacing?: Facing;
  /** Reopen automatically when the tab becomes visible again. */
  resumeOnVisible?: boolean;
  /**
   * Open the camera as soon as the screen mounts.
   *
   * A camera app should be ready when you arrive; making people tap a button
   * first is a step between them and the moment they opened the app to catch.
   * The browser still shows its own permission prompt the first time, and a
   * refusal still surfaces as an error the user can act on.
   */
  autoStart?: boolean;
} = {}): CameraController {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  /**
   * Bumped every time a <video> element mounts.
   *
   * The element itself stays in a ref rather than in state: it is a mutable DOM
   * node that the binding effect writes `srcObject` to, and state is supposed
   * to hold values nobody mutates. This counter carries the *signal* that a new
   * element has arrived, which is all the effect actually needs.
   */
  const [videoGeneration, setVideoGeneration] = useState(0);
  const cameraRef = useRef<ActiveCamera | null>(null);
  /** Guards against overlapping start calls (double-tap, fast flip). */
  const startingRef = useRef<Promise<void> | null>(null);
  const wasRunningRef = useRef(false);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<CameraError | null>(null);
  const [facing, setFacing] = useState<Facing>(options.initialFacing ?? "user");
  const [capabilities, setCapabilities] = useState<CameraCapabilities | null>(null);
  /** The live stream, held in state so the binding effect below can react to
   *  it. `cameraRef` holds the same stream for imperative teardown. */
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torch, setTorchState] = useState(false);
  const [zoom, setZoomState] = useState(1);
  const [exposure, setExposureState] = useState(0);
  const [frameAspect, setFrameAspect] = useState<number | null>(null);
  const [lens, setLensState] = useState<Lens>("wide");
  /** Device id of the ultra-wide on this side, once labels are readable. */
  const [ultraWideId, setUltraWideId] = useState<string | null>(null);
  /** Every video device this browser will name, for the diagnostic. */
  const [cameraLabels, setCameraLabels] = useState<string[]>([]);
  const [permission, setPermission] = useState<PermissionState | "unknown">("unknown");
  // A browser capability, not app state: read through an external store so the
  // server render stays optimistic and hydration doesn't flicker the gate.
  const supported = useCapability(isCameraSupported);

  useEffect(() => {
    void (async () => {
      setPermission(await permissionState());
    })();
  }, []);

  /**
   * Binds the live stream to the <video> element.
   *
   * This has to be an effect rather than part of `openCamera`, because until
   * the status flips to "ready" the screen is showing the permission gate and
   * there is no video element to bind to. Attaching eagerly leaves `srcObject`
   * unset on the element that eventually mounts — a permanently black preview
   * with a perfectly healthy MediaStream behind it.
   */
  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    if (node) {
      // Set here, on arrival, rather than in the binding effect. Both are also
      // declared as JSX attributes, but iOS is unreliable about `muted` unless
      // the property itself is set, and without it Safari hijacks the preview
      // into a fullscreen native player.
      node.playsInline = true;
      node.muted = true;
    }
    videoRef.current = node;
    if (node) setVideoGeneration((generation) => generation + 1);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    void video.play().catch(() => {
      // Autoplay can be refused before the first gesture; the stream is live
      // either way and the next tap starts it.
    });

    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream, videoGeneration]);

  const openInternal = useCallback(async (nextFacing: Facing, deviceId?: string) => {
    setStatus("starting");
    setError(null);
    setStream(null);
    try {
      closeCamera(cameraRef.current);
      cameraRef.current = null;

      const camera = await openCamera({ facing: nextFacing, deviceId });
      cameraRef.current = camera;
      setFacing(camera.facing);
      setCapabilities(camera.capabilities);
      setTorchState(false);
      setFrameAspect(
        camera.settings.width && camera.settings.height
          ? camera.settings.width / camera.settings.height
          : null,
      );
      setZoomState(camera.capabilities.zoom?.min ?? 1);
      setExposureState(0);
      wasRunningRef.current = true;
      // Both in the same commit: the video element mounts and the binding
      // effect runs immediately after, with the ref already populated.
      setStream(camera.stream);
      setStatus("ready");
      // Labels — and therefore both the camera count and any ultra-wide — only
      // become readable once permission has been granted.
      setPermission(await permissionState());
      const cameras = await listCameras();
      setCameraLabels(cameras.map((device) => device.label).filter(Boolean));
      setUltraWideId(findUltraWide(cameras, camera.facing)?.deviceId ?? null);
    } catch (cause) {
      cameraRef.current = null;
      setStream(null);
      setError(toCameraError(cause));
      setStatus("error");
    }
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current) return startingRef.current;
    if (cameraRef.current) return;
    const pending = openInternal(facing).finally(() => {
      startingRef.current = null;
    });
    startingRef.current = pending;
    return pending;
  }, [facing, openInternal]);

  const stop = useCallback(() => {
    closeCamera(cameraRef.current);
    cameraRef.current = null;
    // Clearing the stream unbinds the element through the effect's cleanup, so
    // there is no second place that has to remember to null out `srcObject`.
    setStream(null);
    setStatus("idle");
  }, []);

  const setLens = useCallback(
    async (next: Lens) => {
      if (next === lens) return;

      // Route two: where the wider view lives on the main track's zoom range
      // rather than on its own device, a constraint is all that is needed and
      // reopening the stream would be both slower and wrong.
      const track = cameraRef.current?.track;
      const wideZoom = capabilities ? ultraWideZoom(capabilities) : null;
      if (!ultraWideId && wideZoom !== null && track) {
        const target = next === "ultra" ? wideZoom : 1;
        if (await setTrackZoom(track, target)) {
          setZoomState(target);
          setLensState(next);
        }
        return;
      }

      // Route one: the ultra-wide is a separate camera, so switching lens
      // means reopening the stream on that device.
      if (next === "ultra" && !ultraWideId) return;
      setLensState(next);
      if (startingRef.current) await startingRef.current;
      const pending = openInternal(
        facing,
        next === "ultra" ? (ultraWideId ?? undefined) : undefined,
      ).finally(() => {
        startingRef.current = null;
      });
      startingRef.current = pending;
      return pending;
    },
    [capabilities, facing, lens, openInternal, ultraWideId],
  );

  const flip = useCallback(async () => {
    const next: Facing = facing === "user" ? "environment" : "user";
    setFacing(next);
    // Lenses do not carry across sides: the other camera may not have one.
    setLensState("wide");
    if (startingRef.current) await startingRef.current;
    const pending = openInternal(next).finally(() => {
      startingRef.current = null;
    });
    startingRef.current = pending;
    return pending;
  }, [facing, openInternal]);

  const toggleTorch = useCallback(async () => {
    const track = cameraRef.current?.track;
    if (!track) return;
    const next = !torch;
    // Only reflect the change if the device actually accepted it.
    if (await setTrackTorch(track, next)) setTorchState(next);
  }, [torch]);

  const setZoom = useCallback(async (value: number) => {
    const track = cameraRef.current?.track;
    if (!track) return;
    if (await setTrackZoom(track, value)) setZoomState(value);
  }, []);

  const setExposure = useCallback(async (value: number) => {
    const track = cameraRef.current?.track;
    if (!track) return;
    if (await setTrackExposure(track, value)) setExposureState(value);
  }, []);

  const focusAt = useCallback(async (x: number, y: number) => {
    const track = cameraRef.current?.track;
    if (!track) return false;
    return focusTrackAt(track, x, y);
  }, []);

  const autoStart = options.autoStart ?? false;
  useEffect(() => {
    if (!autoStart) return;
    // Deferred by a tick so opening does not set state synchronously inside the
    // effect that scheduled it.
    const handle = window.setTimeout(() => {
      if (!supported) {
        // Otherwise a browser that cannot open a camera would sit on the
        // "opening…" spinner forever, which reads as a hang rather than as the
        // dead end it is.
        setError(
          new CameraError(
            "unsupported",
            "This browser can't open a camera.",
            "Try Safari on iOS, or Chrome on Android and desktop.",
          ),
        );
        setStatus("error");
        return;
      }
      void start();
    }, 0);
    return () => window.clearTimeout(handle);
    // `start` is deliberately excluded: it changes identity when `facing` does,
    // and re-running this on a camera flip would reopen the stream twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, supported]);

  // Release on unmount. Without this, navigating away from /camera leaves the
  // recording indicator on and the sensor powered.
  useEffect(() => {
    return () => {
      closeCamera(cameraRef.current);
      cameraRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      if (document.hidden) {
        if (cameraRef.current) {
          wasRunningRef.current = true;
          closeCamera(cameraRef.current);
          cameraRef.current = null;
          setStream(null);
          setStatus("idle");
        }
      } else if (options.resumeOnVisible !== false && wasRunningRef.current) {
        void start();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [options.resumeOnVisible, start]);

  return {
    videoRef,
    attachVideo,
    stream,
    frameAspect,
    status,
    error,
    facing,
    capabilities: capabilities ?? (status === "ready" ? EMPTY_CAPABILITIES : null),
    torch,
    zoom,
    exposure,
    supported,
    permission,
    start,
    stop,
    flip,
    toggleTorch,
    setZoom,
    setExposure,
    focusAt,
    hasUltraWide:
      ultraWideId !== null || (capabilities ? ultraWideZoom(capabilities) !== null : false),
    lens,
    setLens,
    cameraLabels,
  };
}
