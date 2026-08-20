"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CameraScreen } from "./camera-screen";
import { useSession } from "@/components/providers/session-provider";
import { useCaptures, useRoll } from "@/hooks/use-store";

/**
 * Resolves which roll the camera is shooting into, then hands over.
 *
 * `?roll=` wins if present (that's how the tab bar and roll screens deep-link);
 * otherwise the active session roll is used, and if there isn't one, an ad-hoc
 * roll is opened named after the time of day. Opening the camera never stops to
 * ask a question — the naming step exists on the home screen for people who
 * want it, and is skipped entirely for people who just want to shoot.
 */
function CameraRouteInner() {
  const params = useSearchParams();
  const requestedId = params.get("roll");
  const { activeRollId, setActiveRoll, ensureRoll, ready } = useSession();
  const [resolving, setResolving] = useState(true);

  const rollId = requestedId ?? activeRollId;
  const { data: roll } = useRoll(rollId ?? undefined);
  const { data: captures } = useCaptures(rollId ?? undefined);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      if (requestedId && requestedId !== activeRollId) setActiveRoll(requestedId);
      if (!rollId) await ensureRoll();
      if (!cancelled) setResolving(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeRollId, ensureRoll, ready, requestedId, rollId, setActiveRoll]);

  if (resolving && !roll) {
    return (
      <div className="grid h-full place-items-center bg-ink-950">
        <span className="sr-only">Preparing the camera</span>
      </div>
    );
  }

  return (
    <CameraScreen
      roll={roll}
      captureCount={captures.length}
      lastCapture={captures.length ? captures[captures.length - 1] : null}
    />
  );
}

export function CameraRoute() {
  return (
    // `useSearchParams` needs a Suspense boundary to keep the rest of the route
    // statically renderable.
    <Suspense fallback={<div className="h-full bg-ink-950" />}>
      <CameraRouteInner />
    </Suspense>
  );
}
