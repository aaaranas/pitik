"use client";

import {
  CalendarClock,
  ChevronLeft,
  Grid3x3,
  ImageDown,
  RefreshCcw,
  SlidersHorizontal,
  Timer,
  X,
  Zap,
  ZapOff,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DigicamShell } from "./digicam-shell";
import { FilteredPreview } from "./filtered-preview";
import { FocusReticle, type FocusPoint } from "./focus-reticle";
import { GridOverlay, LevelIndicator } from "./grid-overlay";
import { PermissionGate } from "./permission-gate";
import { ProfileDial } from "./profile-dial";
import { ShutterButton, ShutterFlash } from "./shutter-button";
import { useSession } from "@/components/providers/session-provider";
import { useToast } from "@/components/providers/toast-provider";
import { useCamera } from "@/hooks/use-camera";
import { useObjectUrl } from "@/hooks/use-object-url";
import { useSettings } from "@/hooks/use-store";
import { useDeviceRoll } from "@/hooks/use-tilt";
import { captureFrame, importFiles } from "@/lib/camera/capture";
import { waitForFrame } from "@/lib/camera/service";
import type { Capture, Roll } from "@/lib/db/types";
import { playShutter, primeAudio, vibrate } from "@/lib/feedback";
import { composeAdjustments, getFilter, listFiltersForProfile } from "@/lib/filters/registry";
import { cn } from "@/lib/utils";

/**
 * Camera Mode.
 *
 * The whole screen is one instrument: a compact camera body, edge to edge, with
 * the shutter moulded into it rather than sitting underneath as a web button.
 *
 * Three decisions shape this screen:
 *
 *  - **The dial is the only look control.** Each entry is a different camera,
 *    and a camera is not a filter you layer on top of another one — so there is
 *    no separate filter tray to disagree with it.
 *  - **No aspect ratios.** The camera shoots the sensor's own framing, and the
 *    viewfinder is shaped to match, so what is on screen is the photograph.
 *  - **Rapid shooting.** Tapping the shutter snapshots the frame to an
 *    ImageBitmap immediately and hands grading and encoding off asynchronously,
 *    so the next tap never waits on the last photo's JPEG.
 */

const TIMER_OPTIONS = [0, 3, 10] as const;

/** The model the camera opens on, and the neutral body underneath it. */
const DEFAULT_MODEL_ID = "2003";
const NEUTRAL_PROFILE_ID = "everyday";

/**
 * How long the screen stays white before the shutter fires.
 *
 * The sensor needs a moment to meter for the new light. Firing immediately
 * gives you the dark exposure with a white flash that arrived too late to
 * help.
 */
const SCREEN_FLASH_SETTLE_MS = 260;

export function CameraScreen({
  roll,
  captureCount,
  lastCapture,
}: {
  roll: Roll | null;
  captureCount: number;
  lastCapture: Capture | null;
}) {
  const camera = useCamera({ initialFacing: "user", autoStart: true });
  // Destructured so the memoised callbacks below depend on stable identities
  // rather than on the controller object, which changes every render.
  const { videoRef, attachVideo, focusAt: focusCameraAt, frameAspect } = camera;
  const { settings, update } = useSettings();
  const { destinationFor, setActiveRoll } = useSession();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [timer, setTimer] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null);
  const [busy, setBusy] = useState(false);
  const [levelOn, setLevelOn] = useState(false);
  /** True while the screen is lighting the subject, just before a capture. */
  const [flashing, setFlashing] = useState(false);

  /** The bodies on the dial: one entry per camera model. */
  const models = useMemo(() => listFiltersForProfile("digicam"), []);
  /** Falls back to a real model if a stored id no longer names one. */
  const activeModelId = models.some((model) => model.id === modelId)
    ? modelId
    : DEFAULT_MODEL_ID;

  const deviceRoll = useDeviceRoll(levelOn);
  const rollId = roll?.id ?? null;

  // Hydrate from saved preferences exactly once — after that the screen owns
  // its own state so changing a setting mid-shoot isn't clobbered.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!settings || hydratedRef.current) return;
    hydratedRef.current = true;
    setModelId(settings.defaultFilterId);
  }, [settings]);

  const adjustments = useMemo(
    // No profile layer: the model *is* the look, and stacking a body grade on
    // top would double the sharpening and contrast the models already carry.
    () => composeAdjustments({ profileId: NEUTRAL_PROFILE_ID, filterId: activeModelId }),
    [activeModelId],
  );

  // Read out of the settings record once. Optional chaining inside a callback's
  // dependency list defeats memoisation, and these are read on every capture.
  const soundOn = settings?.shutterSound !== false;
  const hapticsOn = settings?.haptics !== false;
  const gridOn = settings?.gridOverlay ?? false;
  const livePreview = settings?.livePreview !== false;
  const dateStamp = settings?.dateStamp ?? false;
  const screenFlash = settings?.screenFlash ?? false;

  const mirrored = camera.facing === "user" && (settings?.mirrorSelfie ?? true);

  /**
   * Which kind of flash this camera can actually give you.
   *
   * The rear camera has a real lamp where the hardware exposes one; the front
   * camera only has the display. One control, doing whichever of the two is
   * genuinely possible.
   */
  const hasTorch = camera.capabilities?.torch ?? false;
  const usingScreenFlash = !hasTorch && camera.facing === "user" && screenFlash;
  const flashOn = hasTorch ? camera.torch : screenFlash;
  const lastThumbUrl = useObjectUrl(lastCapture?.thumb ?? null);

  /** True only when the user deliberately started a named roll. */
  const shootingIntoRoll = Boolean(roll && roll.kind !== "library");
  const shotsLeft =
    roll?.mode === "disposable" && roll.shotLimit ? roll.shotLimit - captureCount : null;
  const rollFull = shotsLeft !== null && shotsLeft <= 0;

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

      // Front cameras have no lamp. Blanking the screen white lights the
      // subject, but only if the sensor is given time to meter for it.
      if (usingScreenFlash) {
        setFlashing(true);
        await new Promise((resolve) => setTimeout(resolve, SCREEN_FLASH_SETTLE_MS));
      }

      // A press in the moment before the first frame decodes must still produce
      // a photo, so wait for one rather than quietly doing nothing.
      if (!(await waitForFrame(video))) {
        throw new Error("The camera didn't send a frame in time.");
      }
      // Snapshot now, grade later — this is what unblocks rapid shooting.
      bitmap = await createImageBitmap(video);
      // Only *then* resolve where it goes: the named roll if one is active,
      // otherwise the camera library.
      const targetRollId = await destinationFor("camera");
      await captureFrame({
        source: bitmap,
        rollId: targetRollId,
        filterId: activeModelId,
        profileId: NEUTRAL_PROFILE_ID,
        // The sensor's own framing. No crop, because there is no ratio to
        // choose — the camera shoots what it sees.
        aspect: "original",
        mirrored,
        timestamp: dateStamp,
      });
    } catch (error) {
      toast("That frame didn't save.", {
        detail: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
      if (hapticsOn) vibrate("error");
    } finally {
      bitmap?.close();
      setFlashing(false);
      setBusy(false);
    }
  }, [
    activeModelId,
    dateStamp,
    destinationFor,
    hapticsOn,
    mirrored,
    soundOn,
    toast,
    usingScreenFlash,
    videoRef,
  ]);

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

  // Self-timer. Each tick schedules the next and fires the shutter on the last,
  // so state transitions happen in the timer callback rather than the effect.
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
      if (!files?.length) return;
      setBusy(true);
      try {
        const { captures, failures } = await importFiles({
          files,
          rollId: await destinationFor("camera"),
          filterId: activeModelId,
          profileId: NEUTRAL_PROFILE_ID,
          aspect: "original",
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
    [activeModelId, destinationFor, toast],
  );

  const cycleTimer = () => {
    setTimer(TIMER_OPTIONS[(TIMER_OPTIONS.indexOf(timer as 0) + 1) % TIMER_OPTIONS.length]);
  };

  const live = camera.status === "ready";

  const header = (
    <>
      <Link
        href={shootingIntoRoll && rollId ? `/rolls/${rollId}` : "/rolls?tab=camera"}
        className="grid size-10 place-items-center rounded-full transition hover:bg-black/10"
        aria-label="Leave the camera"
      >
        <ChevronLeft className="size-5" />
      </Link>

      <div className="min-w-0 flex-1 text-center">
        <p className="flex items-center justify-center gap-1.5 truncate text-sm font-medium">
          {shootingIntoRoll ? (
            <>
              <span className="truncate">
                {roll?.emoji ? `${roll.emoji} ` : ""}
                {roll?.title}
              </span>
              {/* A roll you started should be one you can step out of, or every
                  later photo silently joins a session that ended. */}
              <button
                type="button"
                onClick={() => setActiveRoll(null)}
                aria-label="Stop shooting into this roll"
                className="grid size-5 shrink-0 place-items-center rounded-full opacity-60 transition hover:bg-black/10 hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </>
          ) : (
            <span className="truncate">Camera</span>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          if (hasTorch) void camera.toggleTorch();
          else void update({ screenFlash: !screenFlash });
        }}
        // Only truly unavailable on a rear camera with no lamp: the front one
        // can always light you with the screen.
        disabled={!hasTorch && camera.facing !== "user"}
        aria-pressed={flashOn}
        aria-label={
          hasTorch
            ? flashOn
              ? "Turn off the light"
              : "Turn on the light"
            : flashOn
              ? "Turn off the screen flash"
              : "Turn on the screen flash"
        }
        className={cn(
          "grid size-10 place-items-center rounded-full transition disabled:opacity-25",
          flashOn ? "text-amber-warm" : "hover:bg-black/10",
        )}
      >
        {flashOn ? <Zap className="size-5" /> : <ZapOff className="size-5" />}
      </button>
    </>
  );

  const tools = (
    <>
      {/* Labelled, not just a glyph: "does this add the date?" is not a question
          an icon on its own can answer. */}
      <ToolButton
        label={dateStamp ? "Date stamp on" : "Date stamp off"}
        onClick={() => void update({ dateStamp: !dateStamp })}
        active={dateStamp}
      >
        <CalendarClock className="size-4" aria-hidden />
        <span className="text-[0.625rem] uppercase tracking-[0.12em]">Date</span>
      </ToolButton>

      <ToolButton
        label={timer === 0 ? "Self-timer off" : `Self-timer: ${timer} seconds`}
        onClick={cycleTimer}
        active={timer > 0}
      >
        <Timer className="size-4" aria-hidden />
        {timer > 0 ? <span className="text-[0.625rem] tabular-nums">{timer}s</span> : null}
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
    </>
  );

  const deck = (
    <>
      {lastCapture && lastThumbUrl ? (
        <Link
          href={shootingIntoRoll && rollId ? `/rolls/${rollId}` : "/rolls?tab=camera"}
          className="size-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/25 transition hover:ring-black/50"
          aria-label={shootingIntoRoll ? "Open this roll" : "Open your camera photos"}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lastThumbUrl} alt="" className="size-full object-cover" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="grid size-12 shrink-0 place-items-center rounded-lg border border-dashed border-black/30 opacity-70 transition hover:opacity-100"
          aria-label="Import photos from your gallery"
        >
          <ImageDown className="size-5" />
        </button>
      )}

      <div className="flex flex-col items-center gap-2">
        {/* Rendered only where an ultra-wide module actually exists — most
            phones and every laptop have none. */}
        {camera.hasUltraWide ? (
          <button
            type="button"
            onClick={() => void camera.setLens(camera.lens === "ultra" ? "wide" : "ultra")}
            aria-pressed={camera.lens === "ultra"}
            aria-label={
              camera.lens === "ultra"
                ? "Switch to the main lens"
                : "Switch to the ultra-wide lens"
            }
            className={cn(
              "h-7 rounded-full px-3 font-mono text-[0.6875rem] tabular-nums transition",
              camera.lens === "ultra"
                ? "bg-amber-warm text-ink-950"
                : "bg-black/30 text-white/80 hover:bg-black/40",
            )}
          >
            {camera.lens === "ultra" ? "0.5x" : "1x"}
          </button>
        ) : null}

        <ShutterButton
          onCapture={onShutter}
          countdown={countdown}
          busy={busy}
          disabled={rollFull}
        />
      </div>

      <button
        type="button"
        onClick={() => void camera.flip()}
        disabled={!camera.capabilities?.multipleCameras}
        className="grid size-12 shrink-0 place-items-center rounded-full transition hover:bg-black/10 disabled:opacity-25"
        aria-label="Switch camera"
      >
        <RefreshCcw className="size-5" />
      </button>
    </>
  );

  if (!live) {
    return (
      <div className="flex h-full flex-col bg-ink-950 text-ink-100">
        {/* The header stays before the camera starts: which roll you are about
            to shoot into is exactly the thing you want to check first. */}
        <div
          className="flex shrink-0 items-center gap-1 px-3"
          style={{ paddingTop: "calc(var(--safe-top) + 0.5rem)" }}
        >
          {header}
        </div>
        <div className="grid min-h-0 flex-1 place-items-center">
          <PermissionGate
            // Never the primer: the camera opens by itself, so the only states
            // worth showing are "opening" and a genuine failure.
            status={camera.status === "error" ? "error" : "starting"}
            error={camera.error}
            onStart={() => void camera.start()}
            onImport={() => fileInputRef.current?.click()}
          />
        </div>
        <FileInput inputRef={fileInputRef} onPick={onPickFiles} />
      </div>
    );
  }

  return (
    <>
      {/* Warm white rather than pure white: it flatters skin, where a flat
          #ffffff makes everyone look like a photocopy. */}
      {flashing ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[100]"
          style={{ background: "#fff6ea" }}
        />
      ) : null}

      <DigicamShell
      model={getFilter(activeModelId).name}
      modelId={activeModelId}
      aspectRatio={frameAspect}
      shotCount={captureCount}
      shotsLeft={shotsLeft}
      dateStamp={dateStamp}
      busy={busy}
      header={header}
      dial={
        <ProfileDial
          items={models}
          selectedId={activeModelId}
          label="Camera model"
          onSelect={(id) => {
            setModelId(id);
            void update({ defaultFilterId: id });
          }}
        />
      }
      tools={tools}
      deck={deck}
    >
      <div className="size-full" onPointerDown={onViewfinderTap} role="presentation">
        <FilteredPreview
          videoRef={attachVideo}
          adjustments={adjustments}
          mirrored={mirrored}
          aspectRatio={frameAspect}
          livePreview={livePreview}
        >
          <GridOverlay visible={gridOn} />
          <LevelIndicator roll={deviceRoll} />
          <FocusReticle point={focusPoint} />
          <ShutterFlash flashKey={flashKey} />
        </FilteredPreview>
        <FileInput inputRef={fileInputRef} onPick={onPickFiles} />
      </div>
      </DigicamShell>
    </>
  );
}

function FileInput({
  inputRef,
  onPick,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (files: FileList | null) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      className="sr-only"
      onChange={(event) => {
        onPick(event.target.files);
        // Reset so picking the same file twice still fires a change event.
        event.target.value = "";
      }}
    />
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
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-full px-3 text-xs transition",
        active
          ? "bg-black/35 text-white"
          : "bg-black/15 text-white/70 hover:bg-black/25 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
