import Link from "next/link";
import { PitikMark } from "@/components/shell/wordmark";

export default function NotFound() {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="max-w-xs">
        <PitikMark className="mx-auto size-8 text-paper" />
        <h1 className="mt-5 font-display text-3xl text-paper">Nothing here</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">
          This frame came back blank. It happens.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex h-12 items-center justify-center rounded-xl bg-paper px-6 text-sm font-medium text-ink-900"
        >
          Back to your rolls
        </Link>
      </div>
    </div>
  );
}
