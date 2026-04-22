"use client";

export const SearchBar = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <input
      type="text"
      placeholder="Search crypto..."
      aria-label="Search crypto"
      data-testid="search-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-2 border rounded-lg mb-4"
    />
  );
};