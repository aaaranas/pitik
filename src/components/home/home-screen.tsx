"use client";

import { Camera, LayoutGrid, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { NewRollSheet } from "@/components/roll/new-roll-sheet";
import { RollCard } from "@/components/roll/roll-card";
import { useSession } from "@/components/providers/session-provider";
import { useObjectUrl } from "@/hooks/use-object-url";
import { useRecentCaptures, useRollCounts, useRollCovers, useRolls } from "@/hooks/use-store";
import type { Capture } from "@/lib/db/types";
import { relativeDay } from "@/lib/utils";

/**
 * Home.
 *
 * Built as a film carton rather than a landing page: masthead between two
 * rules, a typewritten spec line, a perforated lab ticket for the one decision
 * that matters, and a contact strip of what you last shot. Everything borrows
 * from the packaging photographs used to come in, because that is the feeling
 * the whole app is trading on.
 *
 * There are no statistics here and there never should be — nobody opens a
 * camera to review their usage.
 */
export function HomeScreen() {
  const [newRollOpen, setNewRollOpen] = useState(false);
  const { data: rolls, loading } = useRolls();
  const counts = useRollCounts(rolls);
  const covers = useRollCovers(rolls);
  const { data: recent } = useRecentCaptures(12);
  const { activeRollId } = useSession();

  const activeRoll = rolls.find((roll) => roll.id === activeRollId);

  return (
    <div
      className="mx-auto w-full max-w-2xl px-5 pb-12"
      style={{ paddingTop: "calc(var(--safe-top) + 1.25rem)" }}
    >
      {/* ------------------------------------------------------- masthead */}
      <header className="text-paper">
        <div className="flex items-center justify-between font-mono text-[0.625rem] uppercase tracking-[0.28em] text-ink-400">
          <span>Est. MMXXVI</span>
          <Link
            href="/settings"
            className="transition-colors hover:text-paper"
            aria-label="Settings"
          >
            <Settings2 className="size-4" />
          </Link>
        </div>

        <div className="rule-double mt-3 text-paper/80" aria-hidden />

        <h1 className="mt-4 font-display text-[5.5rem] leading-[0.82] tracking-[0.02em] text-paper">
          Pitik
        </h1>

        <p className="mt-2 font-mono text-[0.6875rem] uppercase leading-relaxed tracking-[0.24em] text-safelight-400">
          Made for moments together
        </p>

        <div className="rule-double mt-4 rotate-180 text-paper/80" aria-hidden />

        {/* The spec line off the side of a film box. Every value is real. */}
        <p className="mt-3 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-ink-500">
          Digital compact · 11 bodies · Booth · Develops on device
        </p>
      </header>

      {/* --------------------------------------------------------- ticket */}
      <section className="mt-7">
        <button
          type="button"
          onClick={() => setNewRollOpen(true)}
          className="paper-grain halftone group relative block w-full overflow-hidden bg-paper text-left text-ink-900 shadow-[0_10px_0_-4px_rgba(0,0,0,0.45)] transition-transform active:translate-y-[2px]"
        >
          <span className="relative z-[2] block px-5 pb-5 pt-4">
            <span className="flex items-baseline justify-between font-mono text-[0.5625rem] uppercase tracking-[0.24em] text-ink-500">
              <span>No. 001</span>
              <span>Admit one</span>
            </span>

            <span className="mt-2 block font-display text-[3.25rem] leading-[0.86] tracking-[0.01em]">
              Start a roll
            </span>

            <span className="mt-3 flex items-center gap-3 border-t border-dashed border-ink-900/30 pt-3 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-ink-500">
              Name it · Shoot it · Keep it
            </span>
          </span>
        </button>
      </section>

      {/* ---------------------------------------------------- two panels */}
      <nav className="mt-4 grid grid-cols-2 gap-3" aria-label="Start shooting">
        <StampedPanel href="/camera" icon={Camera} label="Camera" note="Pick a body" />
        <StampedPanel href="/booth" icon={LayoutGrid} label="Booth" note="Four shots" />
      </nav>

      {/* -------------------------------------------------- contact strip */}
      {recent.length ? (
        <Section label="Latest frames" action={{ href: "/rolls?tab=camera", label: "All" }}>
          <div className="film-edge relative -mx-5 bg-ink-900 px-5 py-3">
            <div className="flex gap-[3px] overflow-x-auto py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {recent.map((capture, index) => (
                <ContactFrame key={capture.id} capture={capture} index={index} />
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      {/* --------------------------------------------------------- rolls */}
      {loading ? (
        <div className="mt-10 grid grid-cols-2 gap-3" aria-hidden>
          {[0, 1].map((index) => (
            <div key={index} className="h-52 animate-pulse bg-ink-900" />
          ))}
        </div>
      ) : activeRoll ? (
        <Section label="Still shooting">
          <div className="grid grid-cols-2 gap-3">
            <RollCard
              roll={activeRoll}
              count={counts[activeRoll.id] ?? 0}
              cover={covers[activeRoll.id]}
            />
          </div>
        </Section>
      ) : rolls.length === 0 && recent.length === 0 ? (
        <EmptyState onStart={() => setNewRollOpen(true)} />
      ) : null}

      <footer className="mt-12 text-center">
        <div className="rule-double text-ink-800" aria-hidden />
        <p className="mt-3 font-mono text-[0.5625rem] uppercase tracking-[0.28em] text-ink-600">
          Keep away from heat · Process before expiry
        </p>
      </footer>

      <NewRollSheet open={newRollOpen} onOpenChange={setNewRollOpen} />
    </div>
  );
}

/**
 * A stamped panel, as on the end flap of a carton.
 *
 * Square corners, a printed keyline, and caps — deliberately not the rounded
 * card with a coloured icon that every app ships.
 */
function StampedPanel({
  href,
  icon: Icon,
  label,
  note,
}: {
  href: string;
  icon: typeof Camera;
  label: string;
  note: string;
}) {
  return (
    <Link
      href={href}
      className="halftone group relative flex flex-col justify-between border-2 border-ink-700 px-4 py-4 text-paper transition-colors hover:border-safelight-500 hover:text-safelight-400"
    >
      <Icon className="size-5" aria-hidden strokeWidth={1.5} />
      <span className="mt-6 block">
        <span className="block font-display text-2xl leading-none tracking-wide">{label}</span>
        <span className="mt-1 block font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-ink-400">
          {note}
        </span>
      </span>
    </Link>
  );
}

/** One frame on the contact strip, numbered the way a proof sheet is. */
function ContactFrame({ capture, index }: { capture: Capture; index: number }) {
  const url = useObjectUrl(capture.thumb);
  return (
    <Link
      href={`/rolls/${capture.rollId}`}
      className="relative size-[4.5rem] shrink-0 overflow-hidden bg-ink-950"
      aria-label={`Frame from ${relativeDay(capture.createdAt)}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : null}
      <span
        aria-hidden
        className="absolute left-1 top-0.5 font-mono text-[0.5rem] text-amber-warm mix-blend-difference"
      >
        {String(index + 1).padStart(2, "0")}
      </span>
    </Link>
  );
}

function Section({
  label,
  action,
  children,
}: {
  label: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-mono text-[0.625rem] uppercase tracking-[0.28em] text-ink-400">
          {label}
        </h2>
        <span className="h-px flex-1 bg-ink-800" aria-hidden />
        {action ? (
          <Link
            href={action.href}
            className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-ink-400 transition-colors hover:text-paper"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * The first thing most people will ever see here, so it carries the promise
 * rather than apologising for having no data.
 */
function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <section className="mt-10 border-2 border-dashed border-ink-700 px-6 py-9 text-center">
      <p className="stamp mx-auto inline-block px-2 py-1 font-mono text-[0.5625rem] uppercase text-safelight-400">
        Unexposed
      </p>
      <p className="mt-4 font-display text-3xl leading-tight text-paper">
        Nothing here yet — which
        <br />
        is the best time to start
      </p>
      <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-ink-400">
        A roll is one evening, one trip, one ordinary afternoon. Name it, and every
        photo you take lands in the same place.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-5 font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-safelight-400 underline underline-offset-4"
      >
        Load your first roll
      </button>
    </section>
  );
}
