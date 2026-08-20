"use client";

import { useEffect, useMemo, useState } from "react";
import { fitBox, useElementSize } from "@/hooks/use-element-size";
import { getCameraBody } from "@/lib/camera/bodies";
import { cn } from "@/lib/utils";

/**
 * The camera body — the whole screen.
 *
 * Camera Mode is not a viewfinder with controls beneath it; it is a compact
 * camera you are holding, edge to edge, and the shutter is part of the body
 * rather than a web button sitting under it. Everything the user touches lives
 * inside this moulding, passed in as slots.
 *
 * Two rules keep this from violating "no fake features":
 *
 *  - The grille is **scenery**: aria-hidden, no button semantics, no press
 *    states. It reads as plastic rather than as UI that has stopped working.
 *  - The readout shows **real values** — the frame count, the live clock, and
 *    whether the date stamp is actually armed. Nothing here is invented.
 */

/** `HH:MM`, ticking once a minute like a camera back. */
function useClock(): string {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Starts null and fills in on the client: rendering a time during SSR would
    // hydrate to a different minute and mismatch.
    const tick = () => setNow(new Date());
    const timer = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  if (!now) return "--:--";
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export interface DigicamShellProps {
  /** Name of the selected model, printed on the body like a real one. */
  model: string;
  /** Filter id of the model, which decides what the body is made of. */
  modelId: string;
  /** Sensor framing, so the screen is shaped like the photograph. */
  aspectRatio: number | null;
  /** Frames taken so far, shown as an exposure count. */
  shotCount: number;
  /** Remaining exposures on a disposable roll, if there is a limit. */
  shotsLeft?: number | null;
  /** Whether the date stamp is armed, shown on the readout. */
  dateStamp?: boolean;
  busy?: boolean;

  /** Back control, title and torch. */
  header: React.ReactNode;
  /** The live viewfinder. */
  children: React.ReactNode;
  /** Model dial. */
  dial: React.ReactNode;
  /** Small toggles above the deck. */
  tools: React.ReactNode;
  /** Gallery, shutter and flip. */
  deck: React.ReactNode;
}

export function DigicamShell({
  model,
  modelId,
  aspectRatio,
  shotCount,
  shotsLeft,
  dateStamp,
  busy,
  header,
  children,
  dial,
  tools,
  deck,
}: DigicamShellProps) {
  const clock = useClock();
  const [screenRef, screenSpace] = useElementSize<HTMLDivElement>();
  // Each model is a different piece of plastic, not a relabelled one.
  const shell = useMemo(() => getCameraBody(modelId), [modelId]);

  // The screen is shaped to the sensor, so what is behind the bezel is the
  // photograph rather than a differently-cropped preview of it.
  const screen = useMemo(() => fitBox(screenSpace, aspectRatio), [screenSpace, aspectRatio]);

  return (
    <div
      className={cn("relative flex h-full flex-col transition-opacity", busy && "opacity-95")}
      style={{
        background: `linear-gradient(160deg, ${shell.body[0]} 0%, ${shell.body[1]} 48%, ${shell.body[2]} 100%)`,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-30"
        style={{
          background: "linear-gradient(to bottom, rgba(255,255,255,0.4), rgba(255,255,255,0))",
        }}
      />

      <div
        className="relative z-[2] flex shrink-0 items-center gap-1 px-3"
        style={{ paddingTop: "calc(var(--safe-top) + 0.5rem)", color: shell.ink }}
      >
        {header}
      </div>

      <div className="relative z-[2] flex shrink-0 items-center justify-between px-5 pb-1 pt-1">
        <span
          className="font-display text-sm leading-none tracking-wide"
          style={{ color: shell.ink, opacity: 0.75 }}
        >
          Pitik
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-1.5 rounded-full"
            style={{ background: shell.accent, boxShadow: `0 0 6px ${shell.accent}` }}
          />
          <span
            className="max-w-[10rem] truncate font-mono text-[0.5rem] uppercase tracking-[0.2em]"
            style={{ color: shell.ink, opacity: 0.6 }}
          >
            {model}
          </span>
        </span>
      </div>

      <div ref={screenRef} className="relative z-[2] grid min-h-0 flex-1 place-items-center px-3">
        <div
          className="relative overflow-hidden rounded-lg bg-black"
          style={{
            width: screen.width || "100%",
            height: screen.height || "100%",
            boxShadow: `inset 0 0 0 2px rgba(0,0,0,0.85), 0 0 0 2px ${shell.lens}66`,
          }}
        >
          {children}
        </div>
      </div>

      <div className="relative z-[2] shrink-0 px-5 pt-2">
        <div className="flex items-center justify-between rounded-sm bg-black/45 px-2.5 py-1 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[#9fe6b8]">
          <span aria-hidden>
            {typeof shotsLeft === "number"
              ? `${String(Math.max(0, shotsLeft)).padStart(3, "0")} LEFT`
              : String(shotCount).padStart(3, "0")}
          </span>
          {/* The zero-padded counter reads as a camera back but as gibberish to
              a screen reader, so the count is also stated plainly. */}
          <span className="sr-only" role="status">
            {typeof shotsLeft === "number"
              ? `${Math.max(0, shotsLeft)} shots left`
              : `${shotCount} ${shotCount === 1 ? "shot" : "shots"} taken`}
          </span>
          {/* Shown only when armed, so the readout reports the camera's real
              state rather than listing features it has. */}
          {dateStamp ? <span>DATE ON</span> : null}
          <span>{clock}</span>
        </div>
      </div>

      {/* The dial sits on its own dark strip rather than directly on the body:
          model names have to stay legible on a cream instant-film shell as well
          as on black plastic, and one backdrop is simpler than tinting text per
          model. */}
      <div className="relative z-[2] mx-5 mt-2 shrink-0 overflow-hidden rounded-full bg-black/35 py-0.5">
        {dial}
      </div>

      <div className="relative z-[2] flex shrink-0 items-center justify-center gap-1 px-3 pt-1">
        {tools}
      </div>

      <div
        className="relative z-[2] flex shrink-0 items-center justify-between px-7 pt-2"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 1rem)" }}
      >
        {deck}
      </div>
    </div>
  );
}
