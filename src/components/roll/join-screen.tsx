"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PitikMark } from "@/components/shell/wordmark";
import { useSession } from "@/components/providers/session-provider";
import { useAuth } from "@/hooks/use-auth";
import { getRollByShareCode, updateSettings } from "@/lib/db/repo";
import { isShareCode } from "@/lib/ids";
import { getSupabaseClient } from "@/lib/supabase/client";
import { pullRemote } from "@/lib/sync/pull";

type State =
  | { kind: "checking" }
  | { kind: "invalid" }
  | { kind: "local"; rollId: string; title: string }
  | { kind: "needs-account" }
  | { kind: "joining" }
  | { kind: "fetching" }
  | { kind: "error"; message: string };

/**
 * Redeeming a share code.
 *
 * Three outcomes, and the screen is honest about which one you're in:
 *  - the roll is already on this device (you scanned your own code) → open it
 *  - the roll is remote and you're signed in → join it
 *  - the roll is remote and you're not → say so, rather than silently failing
 */
export function JoinScreen({ code }: { code: string }) {
  const router = useRouter();
  const auth = useAuth();
  const { setActiveRoll } = useSession();
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!isShareCode(code)) {
        setState({ kind: "invalid" });
        return;
      }
      const local = await getRollByShareCode(code);
      if (cancelled) return;
      if (local) {
        setState({ kind: "local", rollId: local.id, title: local.title });
        return;
      }
      if (auth.loading) return;
      if (!auth.configured || !auth.session) {
        setState({ kind: "needs-account" });
        return;
      }
      setState({ kind: "joining" });
      const client = getSupabaseClient();
      if (!client) {
        setState({ kind: "needs-account" });
        return;
      }
      const { data, error } = await client.rpc("join_roll_by_code", { code });
      if (cancelled) return;
      if (error || !data) {
        setState({ kind: "error", message: error?.message ?? "That code didn't work." });
        return;
      }

      // Joining grants access; it does not move any photographs. Pull now so
      // the roll has something in it when the screen opens — arriving at an
      // empty roll you just joined reads as a broken invite.
      setState({ kind: "fetching" });
      try {
        // Joining a shared roll is an explicit request for other people's
        // photos to reach this device, so sync is switched on with it.
        await updateSettings({ syncEnabled: true });
        await pullRemote(client);
      } catch {
        // The roll is joined either way; the background loop will retry.
      }
      if (cancelled) return;

      setActiveRoll(data);
      router.replace(`/rolls/${data}`);
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.configured, auth.loading, auth.session, code, router, setActiveRoll]);

  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="max-w-xs">
        <PitikMark className="mx-auto size-8 text-paper" />
        <p className="mt-5 font-mono text-2xl tracking-[0.28em] text-paper">{code}</p>

        {state.kind === "checking" || state.kind === "joining" ? (
          <p className="mt-4 text-sm text-ink-400">Looking for that roll…</p>
        ) : null}

        {state.kind === "fetching" ? (
          <p className="mt-4 text-sm text-ink-400">Getting the photos…</p>
        ) : null}

        {state.kind === "invalid" ? (
          <>
            <h1 className="mt-4 font-display text-2xl text-ink-100">That code isn&rsquo;t valid</h1>
            <p className="mt-2 text-sm text-ink-400">
              Codes are six letters and numbers. Check it and try again.
            </p>
          </>
        ) : null}

        {state.kind === "local" ? (
          <>
            <h1 className="mt-4 font-display text-2xl text-ink-100">{state.title}</h1>
            <p className="mt-2 text-sm text-ink-400">This roll is already on your device.</p>
            <Link
              href={`/rolls/${state.rollId}`}
              className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-paper px-6 text-sm font-medium text-ink-900"
            >
              Open it
            </Link>
          </>
        ) : null}

        {state.kind === "needs-account" ? (
          <>
            <h1 className="mt-4 font-display text-2xl text-ink-100">
              You&rsquo;ll need an account for this
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-400">
              Joining someone else&rsquo;s roll means photos have to travel between devices,
              and that needs somewhere to sync to. Everything else in Pitik works
              without one.
            </p>
            <Link
              href="/settings"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-paper px-6 text-sm font-medium text-ink-900"
            >
              Set up an account
            </Link>
          </>
        ) : null}

        {state.kind === "error" ? (
          <>
            <h1 className="mt-4 font-display text-2xl text-ink-100">Couldn&rsquo;t join that roll</h1>
            <p className="mt-2 text-sm text-ink-400">{state.message}</p>
            <Button variant="ghost" className="mt-5" onClick={() => router.push("/")}>
              Go home
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
