"use client";

import {
  ChevronLeft,
  Grid3x3,
  ImageDown,
  RefreshCcw,
  Ratio,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Zap,
  ZapOff,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilteredPreview } from "./filtered-preview";
import { FilterTray, useReferenceFrame } from "./filter-tray";
import { FocusReticle, type FocusPoint } from "./focus-reticle";
import { GridOverlay, LevelIndicator } from "./grid-overlay";
import { DigicamShell } from "./digicam-shell";
import { PermissionGate } from "./permission-gate";
import { ProfileDial } from "./profile-dial";
import { ShutterButton, ShutterFlash } from "./shutter-button";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useSession } from "@/components/providers/session-provider";
import { useToast } from "@/components/providers/toast-provider";
import { useCamera } from "@/hooks/use-camera";
import { useObjectUrl } from "@/hooks/use-object-url";
import { useSettings } from "@/hooks/use-store";
import { useDeviceRoll } from "@/hooks/use-tilt";
import { captureFrame, importFiles } from "@/lib/camera/capture";
import { waitForFrame } from "@/lib/camera/service";
import { ASPECT_IDS, ASPECT_RATIOS, type AspectId, type Capture, type Roll } from "@/lib/db/types";
import { playShutter, primeAudio, vibrate } from "@/lib/feedback";
import { composeAdjustments, listFilters, listProfiles } from "@/lib/filters/registry";
import { cn } from "@/lib/utils";

/**
 * Camera Mode.
 *
 * The design brief for this screen: it should be possible to open the app and
 * take a photo without reading anything. Everything except the shutter, the
 * flip, and the roll you're shooting into is one layer down.
 *
 * Rapid shooting is the constraint that shapes the code. Tapping the shutter
 * snapshots the frame to an ImageBitmap immediately and hands the grading and
 * encoding off asynchronously, so the next tap is never waiting on the last
 * photo's JPEG. There is deliberately no confirmation step after a capture.
 */

const TIMER_OPTIONS = [0, 3, 10] as const;

export function CameraScreen({
  roll,
  captureCount,
  lastCapture,
}: {
  roll: Roll | null;
  captureCount: number;
  lastCapture: Capture | null;
}) {
  const camera = useCamera({ initialFacing: "user" });
  // Destructured so the memoised callbacks below depend on stable identities
  // rather than on the controller object, which changes every render.
  const { videoRef, attachVideo, focusAt: focusCameraAt } = camera;
  const { settings, update } = useSettings();
  const { ensureRoll } = useSession();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [filterId, setFilterId] = useState("natural");
  const [profileId, setProfileId] = useState("everyday");
  const [aspect, setAspect] = useState<AspectId>("4:3");
  const [timer, setTimer] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [trayOpen, setTrayOpen] = useState(false);
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null);
  const [busy, setBusy] = useState(false);
  const [levelOn, setLevelOn] = useState(false);

  const filters = useMemo(() => listFilters(), []);
  const profiles = useMemo(() => listProfiles(), []);
  const deviceRoll = useDeviceRoll(levelOn);
  const rollId = roll?.id ?? null;

  // Hydrate the controls from saved preferences exactly once — after that the
  // screen owns its own state so changing a setting mid-shoot isn't clobbered.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!settings || hydratedRef.current) return;
    hydratedRef.current = true;
    setFilterId(settings.defaultFilterId);
    setProfileId(settings.defaultProfileId);
    setAspect(settings.defaultAspect);
  }, [settings]);

  const adjustments = useMemo(
    () => composeAdjustments({ profileId, filterId }),
    [profileId, filterId],
  );

  // Read out of the settings record once. Optional chaining inside a callback's
  // dependency list defeats memoisation, and these are read on every capture.
  const soundOn = settings?.shutterSound !== false;
  const hapticsOn = settings?.haptics !== false;
  const gridOn = settings?.gridOverlay ?? false;
  const livePreview = settings?.livePreview !== false;

  const mirrored = camera.facing === "user" && (settings?.mirrorSelfie ?? true);
  const referenceFrame = useReferenceFrame(videoRef, trayOpen && camera.status === "ready");
  const lastThumbUrl = useObjectUrl(lastCapture?.thumb ?? null);

  const shotsLeft =
    roll?.mode === "disposable" && roll.shotLimit ? roll.shotLimit - captureCount : null;
  const rollFull = shotsLeft !== null && shotsLeft <= 0;

  /** Which profiles get dressed as a physical camera body. */
  const bodyStyle = profileId === "digicam" ? "digicam" : "plain";

  // -------------------------------------------------------------- capture

  const doCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    // Feedback first, work second: the click must land on the press, not after
    // the encode. This is most of what makes the shutter feel physical.
    setFlashKey((key) => key + 1);
    if (soundOn) playShutter();
    if (hapticsOn) vibrate("shutter");

    let bitmap: ImageBitmap | null = null;
    try {
      setBusy(true);
      // A press in the moment before the first frame decodes must still produce
      // a photo, so wait for one rather than quietly doing nothing.
      if (!(await waitForFrame(video))) {
        throw new Error("The camera didn't send a frame in time.");
      }
      // Snapshot now, grade later — this is what unblocks rapid shooting.
      bitmap = await createImageBitmap(video);
      // Only *then* resolve where it goes. The roll record loads asynchronously
      // from IndexedDB, and someone who opens the app and immediately taps must
      // not lose that first frame to a race they cannot see.
      const targetRollId = rollId ?? (await ensureRoll()).id;
      await captureFrame({
        source: bitmap,
        rollId: targetRollId,
        filterId,
        profileId,
        aspect,
        mirrored,
      });
    } catch (error) {
      toast("That frame didn't save.", {
        detail: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
      if (hapticsOn) vibrate("error");
    } finally {
      bitmap?.close();
      setBusy(false);
    }
  }, [aspect, ensureRoll, videoRef, filterId, hapticsOn, mirrored, profileId, rollId, soundOn, toast]);

  const onShutter = useCallback(() => {
    primeAudio();
    if (rollFull) {
      toast("This roll is finished.", { detail: "Develop it to see your photos." });
      return;
    }
    if (timer === 0) {
      void doCapture();
      return;
    }
    setCountdown(timer);
  }, [doCapture, rollFull, timer, toast]);

  // Self-timer. Each tick schedules the next one and fires the shutter on the
  // last, so the state transitions all happen in the timer callback rather than
  // synchronously in the effect body.
  useEffect(() => {
    if (countdown === null) return;
    if (hapticsOn) vibrate("tick");

    const handle = window.setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null);
        void doCapture();
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);
    return () => window.clearTimeout(handle);
  }, [countdown, doCapture, hapticsOn]);

  // ------------------------------------------------------------- controls

  const onViewfinderTap = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      setFocusPoint({ x, y, id: Date.now() });
      // Undo the preview mirror before handing coordinates to the sensor —
      // otherwise tapping the left of a selfie focuses on the right.
      void focusCameraAt(mirrored ? 1 - x : x, y);
    },
    [focusCameraAt, mirrored],
  );

  const onPickFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || !rollId) return;
      setBusy(true);
      try {
        const { captures, failures } = await importFiles({
          files,
          rollId,
          filterId,
          profileId,
          aspect,
        });
        if (captures.length) {
          toast(`Added ${captures.length} photo${captures.length === 1 ? "" : "s"}.`, {
            tone: "success",
          });
        }
        if (failures.length) {
          toast(`${failures.length} file${failures.length === 1 ? "" : "s"} couldn't be read.`, {
            detail: failures[0].reason,
            tone: "error",
          });
        }
      } finally {
        setBusy(false);
      }
    },
    [aspect, filterId, profileId, rollId, toast],
  );

  const cycleAspect = () => {
    const next = ASPECT_IDS[(ASPECT_IDS.indexOf(aspect) + 1) % ASPECT_IDS.length];
    setAspect(next);
    void update({ defaultAspect: next });
  };

  const cycleTimer = () => {
    setTimer(TIMER_OPTIONS[(TIMER_OPTIONS.indexOf(timer as 0) + 1) % TIMER_OPTIONS.length]);
  };

  const live = camera.status === "ready";

  return (
    <div className="flex h-full flex-col bg-ink-950">
      {/* ------------------------------------------------------ top bar */}
      <header
        className="flex shrink-0 items-center gap-1 px-2 pb-2"
        style={{ paddingTop: "calc(var(--safe-top) + 0.5rem)" }}
      >
        <Link
          href={rollId ? `/rolls/${rollId}` : "/"}
          className="grid size-10 place-items-center rounded-full text-ink-200 transition hover:bg-ink-800"
          aria-label="Leave the camera"
        >
          <ChevronLeft className="size-5" />
        </Link>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-medium text-ink-100">
            {roll?.emoji ? `${roll.emoji} ` : ""}
            {roll?.title ?? "New roll"}
          </p>
          <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-ink-400">
            {shotsLeft !== null
              ? `${Math.max(0, shotsLeft)} left`
              : `${captureCount} shot${captureCount === 1 ? "" : "s"}`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => camera.toggleTorch()}
          disabled={!camera.capabilities?.torch}
          aria-pressed={camera.torch}
          aria-label={camera.torch ? "Turn off the light" : "Turn on the light"}
          className={cn(
            "grid size-10 place-items-center rounded-full transition disabled:opacity-25",
            camera.torch ? "text-amber-warm" : "text-ink-200 hover:bg-ink-800",
          )}
        >
          {camera.torch ? <Zap className="size-5" /> : <ZapOff className="size-5" />}
        </button>
      </header>

      {/* --------------------------------------------------- viewfinder */}
      <div className="relative min-h-0 flex-1 overflow-hidden px-3 py-1">
        {live ? (
          <div
            className="size-full"
            onPointerDown={onViewfinderTap}
            role="presentation"
          >
            {/* Picking Digicam changes the instrument, not just the grade — the
                viewfinder is dressed as the back of a compact camera. */}
            {bodyStyle === "digicam" ? (
              <DigicamShell
                aspect={aspect}
                aspectRatio={ASPECT_RATIOS[aspect]}
                shotCount={captureCount}
                shotsLeft={shotsLeft}
                busy={busy}
              >
                <FilteredPreview
                  videoRef={attachVideo}
                  adjustments={adjustments}
                  mirrored={mirrored}
                  aspectRatio={ASPECT_RATIOS[aspect]}
                  livePreview={livePreview}
                >
                  <GridOverlay visible={gridOn} />
                  <LevelIndicator roll={deviceRoll} />
                  <FocusReticle point={focusPoint} />
                  <ShutterFlash flashKey={flashKey} />
                </FilteredPreview>
              </DigicamShell>
            ) : (
              <FilteredPreview
                videoRef={attachVideo}
                adjustments={adjustments}
                mirrored={mirrored}
                aspectRatio={ASPECT_RATIOS[aspect]}
                livePreview={livePreview}
              >
                <GridOverlay visible={gridOn} />
                <LevelIndicator roll={deviceRoll} />
                <FocusReticle point={focusPoint} />
                <ShutterFlash flashKey={flashKey} />
              </FilteredPreview>
            )}
          </div>
        ) : (
          <PermissionGate
            status={camera.status === "ready" ? "idle" : camera.status}
            error={camera.error}
            onStart={() => void camera.start()}
            onImport={() => fileInputRef.current?.click()}
          />
        )}
      </div>

      {/* ------------------------------------------------------ controls */}
      {live ? (
        <div className="shrink-0">
          {camera.capabilities?.zoom ? (
            <div className="mx-auto mb-1 flex max-w-xs items-center gap-3 px-6">
              <span className="text-[0.625rem] uppercase tracking-widest text-ink-400">
                Zoom
              </span>
              <Slider
                aria-label="Zoom"
                min={camera.capabilities.zoom.min}
                max={camera.capabilities.zoom.max}
                step={camera.capabilities.zoom.step}
                value={[camera.zoom]}
                onValueChange={([value]) => void camera.setZoom(value)}
              />
            </div>
          ) : null}

          <ProfileDial
            profiles={profiles}
            selectedId={profileId}
            onSelect={(id) => {
              setProfileId(id);
              void update({ defaultProfileId: id });
            }}
            className="mb-2"
          />

          {trayOpen ? (
            <FilterTray
              filters={filters}
              selectedId={filterId}
              referenceFrame={referenceFrame}
              onSelect={(id) => {
                setFilterId(id);
                void update({ defaultFilterId: id });
              }}
            />
          ) : null}

          {/* Secondary row: things you set once and forget. */}
          <div className="flex items-center justify-center gap-1 px-4 py-1.5">
            <ToolButton
              label={`Aspect ratio: ${aspect}`}
              onClick={cycleAspect}
              active={aspect !== "original"}
            >
              <Ratio className="size-4" aria-hidden />
              <span className="text-[0.6875rem] tabular-nums">
                {aspect === "original" ? "FULL" : aspect}
              </span>
            </ToolButton>

            <ToolButton
              label={timer === 0 ? "Self-timer off" : `Self-timer: ${timer} seconds`}
              onClick={cycleTimer}
              active={timer > 0}
            >
              <Timer className="size-4" aria-hidden />
              {timer > 0 ? <span className="text-[0.6875rem] tabular-nums">{timer}s</span> : null}
            </ToolButton>

            <ToolButton
              label="Composition grid"
              onClick={() => void update({ gridOverlay: !gridOn })}
              active={gridOn}
            >
              <Grid3x3 className="size-4" aria-hidden />
            </ToolButton>

            <ToolButton label="Level" onClick={() => setLevelOn((on) => !on)} active={levelOn}>
              <SlidersHorizontal className="size-4" aria-hidden />
            </ToolButton>

            <ToolButton label="Filters" onClick={() => setTrayOpen((open) => !open)} active={trayOpen}>
              <Sparkles className="size-4" aria-hidden />
            </ToolButton>
          </div>

          {/* Primary row. */}
          <div
            className="flex items-center justify-between px-8 pt-1"
            style={{ paddingBottom: "calc(var(--safe-bottom) + 1.25rem)" }}
          >
            {lastCapture && lastThumbUrl ? (
              <Link
                href={rollId ? `/rolls/${rollId}` : "/rolls"}
                className="size-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/20 transition hover:ring-white/50"
                aria-label="Open this roll"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lastThumbUrl} alt="" className="size-full object-cover" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="grid size-12 shrink-0 place-items-center rounded-lg border border-dashed border-ink-600 text-ink-400 transition hover:border-ink-500 hover:text-ink-200"
                aria-label="Import photos from your gallery"
              >
                <ImageDown className="size-5" />
              </button>
            )}

            <ShutterButton
              onCapture={onShutter}
              countdown={countdown}
              busy={busy}
              disabled={rollFull}
            />

            <button
              type="button"
              onClick={() => void camera.flip()}
              disabled={!camera.capabilities?.multipleCameras}
              className="grid size-12 shrink-0 place-items-center rounded-full text-ink-200 transition hover:bg-ink-800 disabled:opacity-25"
              aria-label="Switch camera"
            >
              <RefreshCcw className="size-5" />
            </button>
          </div>
        </div>
      ) : (
        <div style={{ height: "calc(var(--safe-bottom) + 1rem)" }} />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => {
          void onPickFiles(event.target.files);
          // Reset so picking the same file twice still fires a change event.
          event.target.value = "";
        }}
      />
    </div>
  );
}

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn("gap-1.5 px-2.5", active && "text-safelight-400")}
    >
      {children}
    </Button>
  );
}
