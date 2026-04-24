"use client";

import { FormEvent, useMemo, useState } from "react";

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
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 max-h-[725px] overflow-y-auto">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-wider whitespace-nowrap text-slate-400">Trade Journal</p>
          <div className="mt-2 flex items-center gap-2">
            <img
              src={coinImage}
              alt={coinName}
              className="h-6 w-6 rounded-full"
            />
            <h3 className="text-xl font-semibold text-white">Notes for {coinName}</h3>
          </div>
        </div>
        <p
          data-testid="journal-note-count"
          className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs uppercase tracking-wider whitespace-nowrap text-slate-400"
        >
          {noteCountLabel}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3">
        <label className="grid gap-2 text-sm text-slate-200">
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
            className="resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <p
            data-testid="journal-error"
            aria-live="polite"
            className={`min-h-5 text-sm ${error ? "text-rose-300" : "text-slate-500"}`}
          >
            {error}
          </p>
          <button
            type="submit"
            data-testid="journal-submit"
            className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/70 hover:bg-cyan-300/20"
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
              className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-6 text-slate-200 break-all whitespace-pre-wrap">
                    {entry.body}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid={`delete-note-${entry.id}`}
                  onClick={() => onDeleteEntry(coinId, entry.id)}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-wider whitespace-nowrap text-slate-400 transition hover:border-rose-400/50 hover:text-rose-200"
                >
                  Delete
                </button>
              </div>
              <p className="mt-3 text-xs uppercase tracking-wider whitespace-nowrap text-slate-500">
                {formatDate(entry.createdAt)}
              </p>
            </article>
          ))
        ) : (
          <div
            data-testid="journal-empty"
            className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400"
          >
            No notes yet. Add your first insight to start tracking this asset.
          </div>
        )}
      </div>
    </div>
  );
};
