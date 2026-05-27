"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import type { Coin } from "@/features/crypto/types/coin";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const getFallbackCoinImage = (symbol: string) =>
  `data:image/svg+xml;base64,${btoa(
    `<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="18" fill="#64748b"/><text x="20" y="25" text-anchor="middle" font-family="Arial" font-size="12" fill="white">${symbol.slice(0, 2).toUpperCase()}</text></svg>`,
  )}`;

export const Search = ({
  selectedCoin,
  searchQuery,
  filteredCoins,
  showDropdown,
  onSearchQueryChange,
  onShowDropdownChange,
  onSelectCoin,
  onClearSelection,
}: {
  selectedCoin: Coin | null;
  searchQuery: string;
  filteredCoins: Coin[];
  showDropdown: boolean;
  onSearchQueryChange: (value: string) => void;
  onShowDropdownChange: (value: boolean) => void;
  onSelectCoin: (coin: Coin) => void;
  onClearSelection: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const displayValue = useMemo(() => {
    if (selectedCoin) {
      return `${selectedCoin.name} (${selectedCoin.symbol})`;
    }

    return searchQuery;
  }, [searchQuery, selectedCoin]);

  useEffect(() => {
    const handlePointerDown = (event: Event) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onShowDropdownChange(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onShowDropdownChange]);

  const handleActivateInput = () => {
    if (selectedCoin) {
      onClearSelection();
    }

    onShowDropdownChange(true);
  };

  const handleChange = (value: string) => {
    if (selectedCoin) {
      onClearSelection();
    }

    onSearchQueryChange(value);
    onShowDropdownChange(true);
  };

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <input
        type="text"
        placeholder="Search by coin name or symbol"
        aria-label="Search crypto"
        data-testid="search-input"
        value={displayValue}
        readOnly={Boolean(selectedCoin)}
        onClick={handleActivateInput}
        onFocus={() => {
          if (!selectedCoin) {
            onShowDropdownChange(true);
          }
        }}
        onChange={(event) => handleChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 sm:text-sm"
      />

      {showDropdown && !selectedCoin && (
        <div
          data-testid="search-dropdown"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(24rem,calc(100vh-14rem))] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-slate-950/60 backdrop-blur"
        >
          <ul className="py-1">
            {filteredCoins.length > 0 ? (
              filteredCoins.map((coin) => (
                <li key={coin.id}>
                  <button
                    type="button"
                    data-testid={`search-dropdown-item-${coin.id}`}
                    onClick={() => onSelectCoin(coin)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-800/90"
                  >
                    <Image
                      src={coin.image || getFallbackCoinImage(coin.symbol)}
                      alt={coin.name}
                      width={28}
                      height={28}
                      className="h-7 w-7 shrink-0 rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{coin.name}</p>
                      <p className="truncate text-xs uppercase tracking-wider text-slate-400">
                        {coin.symbol}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-cyan-100">
                      {currencyFormatter.format(coin.current_price)}
                    </p>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-4 py-3 text-sm text-slate-400">No matching coins found.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
