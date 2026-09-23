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
    <div className="grid min-h-full place-items-center bg-cream-50 px-6 text-center">
      <div className="max-w-xs">
        <PitikMark className="mx-auto size-8 text-cocoa-900" />
        <h1 className="mt-5 font-display text-3xl tracking-[-0.04em] text-cocoa-900">
          You&rsquo;re offline
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-cocoa-600">
          That page hasn&rsquo;t been saved to this device yet. The camera, the booth, and
          every roll you&rsquo;ve already shot still work.
        </p>
        <div className="mt-7 flex flex-col gap-2">
          <Link
            href="/camera"
            className="squish inline-flex h-14 items-center justify-center gap-2 whitespace-nowrap rounded-slab border-2 border-cocoa-900 bg-cocoa-900 px-7 font-display text-base font-semibold tracking-[-0.01em] text-cream-50 shadow-[4px_4px_0_var(--color-sky-base)] hover:bg-cocoa-800"
          >
            Open the camera
          </Link>
          <Link
            href="/"
            className="squish inline-flex h-14 items-center justify-center gap-2 whitespace-nowrap rounded-slab border-2 border-cocoa-900 bg-transparent px-7 font-display text-base font-semibold tracking-[-0.01em] text-cocoa-900 hover:bg-cream-100"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
