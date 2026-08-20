"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet and centred dialog, both on Radix.
 *
 * Radix is here for exactly one reason: focus trapping, scroll locking, and
 * `aria-modal` wiring that actually works with VoiceOver and TalkBack. The
 * visual layer is entirely ours — nothing about this should read as a stock
 * component library.
 */

export const SheetRoot = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

function Overlay({ className }: { className?: string }) {
  return (
    <Dialog.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in",
        className,
      )}
    />
  );
}

export interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof Dialog.Content> {
  title: string;
  description?: string;
  /** Hides the visible heading but keeps it for screen readers. */
  hideTitle?: boolean;
  footer?: React.ReactNode;
}

/** Slides up from the bottom edge. The default on phones. */
export const Sheet = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, title, description, hideTitle, footer, children, ...props }, ref) => (
    <Dialog.Portal>
      <Overlay />
      <Dialog.Content
        ref={ref}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88svh] w-full max-w-lg flex-col rounded-t-3xl border border-b-0 border-ink-700 bg-ink-900 shadow-2xl shadow-black/60",
          "duration-300 data-[state=open]:animate-rise",
          className,
        )}
        style={{ paddingBottom: "var(--safe-bottom)" }}
        {...props}
      >
        {/* Grab handle: signals draggability and gives a thumb somewhere safe
            to land when reaching for the top of the sheet. */}
        <div className="flex justify-center pt-3" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-ink-600" />
        </div>

        <header className="flex items-start justify-between gap-4 px-5 pb-2 pt-3">
          <div className={cn(hideTitle && "sr-only")}>
            <Dialog.Title className="font-display text-2xl leading-tight text-ink-100">
              {title}
            </Dialog.Title>
            {description ? (
              <Dialog.Description className="mt-1 text-sm text-ink-300">
                {description}
              </Dialog.Description>
            ) : null}
          </div>
          {!hideTitle ? (
            <Dialog.Close
              className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-full text-ink-300 transition hover:bg-ink-800 hover:text-ink-100"
              aria-label="Close"
            >
              <X className="size-5" />
            </Dialog.Close>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          {children}
        </div>

        {footer ? <div className="border-t border-ink-800 px-5 py-4">{footer}</div> : null}
      </Dialog.Content>
    </Dialog.Portal>
  ),
);
Sheet.displayName = "Sheet";

/** Centred modal, used for destructive confirmations. */
export const Modal = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, title, description, footer, children, ...props }, ref) => (
    <Dialog.Portal>
      <Overlay />
      <Dialog.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ink-700 bg-ink-900 p-5 shadow-2xl shadow-black/60 data-[state=open]:animate-rise",
          className,
        )}
        {...props}
      >
        <Dialog.Title className="font-display text-xl text-ink-100">{title}</Dialog.Title>
        {description ? (
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-ink-300">
            {description}
          </Dialog.Description>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        {footer ? <div className="mt-5 flex gap-2">{footer}</div> : null}
      </Dialog.Content>
    </Dialog.Portal>
  ),
);
Modal.displayName = "Modal";
