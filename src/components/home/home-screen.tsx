"use client";

import { Camera, LayoutGrid, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { NewRollSheet } from "@/components/roll/new-roll-sheet";
import { RollCard } from "@/components/roll/roll-card";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/providers/session-provider";
import { useObjectUrl } from "@/hooks/use-object-url";
import { useRecentCaptures, useRollCounts, useRollCovers, useRolls } from "@/hooks/use-store";
import type { Capture } from "@/lib/db/types";
import { relativeDay } from "@/lib/utils";

/**
 * Home.
 *
 * A soft pastel card for the one decision that matters — start a roll — sat
 * above a strip of what was last shot. The masthead is a mixed-case wordmark
 * and a chip, not a film-carton label; the screen grounds itself in cream so
 * it reads as its own object while the rest of the shell is still dark.
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
      className="mx-auto min-h-full w-full max-w-2xl bg-cream-50 px-5 pb-12"
      style={{ paddingTop: "calc(var(--safe-top) + 1.25rem)" }}
    >
      {/* ------------------------------------------------------- masthead */}
      <header className="text-cocoa-900">
        <div className="flex items-center justify-between">
          <span className="chip tint-sky">Made for moments together</span>
          <Link
            href="/settings"
            className="rounded-pill p-2 text-cocoa-600 transition-colors hover:bg-cream-200 hover:text-cocoa-900"
            aria-label="Settings"
          >
            <Settings2 className="size-5" />
          </Link>
        </div>

        <h1 className="mt-5 font-display text-[4rem] font-semibold leading-[0.95] text-cocoa-900">
          Pitik
        </h1>

        <p className="mt-2 font-sans text-sm leading-relaxed text-cocoa-600">
          A camera for the people you&apos;re with. Shoot a roll, print a strip, keep the night.
        </p>
      </header>

      {/* --------------------------------------------------------- ticket */}
      <section className="mt-7">
        <button
          type="button"
          onClick={() => setNewRollOpen(true)}
          className="pillow squish soft-grain group relative block w-full overflow-hidden text-left"
        >
          <span className="relative z-[2] block px-6 pb-6 pt-5">
            <span className="chip tint-butter">New</span>

            <span className="mt-3 block font-display text-[2.5rem] font-semibold leading-tight text-cocoa-900">
              Start a roll
            </span>

            <span className="mt-2 flex items-center gap-2 font-sans text-sm text-cocoa-600">
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
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {recent.map((capture, index) => (
              <ContactFrame key={capture.id} capture={capture} index={index} />
            ))}
          </div>
        </Section>
      ) : null}

      {/* --------------------------------------------------------- rolls */}
      {loading ? (
        <div className="mt-10 grid grid-cols-2 gap-3" aria-hidden>
          {[0, 1].map((index) => (
            <div key={index} className="pillow h-52 animate-pulse" />
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
        <p className="font-sans text-xs text-cocoa-600">
          Keep away from heat · Process before expiry
        </p>
      </footer>

      <NewRollSheet open={newRollOpen} onOpenChange={setNewRollOpen} />
    </div>
  );
}

/**
 * A quick-start panel for the two ways to begin shooting.
 *
 * A soft card with a hairline edge, sized to sit two across under the
 * masthead.
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
      className="squish hairline group relative flex flex-col justify-between rounded-card bg-cream-50 px-4 py-4 text-cocoa-900 transition-colors hover:bg-cream-100"
    >
      <Icon className="size-5 text-cocoa-600" aria-hidden strokeWidth={1.5} />
      <span className="mt-6 block">
        <span className="block font-display text-2xl leading-none text-cocoa-900">{label}</span>
        <span className="mt-1 block font-sans text-xs text-cocoa-600">{note}</span>
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
      className="hairline relative size-[4.5rem] shrink-0 overflow-hidden rounded-slot bg-cream-200"
      aria-label={`Frame from ${relativeDay(capture.createdAt)}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : null}
      <span
        aria-hidden
        className="absolute left-1 top-0.5 font-mono text-[0.5rem] text-butter-deep mix-blend-difference"
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
        <h2 className="font-sans text-xs font-semibold text-cocoa-600">{label}</h2>
        <span className="h-px flex-1 bg-cream-200" aria-hidden />
        {action ? (
          <Link
            href={action.href}
            className="font-sans text-xs font-semibold text-cocoa-600 transition-colors hover:text-cocoa-900"
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
    <section className="mt-10 rounded-card border-2 border-dashed border-cream-300 px-6 py-9 text-center">
      <span className="chip tint-lilac">Unexposed</span>
      <p className="mt-4 font-display text-3xl leading-tight text-cocoa-900">
        Nothing here yet — which
        <br />
        is the best time to start
      </p>
      <p className="mx-auto mt-3 max-w-xs font-sans text-sm leading-relaxed text-cocoa-600">
        A roll is one evening, one trip, one ordinary afternoon. Name it, and every
        photo you take lands in the same place.
      </p>
      <Button type="button" variant="soft" onClick={onStart} className="mt-5">
        Load your first roll
      </Button>
    </section>
  );
}
