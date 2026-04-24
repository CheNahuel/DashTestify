"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { submitPriceAlert } from "@/app/actions";
import {
  initialPriceAlertFormState,
  type PriceAlertFormState,
} from "../types/priceAlert";

const SubmitButton = () => {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      data-testid="price-alert-submit"
      disabled={pending}
      className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving..." : "Create Alert"}
    </button>
  );
};

export const PriceAlertForm = ({
  coinId,
  coinName,
  currentPrice,
}: {
  coinId: string;
  coinName: string;
  currentPrice: number;
}) => {
  const action = submitPriceAlert.bind(null, {
    coinId,
    coinName,
    currentPrice,
  });
  const [state, formAction] = useActionState<PriceAlertFormState, FormData>(
    action,
    initialPriceAlertFormState
  );
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state?.errors ?? {};
  const status = state?.status ?? "idle";
  const message = state?.message ?? "";

  useEffect(() => {
    if (status === "success") {
      formRef.current?.reset();
    }
  }, [status]);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 max-h-[525px] overflow-y-auto">
      <div className="mb-4">
        <p className="text-sm uppercase tracking-wider whitespace-nowrap text-slate-400">Price Alert</p>
        <h3 className="mt-2 text-xl font-semibold text-white">Simulate a trading alert</h3>
        <p className="mt-2 text-sm text-slate-300">
          This uses a Server Action so your Playwright tests can cover validation,
          pending UI, and successful form submissions.
        </p>
      </div>

      <form ref={formRef} action={formAction} className="grid gap-4">
        <input type="hidden" name="coinId" value={coinId} />

        <label className="grid gap-2 text-sm text-slate-200">
          Email
          <input
            type="email"
            name="email"
            data-testid="price-alert-email"
            placeholder="trader@example.com"
            className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-300/60"
            required
          />
          {errors.email ? (
            <span
              data-testid="price-alert-email-error"
              className="text-sm text-rose-300"
            >
              {errors.email}
            </span>
          ) : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-200">
          Target Price
          <input
            type="number"
            name="targetPrice"
            data-testid="price-alert-target"
            defaultValue={Math.max(currentPrice * 1.05, 0.01).toFixed(2)}
            min="0.01"
            step="0.01"
            className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-300/60"
            required
          />
          {errors.targetPrice ? (
            <span
              data-testid="price-alert-target-error"
              className="text-sm text-rose-300"
            >
              {errors.targetPrice}
            </span>
          ) : null}
        </label>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wider whitespace-nowrap text-slate-500">
            Current: ${currentPrice.toFixed(2)}
          </p>
          <SubmitButton />
        </div>

        <p
          data-testid="price-alert-message"
          aria-live="polite"
          className={`min-h-6 text-sm ${
            status === "error"
              ? "text-rose-300"
              : status === "success"
                ? "text-emerald-300"
                : "text-slate-400"
          }`}
        >
          {message}
        </p>
      </form>
    </div>
  );
};
