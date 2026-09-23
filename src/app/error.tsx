"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

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
    <div className="grid min-h-full place-items-center bg-cream-50 px-6 text-center">
      <div className="max-w-xs">
        <h1 className="font-display text-3xl tracking-[-0.04em] text-cocoa-900">Something jammed</h1>
        <p className="mt-3 text-sm leading-relaxed text-cocoa-600">
          Pitik hit a problem on this screen. Your photos are safe on this device —
          nothing here can delete them.
        </p>
        <Button variant="primary" size="lg" onClick={reset} className="mt-7 w-full">
          Try again
        </Button>
      </div>
    </div>
  );
}
