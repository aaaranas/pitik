"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Buttons.
 *
 * Sized around thumbs first — the smallest variant still clears the 44px
 * touch target once padding is counted, because every one of these can end up
 * on a camera screen being tapped one-handed in the dark.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "bg-safelight-500 text-white hover:bg-safelight-400 shadow-lg shadow-safelight-600/25",
        paper: "bg-paper text-ink-900 hover:bg-white",
        subtle: "bg-ink-800 text-ink-100 hover:bg-ink-700 hairline",
        outline:
          "border border-ink-600 text-ink-100 hover:border-ink-500 hover:bg-ink-800/60",
        ghost: "text-ink-200 hover:bg-ink-800/70 hover:text-ink-100",
        danger: "bg-signal-bad/15 text-signal-bad hover:bg-signal-bad/25",
      },
      size: {
        sm: "h-9 rounded-lg px-3 text-[0.8125rem]",
        md: "h-11 rounded-xl px-4 text-sm",
        lg: "h-14 rounded-2xl px-6 text-base",
        icon: "size-11 rounded-full",
        "icon-sm": "size-9 rounded-full",
      },
    },
    defaultVariants: { variant: "subtle", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      // Buttons inside forms default to submit, which has caused an accidental
      // submit in every codebase that forgot it.
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
