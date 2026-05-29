"use client";

import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
};

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-cyan-400/15 text-cyan-100",
  secondary: "bg-slate-700 text-slate-100",
  outline: "border border-white/15 bg-transparent text-slate-200",
  destructive: "bg-rose-400/15 text-rose-100",
};

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        variantStyles[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}
