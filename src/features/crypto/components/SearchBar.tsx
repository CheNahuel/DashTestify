"use client";

export const SearchBar = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search by coin name or symbol"
        aria-label="Search crypto"
        data-testid="search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pr-12 pl-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          data-testid="search-clear"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-3 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-white focus:border-cyan-300/60 focus:outline-none"
        >
          X
        </button>
      ) : null}
    </div>
  );
};
