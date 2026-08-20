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
 * otherwise the active session roll is used. If there is neither, the camera
 * simply shoots into the camera library — no roll is invented, and opening the
 * camera never stops to ask a question.
 */
function CameraRouteInner() {
  const params = useSearchParams();
  const requestedId = params.get("roll");
  const { activeRollId, setActiveRoll, ready } = useSession();

  const { destinationFor } = useSession();
  /**
   * Where this session is filing photographs.
   *
   * Resolved up front purely so the header and the recent-frame thumbnail can
   * show the right collection. The capture path resolves it again at the moment
   * of the press, which is what actually decides where a frame lands.
   */
  const [destination, setDestination] = useState<string | null>(null);

  const rollId = requestedId ?? activeRollId ?? destination;
  const { data: roll } = useRoll(rollId ?? undefined);
  const { data: captures } = useCaptures(rollId ?? undefined);

  useEffect(() => {
    if (!ready) return;
    if (requestedId && requestedId !== activeRollId) setActiveRoll(requestedId);
  }, [activeRollId, ready, requestedId, setActiveRoll]);

  useEffect(() => {
    if (!ready || requestedId || activeRollId) return;
    let cancelled = false;
    void (async () => {
      const id = await destinationFor("camera");
      if (!cancelled) setDestination(id);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeRollId, destinationFor, ready, requestedId]);

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
