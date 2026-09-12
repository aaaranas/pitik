"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Sheet, SheetRoot } from "@/components/ui/sheet";
import { useSession } from "@/components/providers/session-provider";
import { useToast } from "@/components/providers/toast-provider";
import { createRoll } from "@/lib/db/repo";
import { COVER_STYLES, type CoverStyle } from "@/lib/db/types";
import { cn } from "@/lib/utils";

/**
 * Naming a roll.
 *
 * One required field. Everything else has a working default, because the whole
 * promise of this screen is that you can go from "let's take a photo" to a live
 * viewfinder in about four seconds. Anything that makes this form longer is
 * taking time away from the moment it exists to capture.
 */

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give tonight a name.")
    .max(60, "That's a bit long for a roll name."),
  emoji: z.string().max(8).nullable(),
  coverStyle: z.enum(["envelope", "contact", "sleeve", "polaroid"]),
  disposable: z.boolean(),
  shotLimit: z.number().int().min(4).max(72),
});

/** Suggestions, not requirements — a nudge past the blank-field freeze. */
const SUGGESTIONS = ["Dinner with", "Beach day", "Random Tuesday", "Night out", "Us"];
const EMOJI = ["📷", "🌙", "🍜", "🎂", "🏖️", "🍷", "✨", "🎄", "🚗", "💐"];

const COVER_LABELS: Record<CoverStyle, string> = {
  envelope: "Envelope",
  contact: "Contact",
  sleeve: "Sleeve",
  polaroid: "Instant",
};

export function NewRollSheet({
  open,
  onOpenChange,
  /** Where to go once the roll exists. */
  destination = "camera",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination?: "camera" | "roll" | "booth";
}) {
  const router = useRouter();
  const { setActiveRoll } = useSession();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [coverStyle, setCoverStyle] = useState<CoverStyle>("envelope");
  const [disposable, setDisposable] = useState(false);
  const [shotLimit, setShotLimit] = useState(24);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const parsed = schema.safeParse({ title, emoji, coverStyle, disposable, shotLimit });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Something's not right.");
      return;
    }

    setSaving(true);
    try {
      const roll = await createRoll({
        title: parsed.data.title,
        emoji: parsed.data.emoji,
        coverStyle: parsed.data.coverStyle,
        mode: parsed.data.disposable ? "disposable" : "standard",
        shotLimit: parsed.data.disposable ? parsed.data.shotLimit : null,
        developHours: parsed.data.disposable ? 12 : undefined,
      });
      setActiveRoll(roll.id);
      onOpenChange(false);
      setTitle("");
      setEmoji(null);
      router.push(
        destination === "camera"
          ? `/camera?roll=${roll.id}`
          : destination === "booth"
            ? "/booth"
            : `/rolls/${roll.id}`,
      );
    } catch (cause) {
      toast("Couldn't start that roll.", {
        detail: cause instanceof Error ? cause.message : undefined,
        tone: "error",
      });
      setSaving(false);
    }
  };

  return (
    <SheetRoot open={open} onOpenChange={onOpenChange}>
      <Sheet
        title="Name this moment"
        description="You can change it later."
        footer={
          <Button variant="primary" size="lg" className="w-full" onClick={submit} disabled={saving}>
            {saving ? "Starting…" : "Start shooting"}
          </Button>
        }
      >
        <div className="space-y-5">
          <div>
            <label htmlFor="roll-title" className="sr-only">
              Roll name
            </label>
            <input
              id="roll-title"
              value={title}
              autoFocus
              autoComplete="off"
              enterKeyHint="go"
              onChange={(event) => {
                setTitle(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
              placeholder="Dinner with Sam"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "roll-title-error" : undefined}
              className="w-full border-b border-edge-strong bg-transparent pb-2 text-2xl font-semibold tracking-tight text-cocoa-900 placeholder:text-cocoa-600 focus:border-sky-deep focus:outline-none"
            />
            {error ? (
              <p id="roll-title-error" className="mt-2 text-sm text-blush-deep">
                {error}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setTitle(suggestion)}
                  className="rounded-pill border border-edge-strong px-2.5 py-1 text-xs text-cocoa-600 transition hover:text-cocoa-900"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <Field label="Emoji">
            <div className="flex flex-wrap gap-1.5">
              {EMOJI.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  aria-pressed={emoji === choice}
                  onClick={() => setEmoji(emoji === choice ? null : choice)}
                  className={cn(
                    "grid size-10 place-items-center rounded-slot text-lg transition",
                    emoji === choice
                      ? "bg-sky-tint ring-1 ring-sky-base"
                      : "bg-cream-200 hover:bg-cream-300",
                  )}
                >
                  {choice}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Cover">
            <div className="flex gap-1.5">
              {COVER_STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  aria-pressed={coverStyle === style}
                  onClick={() => setCoverStyle(style)}
                  className={cn(
                    "flex-1 rounded-slot px-2 py-2 text-xs transition",
                    coverStyle === style
                      ? "bg-sky-tint text-sky-deep ring-1 ring-sky-base"
                      : "bg-cream-200 text-cocoa-600 hover:bg-cream-300",
                  )}
                >
                  {COVER_LABELS[style]}
                </button>
              ))}
            </div>
          </Field>

          <div className="rounded-card border border-cream-300 p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={disposable}
                onChange={(event) => setDisposable(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-sky-deep)]"
              />
              <span>
                <span className="block text-sm font-medium text-cocoa-900">
                  Make it a disposable
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-cocoa-600">
                  A fixed number of shots, hidden until tomorrow. You shoot without
                  checking, and see everything at once.
                </span>
              </span>
            </label>

            {disposable ? (
              <div className="mt-3 flex items-center gap-2 border-t border-cream-300 pt-3">
                <span className="text-xs text-cocoa-600">Shots</span>
                {[12, 24, 36].map((count) => (
                  <button
                    key={count}
                    type="button"
                    aria-pressed={shotLimit === count}
                    onClick={() => setShotLimit(count)}
                    className={cn(
                      "rounded-pill px-3 py-1 font-mono text-xs transition",
                      shotLimit === count
                        ? "bg-sky-base text-cocoa-900"
                        : "bg-cream-200 text-cocoa-600 hover:bg-cream-300",
                    )}
                  >
                    {count}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </Sheet>
    </SheetRoot>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 font-sans text-xs font-semibold text-cocoa-600">{label}</legend>
      {children}
    </fieldset>
  );
}
