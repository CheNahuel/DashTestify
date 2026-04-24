"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitPriceAlert } from "@/app/actions";
import {
  initialPriceAlertFormState,
  type PriceAlertFormState,
} from "../types/priceAlert";

type PriceAlert = {
  id: string;
  coinId: string;
  coinName: string;
  email: string;
  targetPrice: number;
  createdAt: string;
};

const ALERTS_STORAGE_KEY = "dashtestify.priceAlerts";

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

const AlertTable = ({
  alerts,
  onDelete,
}: {
  alerts: PriceAlert[];
  onDelete: (id: string) => void;
}) => {
  return (
    <div className="mt-6" data-testid="alert-table">
      <h4 className="mb-3 text-sm uppercase tracking-wider whitespace-nowrap text-slate-400">
        Active Alerts ({alerts.length})
      </h4>
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/40">
        <table className="w-full min-w-[200px] text-sm">
          <thead className="border-b border-white/10 bg-slate-900/60">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-400 text-sm">Coin</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-400 text-sm">Target Price</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-400 text-sm">Email</th>
              <th className="px-3 py-2 text-center font-semibold text-slate-400 text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-slate-400 text-sm">
                  No price alerts set yet. Create your first alert above.
                </td>
              </tr>
            ) : (
              alerts.map((alert) => (
                <tr key={alert.id} className="border-b border-white/5 last:border-b-0">
                  <td className="px-3 py-2 text-slate-200 text-sm whitespace-pre-wrap">{alert.coinName}</td>
                  <td className="px-3 py-2 text-slate-200 text-sm whitespace-pre-wrap">${alert.targetPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 text-slate-200 text-sm whitespace-pre-wrap">{alert.email}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      data-testid={`delete-alert-${alert.id}`}
                      onClick={() => onDelete(alert.id)}
                      className="rounded-full border border-rose-500/50 bg-rose-500/15 px-2 py-1 text-xs font-semibold text-rose-300 transition hover:border-rose-500/70 hover:bg-rose-500/25"
                      aria-label={`Delete alert for ${alert.coinName}`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
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
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [deleteMessage, setDeleteMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  useEffect(() => {
    const storedAlerts = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (storedAlerts) {
      try {
        setAlerts(JSON.parse(storedAlerts));
      } catch {
        // Ignore invalid stored data
      }
    }
  }, []);

  useEffect(() => {
    if (status === "success" && state?.submittedAlert) {
      const newAlert: PriceAlert = {
        id: crypto.randomUUID(),
        coinId: state.submittedAlert.coinId,
        coinName: state.submittedAlert.coinName,
        email: state.submittedAlert.email,
        targetPrice: state.submittedAlert.targetPrice,
        createdAt: new Date().toISOString(),
      };

      setAlerts((prev) => {
        const updated = [...prev, newAlert];
        localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });

      formRef.current?.reset();

      // Set success message and clear it after 3 seconds
      setSuccessMessage(state.message || "");
      setTimeout(() => setSuccessMessage(""), 3000);
    }
  }, [status, state?.submittedAlert, state?.message || ""]);

  const deleteAlert = (alertId: string) => {
    const alertToDelete = alerts.find((alert) => alert.id === alertId);
    if (!alertToDelete) return;

    setAlerts((prev) => {
      const updated = prev.filter((alert) => alert.id !== alertId);
      localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    setDeleteMessage(`Alert for ${alertToDelete.coinName} at $${alertToDelete.targetPrice.toFixed(2)} has been deleted.`);

    // Clear the message after 3 seconds
    setTimeout(() => setDeleteMessage(""), 3000);
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 max-h-[725px] overflow-y-auto">
      <div className="mb-4">
        <p className="text-sm uppercase tracking-wider whitespace-nowrap text-slate-400">Price Alert</p>
        <h3 className="mt-2 text-xl font-semibold text-white">Create Price Alert for {coinName}</h3>
      </div>

      <form ref={formRef} action={formAction} className="grid gap-4">
        <input type="hidden" name="coinId" value={coinId} />

        <label className="grid gap-2 text-sm text-slate-200">
          Enter your email to receive alerts
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
          Notify me when price reaches
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
              : successMessage
                ? "text-emerald-300"
                : "text-slate-400"
          }`}
        >
          {status === "error" ? message : successMessage}
        </p>
      </form>

      {deleteMessage && (
        <div
          data-testid="delete-alert-message"
          className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"
        >
          {deleteMessage}
        </div>
      )}

      <AlertTable alerts={alerts} onDelete={deleteAlert} />
    </div>
  );
};
