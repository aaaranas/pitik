"use client";

import { CloudUpload, LogOut, Mail } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { useAuth } from "@/hooks/use-auth";
import { useOnline } from "@/hooks/use-online";
import { useSettings } from "@/hooks/use-store";
import { useSync } from "@/hooks/use-sync";
import { reconcile } from "@/lib/sync/engine";
import { cn } from "@/lib/utils";

const emailSchema = z.string().trim().email("That doesn't look like an email address.");

/**
 * Account and sync.
 *
 * Framed as backup, because that is honestly all it does: Pitik works
 * identically signed out, and signing in never changes what the camera or the
 * booth can do. Sync is off even after signing in until it is switched on here.
 */
export function AccountPanel() {
  const auth = useAuth();
  const online = useOnline();
  const { settings, update } = useSettings();
  const { toast } = useToast();
  const sync = useSync();

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!auth.configured) {
    return (
      <section className="mt-4 pillow p-5">
        <h2 className="font-display text-xl text-cocoa-900">Backup isn&rsquo;t set up</h2>
        <p className="mt-2 text-sm leading-relaxed text-cocoa-600">
          This install has no Supabase project connected, so accounts and shared rolls
          are unavailable. Everything else works — your photos live on this device.
        </p>
        <p className="mt-3 font-mono text-[0.6875rem] text-cocoa-600">
          Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable it.
        </p>
      </section>
    );
  }

  if (auth.session) {
    const runSync = async () => {
      await sync.run();
      const result = sync.last;
      const arrived = result ? result.pulled.captures + result.pulled.strips : 0;
      const sent = result?.processed ?? 0;

      if (sync.error) {
        toast("Sync didn't finish.", { detail: sync.error, tone: "error" });
        return;
      }
      if (!sent && !arrived) {
        toast("Everything is already backed up.", { tone: "success" });
        return;
      }
      toast(
        [
          sent ? `Backed up ${sent} item${sent === 1 ? "" : "s"}` : null,
          arrived ? `pulled ${arrived} new photo${arrived === 1 ? "" : "s"}` : null,
        ]
          .filter(Boolean)
          .join(", ") + ".",
        { tone: "success" },
      );
    };

    return (
      <section className="mt-4 pillow p-5">
        <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-cocoa-600">Signed in</p>
        <p className="mt-1 truncate text-sm text-cocoa-900">{auth.session.user.email}</p>

        <label className="mt-4 flex cursor-pointer items-start gap-3 border-t border-cream-300 pt-4">
          <input
            type="checkbox"
            checked={settings?.syncEnabled ?? false}
            onChange={async (event) => {
              await update({ syncEnabled: event.target.checked });
              if (event.target.checked) await reconcile();
            }}
            className="mt-0.5 size-4 shrink-0 accent-[var(--color-sky-deep)]"
          />
          <span>
            <span className="block text-sm text-cocoa-900">Back up and sync my rolls</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-cocoa-600">
              Uploads photos to your private storage so they survive losing this
              device, and brings in photos other people added to rolls you share.
              Off by default.
            </span>
          </span>
        </label>

        <div className="mt-4 flex gap-2">
          <Button
            variant="subtle"
            className="flex-1"
            disabled={!online || sync.syncing || !(settings?.syncEnabled ?? false)}
            onClick={() => void runSync()}
          >
            <CloudUpload className={cn("size-4", sync.syncing && "animate-pulse")} aria-hidden />
            {sync.syncing ? "Syncing…" : online ? "Sync now" : "Offline"}
          </Button>
          <Button variant="ghost" onClick={() => void auth.signOut()} aria-label="Sign out">
            <LogOut className="size-4" aria-hidden />
          </Button>
        </div>
      </section>
    );
  }

  const submit = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setSending(true);
    setError(null);
    const { error: sendError } = await auth.sendMagicLink(parsed.data);
    setSending(false);
    if (sendError) setError(sendError);
    else setSent(true);
  };

  return (
    <section className="mt-4 pillow p-5">
      <h2 className="font-display text-xl text-cocoa-900">Back up your rolls</h2>
      <p className="mt-2 text-sm leading-relaxed text-cocoa-600">
        Optional. Sign in to keep a private copy of your photos, and to share rolls
        with the people you were with. The camera works either way.
      </p>

      {sent ? (
        <p className="tint-mint mt-4 flex items-start gap-2 rounded-slot border p-3 text-sm">
          <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
          Check {email} for a sign-in link.
        </p>
      ) : (
        <div className="mt-4">
          <label htmlFor="account-email" className="sr-only">
            Email address
          </label>
          <div className="flex gap-2">
            <input
              id="account-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => event.key === "Enter" && void submit()}
              placeholder="you@example.com"
              aria-invalid={Boolean(error)}
              className="min-w-0 flex-1 rounded-slot border border-edge-strong bg-cream-200 px-3 py-2.5 text-sm text-cocoa-900 placeholder:text-cocoa-600 focus:border-sky-deep focus:outline-none"
            />
            <Button variant="subtle" onClick={() => void submit()} disabled={sending || !online}>
              {sending ? "Sending…" : "Send link"}
            </Button>
          </div>
          {error ? <p className="mt-2 text-sm text-blush-deep">{error}</p> : null}
        </div>
      )}
    </section>
  );
}
