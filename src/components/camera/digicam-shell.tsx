"use client";

import { useEffect, useMemo, useState } from "react";
import { fitBox, useElementSize } from "@/hooks/use-element-size";
import type { AspectId } from "@/lib/db/types";
import { cn } from "@/lib/utils";

/**
 * A compact-camera body wrapped around the viewfinder.
 *
 * Selecting the Digicam profile stops being a filter choice and becomes a
 * change of instrument: you are holding a 2000s point-and-shoot, looking at its
 * screen. That is most of why the look is fun, and a rectangle of graded video
 * doesn't deliver it on its own.
 *
 * Two rules keep this from violating "no fake features":
 *
 *  - The moulded dial, pads and grille are **scenery**, not controls. They are
 *    `aria-hidden` divs with no button semantics and no hover or press states,
 *    so they read as the plastic of a camera body rather than as UI that has
 *    stopped working. Every real control stays below, where it already was.
 *  - The status readout shows **real values** — the actual aspect ratio, the
 *    actual frame count, a live clock. Nothing on this screen is invented.
 */

const ASPECT_LABEL: Record<AspectId, string> = {
  original: "FULL",
  "1:1": "1:1",
  "4:3": "4:3",
  "3:2": "3:2",
  "16:9": "16:9",
};

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

/**
 * Vertical space the body's own furniture occupies: top plate, the padding
 * around the screen, the status readout, and the moulded deck. Subtracted
 * before fitting the screen so the body shrink-wraps its LCD instead of
 * stretching it into a letterbox.
 */
const CHROME_HEIGHT = 178;
const CHROME_WIDTH = 24;

export interface DigicamShellProps {
  aspect: AspectId;
  /** Numeric framing the camera will actually capture. `null` means fill. */
  aspectRatio: number | null;
  /** Frames taken on this roll, shown on the counter like an exposure count. */
  shotCount: number;
  /** Remaining exposures on a disposable roll, if there is a limit. */
  shotsLeft?: number | null;
  /** Dims the body while the sequence is between shots. */
  busy?: boolean;
  children: React.ReactNode;
}

export function DigicamShell({
  aspect,
  aspectRatio,
  shotCount,
  shotsLeft,
  busy,
  children,
}: DigicamShellProps) {
  const clock = useClock();
  const [containerRef, containerSize] = useElementSize<HTMLDivElement>();

  // The LCD is sized to the framing the shutter will actually take, so what is
  // behind the bezel is the photograph — not a crop of it with black bars.
  const screen = useMemo(
    () =>
      fitBox(
        {
          width: Math.max(0, Math.min(containerSize.width, 448) - CHROME_WIDTH),
          height: Math.max(0, containerSize.height - CHROME_HEIGHT),
        },
        aspectRatio ?? 3 / 4,
      ),
    [containerSize, aspectRatio],
  );

  return (
    <div ref={containerRef} className="grid size-full place-items-center">
      <div
        className={cn(
          "relative flex w-full max-w-md flex-col overflow-hidden rounded-[1.75rem] transition-opacity",
          busy && "opacity-95",
        )}
        style={{
          // Width follows the screen plus the body's side moulding, so the
          // shell hugs a 16:9 LCD as happily as a square one.
          width: screen.width ? screen.width + CHROME_WIDTH : undefined,
          // Warm silver-graphite rather than cold grey, so the body sits in the
          // same palette as the rest of the app instead of looking pasted on.
          background:
            "linear-gradient(160deg, #6f6660 0%, #574f4a 26%, #3d3733 55%, #4a433e 78%, #2e2926 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -2px 6px rgba(0,0,0,0.55), 0 18px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Specular sheen across the top of the moulding. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-40"
          style={{
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0.35), rgba(255,255,255,0))",
          }}
        />

        {/* ------------------------------------------------------ top plate */}
        <div className="relative z-[2] flex shrink-0 items-center justify-between px-4 pt-3">
          <span className="font-display text-sm leading-none tracking-wide text-white/70 drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]">
            Pitik
          </span>

          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-safelight-500 shadow-[0_0_6px_rgba(234,79,52,0.9)]"
            />
            <span className="font-mono text-[0.5rem] uppercase tracking-[0.2em] text-white/45">
              Digicam
            </span>
          </span>
        </div>

        {/* -------------------------------------------------- screen bezel */}
        <div className="relative z-[2] shrink-0 px-3 py-2.5">
          <div
            className="relative overflow-hidden rounded-lg bg-black"
            style={{
              width: screen.width || "100%",
              height: screen.height || "auto",
              boxShadow:
                "inset 0 0 0 2px rgba(0,0,0,0.85), inset 0 2px 10px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.12)",
            }}
          >
            {children}
          </div>
        </div>

        {/* ------------------------------------------------------- readout */}
        <div className="relative z-[2] shrink-0 px-4">
          <div className="flex items-center justify-between rounded-sm bg-black/45 px-2.5 py-1 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[#9fe6b8]">
            <span>{ASPECT_LABEL[aspect]}</span>
            <span aria-hidden>
              {typeof shotsLeft === "number"
                ? `${String(Math.max(0, shotsLeft)).padStart(3, "0")} LEFT`
                : `${String(shotCount).padStart(3, "0")}`}
            </span>
            <span>{clock}</span>
          </div>
        </div>

        {/* --------------------------------------------------- moulded deck */}
        <div aria-hidden className="relative z-[2] flex shrink-0 items-center justify-between px-5 py-3">
          {/* Speaker grille */}
          <span className="flex gap-[3px]">
            {[0, 1, 2, 3, 4].map((line) => (
              <span
                key={line}
                className="h-4 w-[2px] rounded-full bg-black/35 shadow-[0_1px_0_rgba(255,255,255,0.14)]"
              />
            ))}
          </span>

          {/* Four-way pad and dial ring — plastic, not buttons. */}
          <span
            className="relative grid size-14 place-items-center rounded-full"
            style={{
              background:
                "conic-gradient(from 210deg, #7a716a, #4b443f, #6d645e, #3a3430, #7a716a)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 5px rgba(0,0,0,0.6), 0 2px 5px rgba(0,0,0,0.45)",
            }}
          >
            <span
              className="grid size-6 place-items-center rounded-full"
              style={{
                background: "linear-gradient(160deg, #5e5751, #342f2c)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 1px 3px rgba(0,0,0,0.6)",
              }}
            >
              <span className="size-1 rounded-full bg-white/25" />
            </span>
          </span>

          {/* Two small function pads */}
          <span className="flex flex-col gap-2">
            {[0, 1].map((pad) => (
              <span
                key={pad}
                className="h-2.5 w-6 rounded-full"
                style={{
                  background: "linear-gradient(160deg, #6b625c, #3b3531)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.5)",
                }}
              />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
