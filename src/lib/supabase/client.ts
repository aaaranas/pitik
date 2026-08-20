"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import type { Database } from "./database.types";

/**
 * Browser Supabase client.
 *
 * Memoised: `createBrowserClient` opens a realtime socket and installs auth
 * listeners, and creating one per render would leak both. Returns `null` when
 * the project isn't configured, which every caller must handle — that is the
 * normal state for a local-only install, not an error.
 */
let client: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}
