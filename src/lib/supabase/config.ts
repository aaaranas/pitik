/**
 * Supabase is optional.
 *
 * Pitik is a local-first camera: every feature except sync, accounts, and
 * shared rolls works with no backend at all. So rather than crashing on a
 * missing environment variable, the app checks here and hides the features that
 * genuinely need a server. A fresh clone with no `.env.local` runs completely.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** Storage bucket holding user photos. Private; served via signed URLs only. */
export const PHOTO_BUCKET = "captures";
