import Link from "next/link";
import { PitikMark } from "@/components/shell/wordmark";

export default function NotFound() {
  return (
    <div className="grid min-h-full place-items-center bg-cream-50 px-6 text-center">
      <div className="max-w-xs">
        <PitikMark className="mx-auto size-8 text-cocoa-900" />
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-[-0.04em] text-cocoa-900">Nothing here</h1>
        <p className="mt-3 text-sm leading-relaxed text-cocoa-600">
          This frame came back blank. It happens.
        </p>
        <Link
          href="/"
          className="squish mt-7 inline-flex h-14 w-full items-center justify-center gap-2 whitespace-nowrap rounded-slab border-2 border-cocoa-900 bg-cocoa-900 px-7 font-display text-base font-semibold tracking-[-0.01em] text-cream-50 shadow-[4px_4px_0_var(--color-sky-base)] hover:bg-cocoa-800"
        >
          Back to your rolls
        </Link>
      </div>
    </div>
  );
}
