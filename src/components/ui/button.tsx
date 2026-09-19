"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Buttons.
 *
 * Sized around thumbs first: `md`, `lg`, and `icon` clear the 44px touch
 * target, for anything that can end up tapped one-handed on a camera screen
 * in the dark. `sm` (h-9) and `icon-sm` (size-9) are 36px on purpose — they
 * are for dense, secondary rows, not a screen's primary action.
 */
const buttonVariants = cva(
  "squish inline-flex items-center justify-center gap-2 whitespace-nowrap border-2 border-cocoa-900 font-display font-semibold tracking-[-0.01em] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        // Ink fill, cream text: 14.03:1, and the loudest thing on the screen.
        primary: "bg-cocoa-900 text-cream-50 shadow-[4px_4px_0_var(--color-sky-base)] hover:bg-cocoa-800",
        soft: "bg-cream-50 text-cocoa-900 shadow-[4px_4px_0_var(--color-cocoa-900)] hover:bg-white",
        subtle: "bg-cream-200 text-cocoa-900 hover:bg-cream-300",
        outline: "bg-transparent text-cocoa-900 hover:bg-cream-100",
        // Ghost is the one variant with no ink border — it is not a slab.
        ghost: "border-transparent text-cocoa-600 hover:bg-cream-200 hover:text-cocoa-900",
        danger: "bg-blush-tint text-blush-deep hover:bg-blush-deep hover:text-cream-50",
      },
      size: {
        sm: "h-9 rounded-slab px-3.5 text-[0.8125rem]",
        md: "h-11 rounded-slab px-5 text-sm",
        lg: "h-14 rounded-slab px-7 text-base",
        icon: "size-11 rounded-slab",
        "icon-sm": "size-9 rounded-slab",
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
