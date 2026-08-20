"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Authentication state.
 *
 * Auth is entirely optional in Pitik — `configured: false` is a supported,
 * fully-functional mode, not a broken install. Callers must treat a null
 * session as normal rather than as a redirect trigger.
 */
export interface AuthState {
  configured: boolean;
  session: Session | null;
  loading: boolean;
  sendMagicLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    const client = getSupabaseClient();
    let active = true;

    void (async () => {
      if (!client) {
        setLoading(false);
        return;
      }
      const { data } = await client.auth.getSession();
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    })();

    if (!client) {
      return () => {
        active = false;
      };
    }

    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const client = getSupabaseClient();
    if (!client) return { error: "Sync isn't configured for this install." };
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await getSupabaseClient()?.auth.signOut();
  }, []);

  return { configured, session, loading, sendMagicLink, signOut };
}
