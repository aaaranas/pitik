"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { NewRollSheet } from "./new-roll-sheet";
import { RollCard } from "./roll-card";
import { Button } from "@/components/ui/button";
import { useObjectUrl } from "@/hooks/use-object-url";
import { useFavorites, useRollCounts, useRollCovers, useRolls } from "@/hooks/use-store";
import type { Capture } from "@/lib/db/types";
import { formatCount } from "@/lib/utils";

/**
 * Every roll on this device, newest activity first.
 *
 * Favourites get their own row at the top rather than a separate screen — they
 * are the handful of photos you'd actually show someone, and burying them one
 * tap deeper is how they stop being looked at.
 */
export function RollsScreen() {
  const { data: rolls, loading } = useRolls();
  const counts = useRollCounts(rolls);
  const covers = useRollCovers(rolls);
  const { data: favorites } = useFavorites();
  const [newRollOpen, setNewRollOpen] = useState(false);

  return (
    <div
      className="mx-auto w-full max-w-2xl px-4 pb-10"
      style={{ paddingTop: "calc(var(--safe-top) + 1.5rem)" }}
    >
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-none text-paper">Your rolls</h1>
          <p className="mt-2 text-sm text-ink-400">
            {loading ? " " : formatCount(rolls.length, "roll")} on this device
          </p>
        </div>
        <Button variant="subtle" onClick={() => setNewRollOpen(true)}>
          New roll
        </Button>
      </header>

      {favorites.length ? (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-1.5 text-[0.6875rem] uppercase tracking-[0.18em] text-ink-400">
            <Heart className="size-3 fill-safelight-500 text-safelight-500" aria-hidden />
            Favourites
          </h2>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {favorites.map((capture) => (
              <FavoriteFrame key={capture.id} capture={capture} />
            ))}
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="mt-8 grid grid-cols-2 gap-3" aria-hidden>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-52 animate-pulse rounded-lg bg-ink-900" />
          ))}
        </div>
      ) : rolls.length === 0 ? (
        <section className="mt-14 text-center">
          <p className="font-display text-2xl text-ink-100">No rolls yet.</p>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-400">
            Every photo you take belongs to one. Start one for whatever is happening
            right now.
          </p>
          <Button variant="primary" className="mt-6" onClick={() => setNewRollOpen(true)}>
            Start a roll
          </Button>
        </section>
      ) : (
        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rolls.map((roll) => (
            <RollCard
              key={roll.id}
              roll={roll}
              count={counts[roll.id] ?? 0}
              cover={covers[roll.id]}
            />
          ))}
        </section>
      )}

      <NewRollSheet open={newRollOpen} onOpenChange={setNewRollOpen} destination="camera" />
    </div>
  );
}

function FavoriteFrame({ capture }: { capture: Capture }) {
  const url = useObjectUrl(capture.thumb);
  return (
    <Link
      href={`/rolls/${capture.rollId}`}
      className="size-20 shrink-0 overflow-hidden rounded-md bg-ink-900"
      aria-label="Open the roll this favourite belongs to"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : null}
    </Link>
  );
}
