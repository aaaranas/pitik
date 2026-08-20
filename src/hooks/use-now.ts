"use client";

import { useSyncExternalStore } from "react";

/**
 * The current time, as a value React is allowed to read during render.
 *
 * Reading `Date.now()` inline in a component is impure — the same render would
 * produce different output on every pass, and countdowns rendered that way go
 * stale because nothing tells React to re-render them. `useSyncExternalStore`
 * is the sanctioned way to read a changing external value: the snapshot is
 * stable within a render, and the subscription drives updates.
 *
 * Quantised to the minute so a screen full of "ready in 3 hours" labels causes
 * one re-render an hour rather than sixty a second.
 */
const MINUTE = 60_000;

function subscribe(onChange: () => void): () => void {
  const timer = setInterval(onChange, MINUTE);
  return () => clearInterval(timer);
}

function getSnapshot(): number {
  return Math.floor(Date.now() / MINUTE) * MINUTE;
}

/** Server renders assume "now" is unknown; the value corrects on hydration. */
function getServerSnapshot(): number {
  return 0;
}

export function useMinute(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Reads a browser capability without tripping hydration.
 *
 * The server has no `navigator`, so `getServerSnapshot` returns the optimistic
 * answer and the real one arrives on the client's first commit.
 */
export function useCapability(read: () => boolean, serverValue = true): boolean {
  return useSyncExternalStore(
    () => () => {},
    read,
    () => serverValue,
  );
}
