"use client";

import { Camera, LayoutGrid, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { NewRollSheet } from "@/components/roll/new-roll-sheet";
import { RollCard } from "@/components/roll/roll-card";
import { Wordmark } from "@/components/shell/wordmark";
import { useSession } from "@/components/providers/session-provider";
import { useObjectUrl } from "@/hooks/use-object-url";
import { useRecentCaptures, useRollCounts, useRollCovers, useRolls } from "@/hooks/use-store";
import type { Capture } from "@/lib/db/types";
import { relativeDay } from "@/lib/utils";

/**
 * Home.
 *
 * Structured around one decision — start something — with everything you might
 * come back to arranged underneath in the order you'd reach for it. There are
 * no statistics on this screen and there never should be: nobody opens a camera
 * to review their usage.
 */
export function HomeScreen() {
  const [newRollOpen, setNewRollOpen] = useState(false);
  const { data: rolls, loading } = useRolls();
  const counts = useRollCounts(rolls);
  const covers = useRollCovers(rolls);
  const { data: recent } = useRecentCaptures(14);
  const { activeRollId } = useSession();

  const active = rolls.filter((roll) => roll.id === activeRollId);
  const others = rolls.filter((roll) => roll.id !== activeRollId);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10" style={{ paddingTop: "calc(var(--safe-top) + 1rem)" }}>
      <header className="flex items-center justify-between">
        <Wordmark />
        <Link
          href="/settings"
          className="grid size-10 place-items-center rounded-full text-ink-300 transition hover:bg-ink-800 hover:text-ink-100"
          aria-label="Settings"
        >
          <Settings2 className="size-5" />
        </Link>
      </header>

      {/* ------------------------------------------------------------ hero */}
      <section className="mt-8">
        <h1 className="font-display text-[2.75rem] leading-[1.05] text-paper">
          Made for moments
          <br />
          together.
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-300">
          Give tonight its own camera roll. Shoot it, print it, keep it — all on
          this device.
        </p>

        <button
          type="button"
          onClick={() => setNewRollOpen(true)}
          className="paper-grain group mt-6 flex w-full items-center justify-between rounded-2xl bg-paper px-5 py-5 text-left text-ink-900 shadow-xl shadow-black/40 transition-transform active:scale-[0.99]"
        >
          <span className="relative z-[2]">
            <span className="block font-display text-2xl leading-none">Start a Roll</span>
            <span className="mt-1.5 block font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-500">
              Name it · Shoot it · Keep it
            </span>
          </span>
          <span
            aria-hidden
            className="relative z-[2] grid size-11 shrink-0 place-items-center rounded-full bg-safelight-500 text-white transition-transform group-hover:scale-105"
          >
            <Camera className="size-5" />
          </span>
        </button>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <QuickAction href="/camera" icon={Camera} label="Camera" hint="Shoot straight away" />
          <QuickAction href="/booth" icon={LayoutGrid} label="Photobooth" hint="Four shots, one strip" />
        </div>
      </section>

      {/* -------------------------------------------- continue / recent */}
      {loading ? (
        <SkeletonRolls />
      ) : rolls.length === 0 ? (
        <EmptyState onStart={() => setNewRollOpen(true)} />
      ) : (
        <>
          {active.length ? (
            <Section title="Continue shooting">
              <div className="grid grid-cols-2 gap-3">
                {active.map((roll) => (
                  <RollCard
                    key={roll.id}
                    roll={roll}
                    count={counts[roll.id] ?? 0}
                    cover={covers[roll.id]}
                  />
                ))}
              </div>
            </Section>
          ) : null}

          {recent.length ? (
            <Section title="Latest frames" action={{ href: "/rolls", label: "All rolls" }}>
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {recent.map((capture) => (
                  <RecentFrame key={capture.id} capture={capture} />
                ))}
              </div>
            </Section>
          ) : null}

          {others.length ? (
            <Section title={active.length ? "Earlier rolls" : "Your rolls"}>
              <div className="grid grid-cols-2 gap-3">
                {others.map((roll) => (
                  <RollCard
                    key={roll.id}
                    roll={roll}
                    count={counts[roll.id] ?? 0}
                    cover={covers[roll.id]}
                  />
                ))}
              </div>
            </Section>
          ) : null}
        </>
      )}

      <NewRollSheet open={newRollOpen} onOpenChange={setNewRollOpen} />
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: typeof Camera;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="hairline flex flex-col gap-3 rounded-xl bg-ink-900 p-4 transition-colors hover:bg-ink-850"
    >
      <Icon className="size-5 text-safelight-400" aria-hidden />
      <span>
        <span className="block text-sm font-medium text-ink-100">{label}</span>
        <span className="mt-0.5 block text-xs text-ink-400">{hint}</span>
      </span>
    </Link>
  );
}

function RecentFrame({ capture }: { capture: Capture }) {
  const url = useObjectUrl(capture.thumb);
  return (
    <Link
      href={`/rolls/${capture.rollId}`}
      className="relative size-24 shrink-0 overflow-hidden rounded-md bg-ink-900"
      aria-label={`Photo from ${relativeDay(capture.createdAt)}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : null}
    </Link>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-400">{title}</h2>
        {action ? (
          <Link href={action.href} className="text-xs text-ink-300 underline-offset-4 hover:underline">
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function SkeletonRolls() {
  return (
    <div className="mt-9 grid grid-cols-2 gap-3" aria-hidden>
      {[0, 1].map((index) => (
        <div key={index} className="h-52 animate-pulse rounded-lg bg-ink-900" />
      ))}
    </div>
  );
}

/**
 * The empty state is the first thing most people will ever see here, so it
 * carries the product's promise rather than apologising for having no data.
 */
function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <section className="mt-12 rounded-2xl border border-dashed border-ink-700 px-6 py-10 text-center">
      <p className="font-display text-2xl leading-snug text-ink-100">
        Nothing here yet — which is
        <br />
        the best time to start.
      </p>
      <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-ink-400">
        A roll is one evening, one trip, one ordinary afternoon. Name it, and every
        photo you take lands in the same place.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-6 text-sm text-safelight-400 underline underline-offset-4"
      >
        Start your first roll
      </button>
    </section>
  );
}
