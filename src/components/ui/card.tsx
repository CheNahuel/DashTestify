"use client";

import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={[
        "min-w-0 rounded-3xl border border-white/10 bg-slate-950/70 shadow-2xl shadow-cyan-950/10",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

function CardHeader({ className, children, ...props }: CardProps) {
  return (
    <div className={["flex flex-col gap-2 p-4 pb-3 sm:p-6 sm:pb-4", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}

function CardTitle({ className, children, ...props }: CardProps) {
  return (
    <h3 className={["text-xl font-semibold text-white", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </h3>
  );
}

function CardDescription({ className, children, ...props }: CardProps) {
  return (
    <p className={["text-sm text-slate-400", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </p>
  );
}

function CardContent({ className, children, ...props }: CardProps) {
  return (
    <div className={["px-4 pb-4 sm:px-6 sm:pb-6", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle };
