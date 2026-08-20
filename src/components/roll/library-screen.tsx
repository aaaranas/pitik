"use client";

import { Camera, Heart, LayoutGrid, Images } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { CaptureViewer } from "./capture-viewer";
import { ContactSheet } from "./contact-sheet";
import { NewRollSheet } from "./new-roll-sheet";
import { RollCard } from "./roll-card";
import { StripGrid } from "./strip-grid";
import { Button } from "@/components/ui/button";
import { useObjectUrl } from "@/hooks/use-object-url";
import {
  useCaptures,
  useFavorites,
  useLibraryId,
  useRollCounts,
  useRollCovers,
  useRolls,
  useStrips,
} from "@/hooks/use-store";
import type { Capture } from "@/lib/db/types";
import { formatCount } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Everything you've shot, in three places.
 *
 * Camera photos and booth strips each have a standing home, because most
 * shooting is not part of a named session and filing it under an invented
 * "Thursday night" was a lie about what the user did. Rolls stay exactly as
 * they were: moments somebody deliberately started.
 */

type Tab = "camera" | "booth" | "rolls";

const TABS: { id: Tab; label: string; icon: typeof Camera }[] = [
  { id: "camera", label: "Camera", icon: Camera },
  { id: "booth", label: "Booth", icon: LayoutGrid },
  { id: "rolls", label: "Rolls", icon: Images },
];

function isTab(value: string | null): value is Tab {
  return value === "camera" || value === "booth" || value === "rolls";
}

export function LibraryScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("tab");

  // The tab lives in the URL so that saving a strip can land you on the booth
  // shelf, and so a back button behaves the way people expect.
  // Derived from the URL rather than mirrored into state: a second source of
  // truth here would fight the back button.
  const tab: Tab = isTab(requested) ? requested : "camera";

  const selectTab = useCallback(
    (next: Tab) => router.replace(`/rolls?tab=${next}`, { scroll: false }),
    [router],
  );

  const [newRollOpen, setNewRollOpen] = useState(false);

  return (
    <div
      className="mx-auto w-full max-w-3xl pb-10"
      style={{ paddingTop: "calc(var(--safe-top) + 1.5rem)" }}
    >
      <header className="flex items-end justify-between gap-4 px-4">
        <h1 className="font-display text-4xl leading-none text-paper">Your photos</h1>
        {tab === "rolls" ? (
          <Button variant="subtle" onClick={() => setNewRollOpen(true)}>
            New roll
          </Button>
        ) : null}
      </header>

      <div role="tablist" aria-label="Library" className="mt-5 flex gap-1 border-b border-ink-850 px-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => selectTab(id)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
              tab === id
                ? "border-safelight-500 text-ink-100"
                : "border-transparent text-ink-400 hover:text-ink-200",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === "camera" ? <CameraTab /> : null}
      {tab === "booth" ? <BoothTab /> : null}
      {tab === "rolls" ? <RollsTab onNewRoll={() => setNewRollOpen(true)} /> : null}

      <NewRollSheet open={newRollOpen} onOpenChange={setNewRollOpen} destination="camera" />
    </div>
  );
}

// ------------------------------------------------------------------- camera

function CameraTab() {
  const libraryId = useLibraryId("camera");
  const { data: captures, loading } = useCaptures(libraryId ?? undefined);
  const { data: favorites } = useFavorites();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (loading && !captures.length) {
    return <div className="mt-6 h-64 animate-pulse bg-ink-900/40" aria-hidden />;
  }

  if (!captures.length) {
    return (
      <Empty
        title="No photos yet."
        body="Everything you shoot in Camera Mode lands here, without you having to name anything first."
        action={{ href: "/camera", label: "Open the camera" }}
      />
    );
  }

  return (
    <>
      {favorites.length ? (
        <section className="mt-6 px-4">
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

      <p className="mt-6 px-4 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-400">
        {formatCount(captures.length, "photo")}
      </p>
      <ContactSheet
        captures={captures}
        onOpen={setViewerIndex}
        className="mt-3 border-t border-ink-850 pt-px"
      />

      <CaptureViewer
        captures={captures}
        index={viewerIndex}
        rollTitle="Camera"
        onClose={() => setViewerIndex(null)}
        onIndexChange={setViewerIndex}
      />
    </>
  );
}

function FavoriteFrame({ capture }: { capture: Capture }) {
  const url = useObjectUrl(capture.thumb);
  return (
    <span className="size-20 shrink-0 overflow-hidden rounded-md bg-ink-900">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : null}
    </span>
  );
}

// -------------------------------------------------------------------- booth

function BoothTab() {
  const libraryId = useLibraryId("booth");
  const { data: strips, loading } = useStrips(libraryId ?? undefined);

  if (loading && !strips.length) {
    return <div className="mt-6 h-64 animate-pulse bg-ink-900/40" aria-hidden />;
  }

  if (!strips.length) {
    return (
      <Empty
        title="No strips yet."
        body="Run a booth and the strip lands here, with the clip of the shoot beside it."
        action={{ href: "/booth", label: "Choose a booth" }}
      />
    );
  }

  return (
    <>
      <p className="mt-6 px-4 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink-400">
        {formatCount(strips.length, "strip")}
      </p>
      <StripGrid strips={strips} title="Photobooth" className="mt-3 px-4" />
    </>
  );
}

// -------------------------------------------------------------------- rolls

function RollsTab({ onNewRoll }: { onNewRoll: () => void }) {
  const { data: rolls, loading } = useRolls();
  const counts = useRollCounts(rolls);
  const covers = useRollCovers(rolls);

  if (loading) {
    return (
      <div className="mt-6 grid grid-cols-2 gap-3 px-4" aria-hidden>
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-52 animate-pulse rounded-lg bg-ink-900" />
        ))}
      </div>
    );
  }

  if (!rolls.length) {
    return (
      <div className="mt-12 px-6 text-center">
        <p className="font-display text-2xl text-ink-100">No rolls yet.</p>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-400">
          A roll is for one evening you want kept together. Start one and every photo
          you take goes into it instead of the camera shelf.
        </p>
        <Button variant="primary" className="mt-6" onClick={onNewRoll}>
          Start a roll
        </Button>
      </div>
    );
  }

  return (
    <section className="mt-6 grid grid-cols-2 gap-3 px-4 sm:grid-cols-3">
      {rolls.map((roll) => (
        <RollCard
          key={roll.id}
          roll={roll}
          count={counts[roll.id] ?? 0}
          cover={covers[roll.id]}
        />
      ))}
    </section>
  );
}

// -------------------------------------------------------------------- shared

function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: { href: string; label: string };
}) {
  return (
    <div className="mt-12 px-6 text-center">
      <p className="font-display text-2xl text-ink-100">{title}</p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-400">{body}</p>
      <Link
        href={action.href}
        className="mt-6 inline-flex h-11 items-center rounded-xl bg-paper px-5 text-sm font-medium text-ink-900"
      >
        {action.label}
      </Link>
    </div>
  );
}
