"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./use-auth";
import { useOnline } from "./use-online";
import { useSettings } from "./use-store";
import { getSupabaseClient } from "@/lib/supabase/client";
import { type FullSyncResult, syncAll } from "@/lib/sync/engine";

/**
 * Runs sync in the background when it is switched on.
 *
 * Four things gate it, and all four must hold: sync is enabled in Settings, the
 * user is signed in, Supabase is configured, and the browser thinks it is
 * online. Nothing here ever runs for a guest, which is what keeps "your photos
 * stay on this device" a true statement rather than a hopeful one.
 *
 * Mounted once, in the app shell.
 */
const INTERVAL_MS = 5 * 60 * 1000;

export interface SyncHandle {
  syncing: boolean;
  last: FullSyncResult | null;
  error: string | null;
  /** Runs a round now. Safe to call while one is already in flight. */
  run: () => Promise<void>;
}

export function useSync(): SyncHandle {
  const { session, configured } = useAuth();
  const online = useOnline();
  const { settings } = useSettings();

  const [syncing, setSyncing] = useState(false);
  const [last, setLast] = useState<FullSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = Boolean(configured && session && settings?.syncEnabled && online);
  const userId = session?.user.id ?? null;
  /** Guards against a manual tap racing the interval. */
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client || !userId || inFlight.current) return;

    inFlight.current = true;
    setSyncing(true);
    try {
      const result = await syncAll(client, userId);
      setLast(result);
      setError(null);
    } catch (cause) {
      // A failed round is normal on a flaky connection: the outbox keeps the
      // work and the next round retries it. Surfaced, never thrown.
      setError(cause instanceof Error ? cause.message : "Sync failed.");
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!enabled) return;
    // One round on becoming eligible — signing in, coming back online, or
    // switching sync on — then a slow heartbeat. The first round is deferred by
    // a tick so scheduling it doesn't set state synchronously inside the effect
    // that scheduled it.
    const kickoff = window.setTimeout(() => void run(), 0);
    const timer = window.setInterval(() => void run(), INTERVAL_MS);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, [enabled, run]);

  return { syncing, last, error, run };
}
