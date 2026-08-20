"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as repo from "@/lib/db/repo";
import type { Capture, Roll, Settings, Strip } from "@/lib/db/types";

/**
 * React bindings for the local store.
 *
 * A tiny query layer rather than a state-management library: the data all lives
 * in IndexedDB, every mutation announces itself through `repo.subscribe`, and
 * these hooks simply re-read. That keeps a single source of truth and avoids a
 * client cache that could disagree with what was actually written to disk.
 */

export interface Query<T> {
  data: T;
  /** True until the first successful read. Re-reads keep showing stale data. */
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Runs an async read and re-runs it on demand.
 *
 * `run` must be memoised by the caller — it is the dependency that decides when
 * to re-query, which keeps the reactivity explicit instead of hidden behind a
 * ref that silently swallows stale closures.
 */
function useQuery<T>(run: () => Promise<T>, initial: T): Query<T> {
  const [state, setState] = useState<{ data: T; loading: boolean; error: Error | null }>({
    data: initial,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Every state change happens inside this async callback rather than in the
    // effect body, so a re-query never triggers a synchronous cascading render.
    void (async () => {
      try {
        const data = await run();
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (cause) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            loading: false,
            error: cause instanceof Error ? cause : new Error(String(cause)),
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [run, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, refresh };
}

/** Re-runs `refresh` whenever one of the given stores changes. */
function useStoreSubscription(scope: string, refresh: () => void): void {
  useEffect(() => {
    return repo.subscribe((changed) => {
      if (changed === scope) refresh();
    });
  }, [scope, refresh]);
}

export function useRolls(): Query<Roll[]> {
  const run = useCallback(() => repo.listRolls(), []);
  const query = useQuery(run, [] as Roll[]);
  useStoreSubscription("rolls", query.refresh);
  return query;
}

export function useRoll(id: string | undefined): Query<Roll | null> {
  const run = useCallback(
    async () => (id ? ((await repo.getRoll(id)) ?? null) : null),
    [id],
  );
  const query = useQuery(run, null as Roll | null);
  useStoreSubscription("rolls", query.refresh);
  return query;
}

export function useCaptures(rollId: string | undefined): Query<Capture[]> {
  const run = useCallback(
    async () => (rollId ? repo.listCaptures(rollId) : []),
    [rollId],
  );
  const query = useQuery(run, [] as Capture[]);
  useStoreSubscription("captures", query.refresh);
  return query;
}

export function useRecentCaptures(limit = 12): Query<Capture[]> {
  const run = useCallback(() => repo.listRecentCaptures(limit), [limit]);
  const query = useQuery(run, [] as Capture[]);
  useStoreSubscription("captures", query.refresh);
  return query;
}

export function useFavorites(): Query<Capture[]> {
  const run = useCallback(() => repo.listFavorites(), []);
  const query = useQuery(run, [] as Capture[]);
  useStoreSubscription("captures", query.refresh);
  return query;
}

export function useStrips(rollId?: string): Query<Strip[]> {
  const run = useCallback(() => repo.listStrips(rollId), [rollId]);
  const query = useQuery(run, [] as Strip[]);
  useStoreSubscription("strips", query.refresh);
  return query;
}

export interface SettingsHandle {
  settings: Settings | null;
  loading: boolean;
  update: (patch: Partial<Settings>) => Promise<void>;
}

export function useSettings(): SettingsHandle {
  const run = useCallback(() => repo.getSettings(), []);
  const query = useQuery(run, null as Settings | null);
  useStoreSubscription("settings", query.refresh);

  const update = useCallback(async (patch: Partial<Settings>) => {
    await repo.updateSettings(patch);
  }, []);

  return { settings: query.data, loading: query.loading, update };
}

/** Cover thumbnails per roll, for the home screen's cards. */
export function useRollCovers(rolls: Roll[]): Record<string, Blob> {
  const ids = useMemo(() => rolls.map((roll) => roll.id).join(","), [rolls]);
  const run = useCallback(
    () => repo.rollCovers(ids.split(",").filter(Boolean)),
    [ids],
  );
  const query = useQuery(run, {} as Record<string, Blob>);
  useStoreSubscription("captures", query.refresh);
  return query.data;
}

/** Photo counts per roll, for the home screen's cards. */
export function useRollCounts(rolls: Roll[]): Record<string, number> {
  const ids = useMemo(() => rolls.map((roll) => roll.id).join(","), [rolls]);
  const run = useCallback(async () => {
    const entries = await Promise.all(
      ids
        .split(",")
        .filter(Boolean)
        .map(async (id) => [id, await repo.countCaptures(id)] as const),
    );
    return Object.fromEntries(entries) as Record<string, number>;
  }, [ids]);
  const query = useQuery(run, {} as Record<string, number>);
  useStoreSubscription("captures", query.refresh);
  return query.data;
}
