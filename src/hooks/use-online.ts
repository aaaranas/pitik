"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Connectivity, as far as the browser knows.
 *
 * `navigator.onLine` only reports whether a network interface exists, not
 * whether anything is reachable — so this drives *messaging* and sync retries,
 * never whether a feature is allowed to run. Every camera and booth path works
 * identically in both states by design.
 *
 * Read through `useSyncExternalStore` because that is exactly what this is: an
 * external mutable value with a subscription. The server snapshot is optimistic
 * so hydration never flashes an offline banner on a good connection.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** True once the component has mounted on the client. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Deliberately in an effect: the whole point is to distinguish the server
    // render from the first client commit.
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted;
}
