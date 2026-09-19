"use client";

import { Camera, ImageDown, RefreshCw } from "lucide-react";
import type { CameraError } from "@/lib/camera/errors";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * What stands in for the viewfinder before the camera is live.
 *
 * The camera opens on arrival, so in the ordinary case this is a spinner that
 * lasts a moment. Its real job is the failure case: a refusal, a camera already
 * in use, or a browser that cannot open one at all — each stated plainly with
 * the one thing the user can try.
 *
 * `tone` lets a dark host (the booth's deliberately dark sequence) keep its
 * ground instead of flashing a light panel over it. "light" is the default —
 * every camera-mode call site keeps it — "dark" follows the ratified
 * dark-ground rule: cream-50 body text, cocoa-400 muted, cocoa-900 ground.
 */
export function PermissionGate({
  status,
  error,
  onStart,
  onImport,
  tone = "light",
}: {
  status: "idle" | "starting" | "error";
  error: CameraError | null;
  onStart: () => void;
  /** Renders an "Import instead" fallback when provided. Its ghost-variant
   * text is cocoa-600 on cocoa-900 (2.62:1) with `tone="dark"` — unreachable
   * today because the only dark caller passes no `onImport`, but the next
   * caller that pairs the two needs a dark-aware text colour first. */
  onImport?: () => void;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";

  if (status === "starting") {
    return (
      <div
        className={cn(
          "grid size-full place-items-center",
          dark ? "on-dark bg-cocoa-900" : "bg-cream-50",
        )}
      >
        <div
          className={cn("flex flex-col items-center gap-3", dark ? "text-cocoa-400" : "text-cocoa-600")}
        >
          <RefreshCw className="size-5 animate-spin" aria-hidden />
          <p className="text-sm">Opening the camera…</p>
        </div>
      </div>
    );
  }

  if (status === "error" && error) {
    const recoverable = error.code !== "not-found" && error.code !== "unsupported";
    return (
      <div
        className={cn(
          "grid size-full place-items-center p-6",
          dark ? "on-dark bg-cocoa-900" : "bg-cream-50",
        )}
      >
        <div className="max-w-xs text-center">
          <h2 className={cn("font-display text-2xl", dark ? "text-cream-50" : "text-cocoa-900")}>
            {error.message}
          </h2>
          {error.remedy ? (
            <p
              className={cn(
                "mt-2 text-sm leading-relaxed",
                dark ? "text-cocoa-400" : "text-cocoa-600",
              )}
            >
              {error.remedy}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col gap-2">
            {recoverable ? (
              <Button variant="soft" size="lg" onClick={onStart}>
                Try again
              </Button>
            ) : null}
            {onImport ? (
              <Button variant="ghost" onClick={onImport}>
                <ImageDown className="size-4" aria-hidden />
                Import from gallery instead
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid size-full place-items-center p-6",
        dark ? "on-dark bg-cocoa-900" : "bg-cream-50",
      )}
    >
      <div className="max-w-xs text-center">
        <div
          className={cn(
            "mx-auto grid size-14 place-items-center rounded-full border",
            dark ? "border-cocoa-800 text-cocoa-400" : "border-cream-300 text-cocoa-800",
          )}
        >
          <Camera className="size-6" aria-hidden />
        </div>
        <h2 className={cn("mt-5 font-display text-2xl", dark ? "text-cream-50" : "text-cocoa-900")}>
          Ready when you are
        </h2>
        <p
          className={cn(
            "mt-2 text-sm leading-relaxed",
            dark ? "text-cocoa-400" : "text-cocoa-600",
          )}
        >
          Pitik needs your camera to shoot. Photos stay on this device unless you
          choose to share them.
        </p>
        <Button variant="soft" size="lg" className="mt-6 w-full" onClick={onStart}>
          Turn on the camera
        </Button>
        {onImport ? (
          <Button variant="ghost" className="mt-2 w-full" onClick={onImport}>
            <ImageDown className="size-4" aria-hidden />
            Import photos instead
          </Button>
        ) : null}
      </div>
    </div>
  );
}
