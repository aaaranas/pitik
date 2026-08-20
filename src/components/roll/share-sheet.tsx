"use client";

import { Copy, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Sheet, SheetRoot } from "@/components/ui/sheet";
import { useToast } from "@/components/providers/toast-provider";
import { ensureShareCode } from "@/lib/db/repo";
import type { Roll } from "@/lib/db/types";
import { shareLink } from "@/lib/share";

/**
 * Invite people to a roll.
 *
 * The code is minted here rather than at roll creation, so a roll that is never
 * shared never has a shareable identifier in the first place — privacy by not
 * having the data, not by checking a flag.
 *
 * The QR is generated locally. No image service ever sees the link.
 */
export function ShareSheet({
  roll,
  open,
  onOpenChange,
}: {
  roll: Roll;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [code, setCode] = useState<string | null>(roll.shareCode);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void ensureShareCode(roll.id).then((next) => setCode(next ?? null));
  }, [open, roll.id]);

  const url = code && typeof window !== "undefined" ? `${window.location.origin}/join/${code}` : null;

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void QRCode.toDataURL(url, {
      width: 512,
      margin: 1,
      color: { dark: "#0b0908", light: "#f5f0e7" },
      errorCorrectionLevel: "M",
    })
      .then((dataUrl) => !cancelled && setQr(dataUrl))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <SheetRoot open={open} onOpenChange={onOpenChange}>
      <Sheet
        title="Share this roll"
        description="Anyone with the code can add their photos to it."
      >
        <div className="flex flex-col items-center">
          <div className="paper-grain grid size-48 place-items-center rounded-xl bg-paper p-3">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`QR code for joining ${roll.title}`} className="size-full" />
            ) : (
              <QrCode className="size-10 text-ink-400" aria-hidden />
            )}
          </div>

          <p className="mt-5 font-mono text-3xl tracking-[0.28em] text-paper">
            {code ?? "······"}
          </p>
          <p className="mt-1 text-xs text-ink-400">Read it out, or scan the code above.</p>

          <div className="mt-6 flex w-full gap-2">
            <Button
              variant="subtle"
              className="flex-1"
              disabled={!url}
              onClick={async () => {
                if (!url) return;
                const outcome = await shareLink({ url, title: roll.title });
                if (outcome === "opened") toast("Link copied.", { tone: "success" });
                if (outcome === "failed") toast("Couldn't share that link.", { tone: "error" });
              }}
            >
              <Copy className="size-4" aria-hidden />
              Share link
            </Button>
          </div>

          <p className="mt-5 text-center text-xs leading-relaxed text-ink-500">
            Sharing needs an account so photos have somewhere to sync to. Until then
            the code works between your own devices.
          </p>
        </div>
      </Sheet>
    </SheetRoot>
  );
}
