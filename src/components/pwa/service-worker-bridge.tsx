"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Registers the service worker and handles updates.
 *
 * Updates are never applied silently. A camera app can be mid-capture, mid-
 * booth-sequence, or holding an unencoded frame in memory when a new build
 * lands; swapping the worker underneath that could lose a photo. So a new
 * version waits, visibly, until the user says go.
 */
export function ServiceWorkerBridge() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  /** Set only when the user has actually accepted an update. */
  const acceptedRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // Registering in dev would cache a shell that fights hot reload.
    if (process.env.NODE_ENV !== "production") return;

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (cancelled) return;

        if (registration.waiting) setWaiting(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // "installed" with an existing controller means an update is ready;
            // without one it's the very first install and there's nothing to say.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(installing);
            }
          });
        });
      } catch {
        // A failed registration costs offline support, nothing else. The app
        // keeps working, so this is not worth interrupting anyone over.
      }
    };

    void register();

    let reloading = false;
    const onControllerChange = () => {
      // `clients.claim()` fires this on the *first* registration too, when
      // there is no update and nothing to apply. Reloading then would yank the
      // page out from under someone who has just arrived — and, on the camera
      // screen, out from under a capture. Only a reload the user asked for is
      // allowed to happen.
      if (reloading || !acceptedRef.current) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!waiting) return null;

  return (
    <div
      className="fixed inset-x-0 z-[95] flex justify-center px-4"
      style={{ bottom: "calc(var(--safe-bottom) + 4.5rem)" }}
      role="status"
    >
      <div className="animate-rise flex w-full max-w-sm items-center gap-3 rounded-xl border border-ink-600 bg-ink-800/95 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur">
        <RefreshCw className="size-4 shrink-0 text-ink-300" aria-hidden />
        <p className="flex-1 text-sm text-ink-100">A new version of Pitik is ready.</p>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            acceptedRef.current = true;
            waiting.postMessage("SKIP_WAITING");
          }}
        >
          Reload
        </Button>
      </div>
    </div>
  );
}
