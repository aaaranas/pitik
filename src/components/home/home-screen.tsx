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
import { cn, relativeDay } from "@/lib/utils";

/**
 * Home.
 *
 * The masthead reads like a film box: a "Rec ●" stamp and an exposure count
 * sit either side of a tight-tracked "Pitik" wordmark under a 3px ink rule.
 * Below it, the one decision that matters — start a roll — is a solid ink
 * block, not a soft card, so it's the first thing the eye lands on. Camera
 * and Booth are numbered slabs; recent photographs are taped, overlapping
 * polaroids rather than a scroller of rounded thumbnails.
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
          <span className="blk">Rec ●</span>
          <div className="flex items-center gap-3">
            <span className="counter">36 EXP · MMXXVI</span>
            <Link
              href="/settings"
              className="rounded-slab border-2 border-cocoa-900 p-1.5 text-cocoa-900 transition hover:bg-cream-200"
              aria-label="Settings"
            >
              <Settings2 className="size-4" />
            </Link>
          </div>
        </div>

        <h1 className="mt-4 flex items-start gap-1 font-display text-[3.75rem] font-extrabold leading-[0.86] tracking-[-0.05em] text-cocoa-900">
          Pitik
          <span className="counter mt-2 !text-[0.5rem]">©</span>
        </h1>

        <div className="rule-ink mt-2" aria-hidden />

        <p className="counter mt-2 !text-[0.625rem]">Made for moments together</p>
      </header>

      {/* --------------------------------------------------------- ticket */}
      <button
        type="button"
        onClick={() => setNewRollOpen(true)}
        className="squish relative mt-5 block w-full border-2 border-cocoa-900 bg-cocoa-900 px-5 pb-5 pt-4 text-left shadow-[6px_6px_0_var(--color-sky-base)]"
      >
        <span className="sticker absolute -right-2 -top-3">New!</span>

        <span className="block font-display text-[2.25rem] font-extrabold uppercase leading-[0.9] tracking-[-0.04em] text-cream-50">
          Start
          <br />
          a roll
        </span>

        <span className="counter mt-3 block !text-sky-base">
          Name it · Shoot it · Keep it
        </span>
      </button>

      {/* ---------------------------------------------------- two panels */}
      <nav className="mt-5 grid grid-cols-2 gap-3" aria-label="Start shooting">
        <StampedPanel href="/camera" icon={Camera} index="01" label="Camera" note="Pick a body" />
        <StampedPanel href="/booth" icon={LayoutGrid} index="02" label="Booth" note="Four shots" />
      </nav>

      {/* -------------------------------------------------- contact strip */}
      {recent.length ? (
        <Section label="Latest frames" action={{ href: "/rolls?tab=camera", label: "All" }}>
          <div className="-mx-5 flex items-start gap-0 overflow-x-auto px-5 pb-3 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {recent.map((capture, index) => (
              <div
                key={capture.id}
                className={cn(
                  "polaroid shrink-0",
                  index > 0 && "-ml-3",
                  index % 3 === 1 && "rotate-[-4deg]",
                  index % 3 === 2 && "rotate-[3deg]",
                  index === 0 && "tape",
                )}
              >
                <ContactFrame capture={capture} index={index} />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* --------------------------------------------------------- rolls */}
      {loading ? (
        <div className="mt-10 grid grid-cols-2 gap-3" aria-hidden>
          {[0, 1].map((index) => (
            <div key={index} className="slab h-52 animate-pulse" />
          ))}
        </div>
      ) : activeRoll ? (
        <Section label="Still shooting">
          <div className="slab p-3">
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
        <p className="counter">Keep away from heat · Process before expiry</p>
      </footer>

      <NewRollSheet open={newRollOpen} onOpenChange={setNewRollOpen} />
    </div>
  );
}

/**
 * A quick-start panel for the two ways to begin shooting.
 *
 * An ink-bordered slab carrying its own ordinal, sized to sit two across
 * under the masthead.
 */
function StampedPanel({
  href,
  icon: Icon,
  index,
  label,
  note,
}: {
  href: string;
  icon: typeof Camera;
  index: string;
  label: string;
  note: string;
}) {
  return (
    <Link href={href} className="slab slab-butter squish block p-3 text-cocoa-900">
      <div className="flex items-start justify-between">
        <span className="counter">{index}</span>
        <Icon className="size-4 text-cocoa-600" aria-hidden strokeWidth={1.75} />
      </div>
      <span className="mt-4 block font-display text-lg font-extrabold tracking-[-0.03em] text-cocoa-900">
        {label}
      </span>
      <span className="mt-0.5 block font-sans text-xs text-cocoa-600">{note}</span>
    </Link>
  );
}

/**
 * One frame on the contact strip. The polaroid mount, its tilt and its tape
 * are the wrapping element's job in `HomeScreen` — this is just the photo
 * and the chin numeral under it, numbered the way a proof sheet is.
 */
function ContactFrame({ capture, index }: { capture: Capture; index: number }) {
  const url = useObjectUrl(capture.thumb);
  return (
    <Link
      href={`/rolls/${capture.rollId}`}
      className="block"
      aria-label={`Frame from ${relativeDay(capture.createdAt)}`}
    >
      <span className="block size-20 overflow-hidden bg-cream-200">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : null}
      </span>
      <span aria-hidden className="counter mt-1 block text-center">
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
      <div className="mb-2.5 flex items-center gap-3">
        <h2 className="blk">{label}</h2>
        <span className="rule-dot flex-1" aria-hidden />
        {action ? (
          <Link href={action.href} className="counter transition-colors hover:text-cocoa-900">
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
    <section className="slab mt-10 px-6 py-9 text-center">
      <span className="chip tint-lilac">Unexposed</span>
      <p className="mt-4 font-display text-3xl leading-tight tracking-[-0.04em] text-cocoa-900">
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
