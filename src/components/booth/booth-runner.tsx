"use client";

import { ChevronLeft, RefreshCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StripEditor } from "./strip-editor";
import { FilteredPreview } from "@/components/camera/filtered-preview";
import { FilterTray, useReferenceFrame } from "@/components/camera/filter-tray";
import { PermissionGate } from "@/components/camera/permission-gate";
import { ShutterFlash } from "@/components/camera/shutter-button";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { useCamera } from "@/hooks/use-camera";
import { useSettings } from "@/hooks/use-store";
import { renderFrame } from "@/lib/camera/capture";
import {
  isMotionSupported,
  type MotionClip,
  type MotionRecording,
  startMotionRecording,
} from "@/lib/camera/motion";
import { waitForFrame } from "@/lib/camera/service";
import { templateAspect } from "@/lib/booth/templates";
import type { BoothTemplate } from "@/lib/booth/types";
import { playShutter, playTick, primeAudio, vibrate } from "@/lib/feedback";
import { composeAdjustments, listFilters } from "@/lib/filters/registry";
import { cn, formatCount } from "@/lib/utils";

/**
 * A booth session, start to strip.
 *
 * The sequence is the product here. Once you press start, the app takes over:
 * it counts you in, fires on its own schedule, and does not stop to ask whether
 * each shot was good. That loss of control is the whole appeal of a real
 * photobooth, and the reason the results are funnier than posed photos.
 */

type Phase = "setup" | "running" | "review";

interface BoothFrame {
  blob: Blob;
  bitmap: ImageBitmap;
}

const INTERVAL_OPTIONS = [3, 5, 8] as const;


export function BoothRunner({ template }: { template: BoothTemplate }) {
  const camera = useCamera({ initialFacing: "user" });
  const { settings } = useSettings();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>("setup");
  const [interval, setIntervalSeconds] = useState<number>(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [frames, setFrames] = useState<BoothFrame[]>([]);
  const [flashKey, setFlashKey] = useState(0);
  const [trayOpen, setTrayOpen] = useState(false);
  const [filterId, setFilterId] = useState("booth-classic");
  /** The finished clip of this sequence, once the shoot has ended. */
  const [motion, setMotion] = useState<MotionClip | null>(null);
  /** True while a recorder is actually running, so the indicator never lies. */
  const [recordingActive, setRecordingActive] = useState(false);
  /** True between tapping Start and the countdown beginning. */
  const [preparing, setPreparing] = useState(false);

  /**
   * The in-flight recorder.
   *
   * A ref rather than state: it is a live browser object with a lifetime, not a
   * value to render, and it must be reachable from cleanup paths that run
   * without a re-render.
   */
  const recordingRef = useRef<MotionRecording | null>(null);

  const profileId = settings?.defaultProfileId ?? "everyday";
  const soundOn = settings?.shutterSound !== false;
  const hapticsOn = settings?.haptics !== false;

  const filters = useMemo(() => listFilters(), []);
  const adjustments = useMemo(
    () => composeAdjustments({ profileId, filterId }),
    [filterId, profileId],
  );
  const aspect = useMemo(() => templateAspect(template), [template]);
  // Checked once: whether this browser can record at all decides whether the
  // shoot is advertised as filmed. No promise is made that can't be kept.
  const canRecord = useMemo(() => isMotionSupported(), []);
  const mirrored = camera.facing === "user" && (settings?.mirrorSelfie ?? true);
  const referenceFrame = useReferenceFrame(camera.videoRef, trayOpen && camera.status === "ready");

  /**
   * Every bitmap this session has produced.
   *
   * ImageBitmaps hold real GPU memory that the garbage collector will not
   * reclaim, so the session keeps its own list and closes it on unmount. Kept
   * separate from `frames` state and only ever written from event handlers.
   */
  const bitmapsRef = useRef<ImageBitmap[]>([]);
  useEffect(() => {
    const bitmaps = bitmapsRef.current;
    return () => {
      for (const bitmap of bitmaps) bitmap.close();
    };
  }, []);

  const releaseFrames = useCallback(() => {
    for (const bitmap of bitmapsRef.current) bitmap.close();
    bitmapsRef.current = [];
  }, []);

  /** Abandons any recording in flight. Safe to call when there isn't one. */
  const cancelRecording = useCallback(() => {
    recordingRef.current?.cancel();
    recordingRef.current = null;
    setRecordingActive(false);
  }, []);

  /** Guards async work that resolves after the screen has gone. */
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    // A recorder must never outlive its session — not on unmount, and not when
    // the user leaves the page mid-sequence.
    return () => {
      mountedRef.current = false;
      cancelRecording();
    };
  }, [cancelRecording]);

  /** Kept in a ref so the sequence timer can read the count synchronously. */
  const shotCountRef = useRef(0);
  const attemptsRef = useRef(0);

  const shootOne = useCallback(async () => {
    const video = camera.videoRef.current;
    if (!video) return;
    attemptsRef.current += 1;

    setFlashKey((key) => key + 1);
    if (soundOn) playShutter();
    if (hapticsOn) vibrate("shutter");

    let bitmap: ImageBitmap | null = null;
    try {
      // The booth fires on its own schedule, so the very first shot can land
      // before the preview has decoded a frame. Wait for one rather than
      // burning a slot on the strip.
      if (!(await waitForFrame(video))) {
        throw new Error("The camera didn't send a frame in time.");
      }
      bitmap = await createImageBitmap(video);
      const frame = await renderFrame({
        source: bitmap,
        filterId,
        profileId,
        aspectRatio: aspect,
        mirrored,
      });
      shotCountRef.current += 1;
      bitmapsRef.current.push(frame.bitmap);
      setFrames((current) => [...current, { blob: frame.blob, bitmap: frame.bitmap }]);
    } catch (error) {
      toast("That shot didn't come out.", {
        detail: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      bitmap?.close();
    }
  }, [aspect, camera.videoRef, filterId, hapticsOn, mirrored, profileId, soundOn, toast]);

  /**
   * The sequence timer.
   *
   * One countdown that fires a shot when it reaches zero and restarts itself
   * until the template is full, rather than a chain of nested timeouts — which
   * is what keeps cancellation (leaving the page mid-run) trivially correct.
   * Every transition happens inside the timer callback, never in the effect
   * body, so a running sequence causes no cascading renders.
   */
  useEffect(() => {
    if (phase !== "running" || countdown === null) return;
    if (countdown > 0) {
      if (soundOn) playTick();
      if (hapticsOn) vibrate("tick");
    }

    let cancelled = false;
    const handle = window.setTimeout(() => {
      if (countdown > 1) {
        setCountdown(countdown - 1);
        return;
      }
      void shootOne().then(async () => {
        if (cancelled) return;
        // Bail out rather than looping forever if the camera keeps handing back
        // unusable frames — the user gets whatever did come out.
        const exhausted = attemptsRef.current >= template.shots + 3;
        if (shotCountRef.current >= template.shots || exhausted) {
          // Finish the clip before switching screens, so the editor never has
          // to render a "preparing…" state for something that takes 20ms.
          const recording = recordingRef.current;
          recordingRef.current = null;
          const result = recording ? await recording.stop() : null;
          if (cancelled) return;
          setRecordingActive(false);
          setMotion(result?.ok ? result.clip : null);

          // The shoot was advertised as filmed, so a clip that didn't survive
          // has to say so. Silence here is indistinguishable from the feature
          // being broken.
          if (result && !result.ok) {
            toast(
              result.reason === "too-large"
                ? "That shoot was too long to keep as a clip."
                : "The clip didn't record. Your strip is fine.",
              { detail: "The photos are unaffected.", tone: "error" },
            );
          }

          setPhase("review");
          setCountdown(null);
        } else {
          // Straight back into the countdown, so there's a beat between shots
          // rather than a machine-gun burst nobody can react to.
          setCountdown(interval);
        }
      });
    }, 1000);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [countdown, hapticsOn, interval, phase, shootOne, soundOn, template.shots, toast]);

  /** Drops everything from the previous shoot. Shared by start and retake. */
  const clearSession = useCallback(() => {
    releaseFrames();
    cancelRecording();
    setMotion(null);
    setFrames([]);
    shotCountRef.current = 0;
    attemptsRef.current = 0;
  }, [cancelRecording, releaseFrames]);

  /**
   * Begins the shoot.
   *
   * Async because the recorder may need to ask for the microphone, and that
   * prompt has to resolve *before* the countdown starts — a permission dialog
   * appearing over "3… 2… 1…" would eat the first shot.
   */
  const start = useCallback(async () => {
    primeAudio();
    clearSession();
    setPreparing(true);

    // Rolls from the first countdown to the last shot, so the clip contains the
    // waiting and the reacting rather than just the poses. A recorder that
    // refuses to start returns null and the sequence carries on regardless.
    const recording = await startMotionRecording(camera.stream, {
      // The countdown plus roughly a second of capture per shot. Used to pick a
      // bitrate that keeps even a nine-shot sequence inside the storage budget.
      expectedDurationMs: template.shots * (interval + 1) * 1000,
    });

    // The user may have left while the prompt was open; a recorder must never
    // outlive the screen that started it.
    if (!mountedRef.current) {
      recording?.cancel();
      return;
    }

    recordingRef.current = recording;
    setRecordingActive(recording !== null);
    setPreparing(false);
    setPhase("running");
    setCountdown(interval);
  }, [camera.stream, clearSession, interval, template.shots]);

  const retake = useCallback(() => {
    clearSession();
    setPreparing(false);
    setPhase("setup");
    setCountdown(null);
  }, [clearSession]);

  if (phase === "review") {
    return (
      <StripEditor
        template={template}
        frames={frames.map((frame) => frame.bitmap)}
        motion={motion}
        onRetake={retake}
      />
    );
  }

  const live = camera.status === "ready";
  const shotsTaken = frames.length;

  return (
    <div className="flex h-full flex-col bg-ink-950">
      <header
        className="flex shrink-0 items-center gap-1 px-2 pb-2"
        style={{ paddingTop: "calc(var(--safe-top) + 0.5rem)" }}
      >
        <Link
          href="/booth"
          className="grid size-10 place-items-center rounded-full text-ink-200 transition hover:bg-ink-800"
          aria-label="Choose a different booth"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-medium text-ink-100">{template.name}</p>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-ink-400">
            {phase === "running"
              ? `Shot ${Math.min(shotsTaken + 1, template.shots)} of ${template.shots}`
              : formatCount(template.shots, "shot")}
          </p>
        </div>
        {/* Being filmed is something you should be able to see, not something
            you find out about afterwards. Shown only while a recorder is in
            flight, so it can never claim a recording that isn't happening. */}
        {recordingActive ? (
          <span className="flex size-10 items-center justify-center gap-1" role="status">
            <span
              aria-hidden
              className="size-2 animate-pulse rounded-full bg-safelight-500 shadow-[0_0_8px_rgba(234,79,52,0.9)]"
            />
            <span className="sr-only">Recording a clip of this shoot</span>
          </span>
        ) : (
          <span className="size-10" aria-hidden />
        )}
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden px-3 py-1">
        {live ? (
          <FilteredPreview
            videoRef={camera.attachVideo}
            adjustments={adjustments}
            mirrored={mirrored}
            aspectRatio={aspect}
            livePreview={settings?.livePreview !== false}
          >
            <ShutterFlash flashKey={flashKey} />
            {phase === "running" && countdown !== null && countdown > 0 ? (
              <div className="absolute inset-0 z-20 grid place-items-center">
                <span className="font-display text-[7rem] leading-none text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)]">
                  {countdown}
                </span>
              </div>
            ) : null}
          </FilteredPreview>
        ) : (
          <PermissionGate
            status={camera.status === "ready" ? "idle" : camera.status}
            error={camera.error}
            onStart={() => void camera.start()}
          />
        )}
      </div>

      {/* Frames captured so far, so the strip visibly fills up as you go. */}
      <div className="flex shrink-0 items-center justify-center gap-1.5 px-4 py-3">
        {Array.from({ length: template.shots }).map((_, index) => (
          <span
            key={index}
            aria-hidden
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              index < shotsTaken ? "w-6 bg-safelight-500" : "w-3 bg-ink-700",
            )}
          />
        ))}
        <span className="sr-only">
          {shotsTaken} of {template.shots} taken
        </span>
      </div>

      {live && phase === "setup" ? (
        <div className="shrink-0">
          {trayOpen ? (
            <FilterTray
              filters={filters}
              selectedId={filterId}
              referenceFrame={referenceFrame}
              onSelect={setFilterId}
            />
          ) : null}

          <div className="flex items-center justify-center gap-2 px-4 py-2">
            <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-400">
              Interval
            </span>
            {INTERVAL_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={interval === option}
                onClick={() => setIntervalSeconds(option)}
                className={cn(
                  "rounded-full px-3 py-1 font-mono text-xs transition",
                  interval === option
                    ? "bg-paper text-ink-900"
                    : "bg-ink-800 text-ink-300 hover:bg-ink-700",
                )}
              >
                {option}s
              </button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={trayOpen}
              onClick={() => setTrayOpen((open) => !open)}
              className={cn("ml-1", trayOpen && "text-safelight-400")}
            >
              <Sparkles className="size-4" aria-hidden />
              Look
            </Button>
          </div>

          {canRecord ? (
            <p className="px-6 pb-1 text-center text-[0.6875rem] text-ink-500">
              The whole shoot is filmed, with sound — you get a clip as well as the
              strip.
            </p>
          ) : null}

          <div
            className="flex items-center gap-3 px-6 pt-1"
            style={{ paddingBottom: "calc(var(--safe-bottom) + 1.25rem)" }}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void camera.flip()}
              disabled={!camera.capabilities?.multipleCameras}
              aria-label="Switch camera"
            >
              <RefreshCcw className="size-5" />
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={() => void start()}
              disabled={preparing}
            >
              {preparing ? "Getting ready…" : "Start the booth"}
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ height: "calc(var(--safe-bottom) + 1.5rem)" }} />
      )}
    </div>
  );
}
