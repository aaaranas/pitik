"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCapability } from "./use-now";
import {
  type ActiveCamera,
  CameraError,
  type CameraCapabilities,
  closeCamera,
  type Facing,
  focusAt as focusTrackAt,
  isCameraSupported,
  openCamera,
  permissionState,
  setExposure as setTrackExposure,
  setTorch as setTrackTorch,
  setZoom as setTrackZoom,
  toCameraError,
} from "@/lib/camera/service";

export type CameraStatus = "idle" | "starting" | "ready" | "error";

export interface CameraController {
  videoRef: React.RefObject<HTMLVideoElement | null>;
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
}

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
 *  - Nothing is ever started without an explicit call, so the permission prompt
 *    always follows a deliberate user action.
 */
export function useCamera(options: {
  initialFacing?: Facing;
  /** Reopen automatically when the tab becomes visible again. */
  resumeOnVisible?: boolean;
} = {}): CameraController {
  const videoRef = useRef<HTMLVideoElement | null>(null);
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
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    // Set declaratively too, but iOS needs both to avoid hijacking the preview
    // into a fullscreen native player.
    video.playsInline = true;
    video.muted = true;
    void video.play().catch(() => {
      // Autoplay can be refused before the first gesture; the stream is live
      // either way and the next tap starts it.
    });

    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream, status]);

  const openInternal = useCallback(async (nextFacing: Facing) => {
    setStatus("starting");
    setError(null);
    setStream(null);
    try {
      closeCamera(cameraRef.current);
      cameraRef.current = null;

      const camera = await openCamera({ facing: nextFacing });
      cameraRef.current = camera;
      setFacing(camera.facing);
      setCapabilities(camera.capabilities);
      setTorchState(false);
      setZoomState(camera.capabilities.zoom?.min ?? 1);
      setExposureState(0);
      wasRunningRef.current = true;
      // Both in the same commit: the video element mounts and the binding
      // effect runs immediately after, with the ref already populated.
      setStream(camera.stream);
      setStatus("ready");
      // Labels — and therefore an accurate camera count — only become
      // readable once permission has been granted.
      setPermission(await permissionState());
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

  const flip = useCallback(async () => {
    const next: Facing = facing === "user" ? "environment" : "user";
    setFacing(next);
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
  };
}
