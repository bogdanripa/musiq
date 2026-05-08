import type { Filters } from "../filters";
import { isFilterActive } from "../filters";

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
  totalCount: number;
  filteredCount: number;
}

export function FilterBar({ filters, onChange, totalCount, filteredCount }: Props) {
  if (!isFilterActive(filters)) return null;

  const chips: Array<{ key: keyof Filters; label: string; clear: () => void }> = [];
  if (filters.adder) {
    chips.push({
      key: "adder",
      label: `👤 ${filters.adder.name}`,
      clear: () => onChange({ ...filters, adder: undefined }),
    });
  }
  if (filters.genre) {
    chips.push({
      key: "genre",
      label: `🎼 ${filters.genre}`,
      clear: () => onChange({ ...filters, genre: undefined }),
    });
  }
  if (filters.artist) {
    chips.push({
      key: "artist",
      label: `🎤 ${filters.artist}`,
      clear: () => onChange({ ...filters, artist: undefined }),
    });
  }

  return (
    <div className="filterbar">
      <span className="fb-label">
        Showing {filteredCount} of {totalCount}
      </span>
      <div className="fb-chips">
        {chips.map((c) => (
          <button key={c.key} className="chip" onClick={c.clear} title="Clear filter">
            {c.label} <span className="chip-x">×</span>
          </button>
        ))}
      </div>
      <button className="ghost" onClick={() => onChange({})}>
        Clear all
      </button>
    </div>
  );
}
