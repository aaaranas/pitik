"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createRoll, getRoll } from "@/lib/db/repo";
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
  /** Returns the current roll, opening an ad-hoc one if there isn't one yet. */
  ensureRoll: () => Promise<Roll>;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Names an unprompted roll after the time of day it was started. */
function ambientTitle(date = new Date()): string {
  const hour = date.getHours();
  const day = date.toLocaleDateString(undefined, { weekday: "long" });
  if (hour < 5) return "Late night";
  if (hour < 11) return `${day} morning`;
  if (hour < 17) return `${day} afternoon`;
  if (hour < 22) return `${day} night`;
  return "Late night";
}

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

  const ensureRoll = useCallback(async () => {
    if (activeRollId) {
      const existing = await getRoll(activeRollId);
      if (existing) return existing;
    }
    // Someone opened the camera straight from the home screen. Rather than
    // interrupting them with a naming dialog, open a roll named for right now;
    // they can rename it later from the roll screen.
    const roll = await createRoll({ title: ambientTitle(), coverStyle: "envelope" });
    setActiveRoll(roll.id);
    setActiveRollRecord(roll);
    return roll;
  }, [activeRollId, setActiveRoll]);

  const value = useMemo(
    () => ({ activeRollId, activeRoll, ready, setActiveRoll, ensureRoll }),
    [activeRollId, activeRoll, ready, setActiveRoll, ensureRoll],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>.");
  return value;
}
