"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary.
 *
 * Says what happened in one plain sentence and offers the one useful action.
 * The stack goes to the console for whoever is debugging; it is never put in
 * front of someone who just wanted to take a photo.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[pitik]", error);
  }, [error]);

  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="max-w-xs">
        <h1 className="font-display text-3xl text-paper">Something jammed</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">
          Pitik hit a problem on this screen. Your photos are safe on this device —
          nothing here can delete them.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-7 inline-flex h-12 items-center justify-center rounded-xl bg-paper px-6 text-sm font-medium text-ink-900"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
