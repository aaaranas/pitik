"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ensureLibrary, getRoll, type LibraryKind } from "@/lib/db/repo";
import type { Roll } from "@/lib/db/types";

/**
 * Tracks which roll the camera is currently shooting into.
 *
 * Held in context *and* mirrored to localStorage so that reopening the app
 * mid-evening drops you straight back into the same roll. Losing this would
 * mean tonight's photos silently scatter across two sessions.
 */

const STORAGE_KEY = "pitik.active-roll";

interface SessionValue {
  activeRollId: string | null;
  activeRoll: Roll | null;
  ready: boolean;
  setActiveRoll: (id: string | null) => void;
  /**
   * Where a capture should be filed.
   *
   * The roll the user explicitly started, if there is one; otherwise the
   * standing library for that kind of shooting. Taking a photograph never
   * creates a named session on the user's behalf — a roll is something you
   * decide to start, not something that happens to you.
   */
  destinationFor: (kind: LibraryKind) => Promise<string>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [activeRollId, setActiveRollId] = useState<string | null>(null);
  const [activeRoll, setActiveRollRecord] = useState<Roll | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // All state writes live inside the async callback so restoring the session
    // never causes a synchronous cascading render on mount.
    void (async () => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          // Verify the roll still exists — another tab may have deleted it.
          const roll = await getRoll(stored);
          if (cancelled) return;
          if (roll) {
            setActiveRollId(roll.id);
            setActiveRollRecord(roll);
          } else {
            window.localStorage.removeItem(STORAGE_KEY);
          }
        } catch {
          // A failed read just means we start without an active roll.
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setActiveRoll = useCallback((id: string | null) => {
    setActiveRollId(id);
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const roll = activeRollId ? await getRoll(activeRollId) : null;
      if (!cancelled) setActiveRollRecord(roll ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeRollId]);

  const destinationFor = useCallback(
    async (kind: LibraryKind) => {
      if (activeRollId) {
        const existing = await getRoll(activeRollId);
        if (existing) return existing.id;
        // The roll was deleted elsewhere; fall through to the library rather
        // than writing into a record that no longer exists.
        setActiveRoll(null);
      }
      return (await ensureLibrary(kind)).id;
    },
    [activeRollId, setActiveRoll],
  );

  const value = useMemo(
    () => ({ activeRollId, activeRoll, ready, setActiveRoll, destinationFor }),
    [activeRollId, activeRoll, ready, setActiveRoll, destinationFor],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>.");
  return value;
}
