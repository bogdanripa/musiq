import { useEffect, useState } from "react";
import type { Filters } from "../filters";
import { isFilterActive } from "../filters";
import { setUserLimit, setDefaultLimit, type Limits } from "../api";

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
  totalCount: number;
  filteredCount: number;
  isHost: boolean;
  limits: Limits;
  showToast: (msg: string, kind?: "info" | "success" | "error") => void;
}

export function FilterBar({
  filters,
  onChange,
  totalCount,
  filteredCount,
  isHost,
  limits,
  showToast,
}: Props) {
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
      <div className="fb-top">
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
      {isHost && filters.adder && (
        <LimitForm
          uid={filters.adder.uid}
          name={filters.adder.name}
          limits={limits}
          showToast={showToast}
        />
      )}
    </div>
  );
}

interface LimitFormProps {
  uid: string;
  name: string;
  limits: Limits;
  showToast: (msg: string, kind?: "info" | "success" | "error") => void;
}

function LimitForm({ uid, name, limits, showToast }: LimitFormProps) {
  const override = limits.perUser[uid];
  const initial =
    typeof override === "number" ? String(override) : "";
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(typeof override === "number" ? String(override) : "");
  }, [override]);

  const onSave = async () => {
    setSaving(true);
    try {
      const trimmed = value.trim();
      if (trimmed === "") {
        await setUserLimit(uid, null);
        showToast(`${name}: limit reset to default (${limits.default}).`, "success");
      } else {
        const n = parseInt(trimmed, 10);
        if (isNaN(n) || n < 0) {
          showToast("Limit must be a non-negative number.", "error");
          return;
        }
        await setUserLimit(uid, n);
        showToast(`${name}: limit set to ${n}.`, "success");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  const onSetDefault = async (raw: string) => {
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 0) return;
    await setDefaultLimit(n);
    showToast(`Default limit set to ${n}.`, "success");
  };

  return (
    <div className="limits-form">
      <span className="lf-label">Song limit for {name}:</span>
      <input
        type="number"
        min="0"
        className="lf-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`default (${limits.default})`}
      />
      <button className="primary" onClick={onSave} disabled={saving}>
        {saving ? "…" : "Save"}
      </button>
      <span className="lf-hint">
        empty = use default
      </span>
      <span className="lf-divider">·</span>
      <span className="lf-label">Default:</span>
      <input
        type="number"
        min="0"
        className="lf-input"
        defaultValue={limits.default}
        onBlur={(e) => {
          const v = e.currentTarget.value;
          if (parseInt(v, 10) !== limits.default) void onSetDefault(v);
        }}
      />
    </div>
  );
}
