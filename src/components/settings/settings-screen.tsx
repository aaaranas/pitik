"use client";

import { ChevronLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountPanel } from "./account-panel";
import { Button } from "@/components/ui/button";
import { Modal, SheetRoot } from "@/components/ui/sheet";
import { useToast } from "@/components/providers/toast-provider";
import { useSettings } from "@/hooks/use-store";
import { eraseAllData, storageReport, type StorageReport } from "@/lib/db/repo";
import type { Settings } from "@/lib/db/types";
import { formatBytes, formatCount } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { PitikMark } from "@/components/shell/wordmark";

/**
 * Settings, and the privacy statement that justifies them.
 *
 * Everything here is a real, wired switch — there is no toggle that does
 * nothing. The privacy section is written as a claim the code has to keep, and
 * "erase everything" genuinely erases everything.
 */
export function SettingsScreen() {
  const { settings, update } = useSettings();
  const { toast } = useToast();
  const [report, setReport] = useState<StorageReport | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);

  useEffect(() => {
    void storageReport().then(setReport).catch(() => undefined);
  }, []);

  return (
    <div
      className="mx-auto w-full max-w-xl px-4 pb-12"
      style={{ paddingTop: "calc(var(--safe-top) + 0.5rem)" }}
    >
      <header className="flex items-center gap-1 pb-4">
        <Link
          href="/"
          className="grid size-10 place-items-center rounded-full text-ink-200 transition hover:bg-ink-800"
          aria-label="Back"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-display text-2xl text-paper">Settings</h1>
      </header>

      <AccountPanel />

      <Group title="Camera">
        <Toggle
          settings={settings}
          field="shutterSound"
          label="Shutter sound"
          hint="A synthesised leaf-shutter click. Nothing is recorded."
          onChange={update}
        />
        <Toggle
          settings={settings}
          field="haptics"
          label="Haptics"
          hint="A short buzz on capture and on each countdown tick."
          onChange={update}
        />
        <Toggle
          settings={settings}
          field="mirrorSelfie"
          label="Mirror selfies"
          hint="Save front-camera photos the way you saw them in the preview."
          onChange={update}
        />
        <Toggle
          settings={settings}
          field="dateStamp"
          label="Date stamp"
          hint="Burns the date into the corner of each photo, the way a camera back did."
          onChange={update}
        />
        <Toggle
          settings={settings}
          field="gridOverlay"
          label="Composition grid"
          hint="Thirds guides over the viewfinder."
          onChange={update}
        />
        <Toggle
          settings={settings}
          field="livePreview"
          label="Live filter preview"
          hint="Turn off on older phones for a smoother viewfinder. Photos are still graded."
          onChange={update}
        />
      </Group>

      <Group title="On this device">
        <div className="px-4 py-3.5">
          <p className="text-sm text-ink-100">Storage</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            {report
              ? `${formatCount(report.rolls, "roll")}, ${formatCount(report.captures, "photo")}, ${formatCount(report.strips, "strip")} — about ${formatBytes(report.usage)}${
                  report.quota ? ` of ${formatBytes(report.quota)} available` : ""
                }.`
              : "Measuring…"}
          </p>
        </div>
        <div className="px-4 py-3.5">
          <Button variant="danger" className="w-full" onClick={() => setConfirmErase(true)}>
            Erase everything on this device
          </Button>
        </div>
      </Group>

      <section className="mt-8 rounded-2xl border border-ink-800 p-5">
        <ShieldCheck className="size-5 text-signal-ok" aria-hidden />
        <h2 className="mt-3 font-display text-xl text-ink-100">Where your photos go</h2>
        <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-300">
          <li>
            Photos are written to this device&rsquo;s storage the moment you take them, and
            they stay there.
          </li>
          <li>
            Nothing is uploaded unless you turn on sync and sign in. There is no
            background upload and no &ldquo;anonymous&rdquo; telemetry.
          </li>
          <li>
            No analytics, no trackers, no third-party scripts. The QR codes and
            filters are generated on your device.
          </li>
          <li>
            Nothing is sent to an AI service. Every filter is arithmetic running in
            your browser.
          </li>
          <li>Sharing a photo hands it to the app you pick — Pitik never sees it.</li>
        </ul>
      </section>

      <footer className="mt-10 flex items-center justify-center gap-2 text-ink-600">
        <PitikMark className="size-4" />
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.2em]">
          Made for moments together
        </span>
      </footer>

      <SheetRoot open={confirmErase} onOpenChange={setConfirmErase}>
        <Modal
          title="Erase everything?"
          description="Every roll, photo, and strip on this device will be deleted permanently. Anything you've already shared or saved elsewhere is unaffected."
          footer={
            <>
              <Button variant="outline" className="flex-1" onClick={() => setConfirmErase(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={async () => {
                  await eraseAllData();
                  setConfirmErase(false);
                  setReport(await storageReport());
                  toast("Everything has been erased.", { tone: "success" });
                }}
              >
                Erase
              </Button>
            </>
          }
        />
      </SheetRoot>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 px-1 text-[0.6875rem] uppercase tracking-[0.18em] text-ink-400">
        {title}
      </h2>
      <div className="divide-y divide-ink-850 overflow-hidden rounded-xl border border-ink-850 bg-ink-900">
        {children}
      </div>
    </section>
  );
}

/**
 * Keys of `Settings` whose value is a boolean.
 *
 * `-?` strips optionality before the check: without it, optional keys make the
 * mapped type optional too and `undefined` leaks into the union.
 */
type BooleanSetting = {
  [K in keyof Settings]-?: Settings[K] extends boolean ? K : never;
}[keyof Settings];

function Toggle({
  settings,
  field,
  label,
  hint,
  onChange,
}: {
  settings: Settings | null;
  field: BooleanSetting;
  label: string;
  hint: string;
  onChange: (patch: Partial<Settings>) => Promise<void>;
}) {
  const checked = settings ? Boolean(settings[field]) : false;
  return (
    <label className="flex cursor-pointer items-center gap-4 px-4 py-3.5">
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink-100">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-400">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={!settings}
        onClick={() => void onChange({ [field]: !checked } as Partial<Settings>)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-safelight-500" : "bg-ink-700",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-paper transition-transform",
            checked ? "translate-x-[1.375rem]" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}
