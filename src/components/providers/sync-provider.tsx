"use client";

import { useSync } from "@/hooks/use-sync";

/**
 * Mounts background sync once, at the top of the app.
 *
 * Renders nothing. It exists so the sync loop has a single owner — running
 * `useSync` in two components would double every upload and every poll.
 */
export function SyncProvider() {
  useSync();
  return null;
}
