"use client";

import { Camera, ImageDown, RefreshCw } from "lucide-react";
import type { CameraError } from "@/lib/camera/errors";
import { Button } from "@/components/ui/button";

/**
 * What stands in for the viewfinder before the camera is live.
 *
 * The camera opens on arrival, so in the ordinary case this is a spinner that
 * lasts a moment. Its real job is the failure case: a refusal, a camera already
 * in use, or a browser that cannot open one at all — each stated plainly with
 * the one thing the user can try.
 */
export function PermissionGate({
  status,
  error,
  onStart,
  onImport,
}: {
  status: "idle" | "starting" | "error";
  error: CameraError | null;
  onStart: () => void;
  onImport?: () => void;
}) {
  if (status === "starting") {
    return (
      <div className="grid size-full place-items-center">
        <div className="flex flex-col items-center gap-3 text-ink-400">
          <RefreshCw className="size-5 animate-spin" aria-hidden />
          <p className="text-sm">Opening the camera…</p>
        </div>
      </div>
    );
  }

  if (status === "error" && error) {
    const recoverable = error.code !== "not-found" && error.code !== "unsupported";
    return (
      <div className="grid size-full place-items-center p-6">
        <div className="max-w-xs text-center">
          <h2 className="font-display text-2xl text-ink-100">{error.message}</h2>
          {error.remedy ? (
            <p className="mt-2 text-sm leading-relaxed text-ink-300">{error.remedy}</p>
          ) : null}
          <div className="mt-6 flex flex-col gap-2">
            {recoverable ? (
              <Button variant="paper" size="lg" onClick={onStart}>
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
    <div className="grid size-full place-items-center p-6">
      <div className="max-w-xs text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full border border-ink-600 text-ink-200">
          <Camera className="size-6" aria-hidden />
        </div>
        <h2 className="mt-5 font-display text-2xl text-ink-100">Ready when you are</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">
          Pitik needs your camera to shoot. Photos stay on this device unless you
          choose to share them.
        </p>
        <Button variant="paper" size="lg" className="mt-6 w-full" onClick={onStart}>
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
