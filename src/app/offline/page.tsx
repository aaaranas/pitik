import type { Metadata } from "next";
import Link from "next/link";
import { PitikMark } from "@/components/shell/wordmark";

export const metadata: Metadata = {
  title: "Offline",
};

/**
 * Served by the service worker when a page is requested with no connection.
 *
 * Written to be reassuring rather than apologetic: the camera genuinely does
 * work from here, so the page's job is to point at it.
 */
export default function Page() {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="max-w-xs">
        <PitikMark className="mx-auto size-8 text-paper" />
        <h1 className="mt-5 font-display text-3xl text-paper">You&rsquo;re offline</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">
          That page hasn&rsquo;t been saved to this device yet. The camera, the booth, and
          every roll you&rsquo;ve already shot still work.
        </p>
        <div className="mt-7 flex flex-col gap-2">
          <Link
            href="/camera"
            className="flex h-12 items-center justify-center rounded-xl bg-paper text-sm font-medium text-ink-900"
          >
            Open the camera
          </Link>
          <Link
            href="/"
            className="flex h-12 items-center justify-center rounded-xl border border-ink-700 text-sm text-ink-100"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
