"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";

export type CoinJournalEntry = {
  id: string;
  body: string;
  createdAt: string;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export const CoinJournal = ({
  coinId,
  coinName,
  coinImage,
  entries,
  onAddEntry,
  onDeleteEntry,
}: {
  coinId: string;
  coinName: string;
  coinImage: string;
  entries: CoinJournalEntry[];
  onAddEntry: (coinId: string, note: string) => void;
  onDeleteEntry: (coinId: string, noteId: string) => void;
}) => {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const noteCountLabel = useMemo(() => {
    if (entries.length === 1) {
      return "1 note";
    }

    return `${entries.length} notes`;
  }, [entries.length]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = note.trim();

    if (trimmed.length < 10) {
      setError("Write at least 10 characters so the note feels meaningful.");
      return;
    }

    onAddEntry(coinId, trimmed);
    setNote("");
    setError("");
  };

  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:rounded-3xl sm:p-5 lg:max-h-[725px] lg:overflow-y-auto">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider whitespace-nowrap text-slate-400 sm:text-sm">
            Trade Journal
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Image
              src={
                coinImage ||
                `data:image/svg+xml;base64,${btoa(`<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#64748b"/><text x="12" y="16" text-anchor="middle" font-family="Arial" font-size="8" fill="white">${coinId.slice(0, 2).toUpperCase()}</text></svg>`)}`
              }
              alt={coinName}
              width={24}
              height={24}
              className="h-6 w-6 shrink-0 rounded-full"
            />
            <h3 className="break-words text-base font-semibold text-white sm:text-lg md:text-xl">
              Notes for {coinName}
            </h3>
          </div>
        </div>
        <p
          data-testid="journal-note-count"
          className="shrink-0 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] uppercase tracking-wider whitespace-nowrap text-slate-400 sm:text-xs"
        >
          {noteCountLabel}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3">
        <label className="grid gap-2 text-base text-slate-200">
          Add a note
          <textarea
            name="journalNote"
            data-testid="journal-input"
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              if (error) {
                setError("");
              }
            }}
            rows={4}
            placeholder="Example: Watching support hold above the 30D range low before adding size."
            className="w-full resize-y rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 sm:px-4 sm:text-sm"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <p
            data-testid="journal-error"
            aria-live="polite"
            className={`min-h-5 flex-1 basis-full text-sm sm:basis-auto ${error ? "text-rose-300" : "text-slate-500"}`}
          >
            {error}
          </p>
          <button
            type="submit"
            data-testid="journal-submit"
            className="ml-auto min-h-11 rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/70 hover:bg-cyan-300/20"
          >
            Save Note
          </button>
        </div>
      </form>

      <div className="mt-5 grid gap-3" data-testid="journal-entries">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 sm:p-4"
            >
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-6 text-slate-200 break-words whitespace-pre-wrap">
                    {entry.body}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid={`delete-note-${entry.id}`}
                  onClick={() => onDeleteEntry(coinId, entry.id)}
                  className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-wider whitespace-nowrap text-slate-400 transition hover:border-rose-400/50 hover:text-rose-200 sm:px-3 sm:text-xs"
                >
                  Delete
                </button>
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-wider whitespace-nowrap text-slate-500 sm:text-xs">
                {formatDate(entry.createdAt)}
              </p>
            </article>
          ))
        ) : (
          <div
            data-testid="journal-empty"
            className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-3 text-sm text-slate-400 sm:p-4"
          >
            No notes yet. Add your first insight to start tracking this asset.
          </div>
        )}
      </div>
    </div>
  );
};
