import { useEffect, useState } from "react";
import {
  consumePendingCallback,
  exportToSpotify,
  startSpotifyAuth,
} from "../spotifyExport";
import { backfillBpm } from "../api";
import type { Song } from "../types";

interface Props {
  songs: Song[];
  showToast: (msg: string, kind?: "info" | "success" | "error") => void;
}

export function ExportToSpotify({ songs, showToast }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    const cb = consumePendingCallback();
    if (!cb) return;
    let cancelled = false;
    setBusy(true);
    (async () => {
      try {
        const name = `Body's Birthday — ${new Date().toLocaleDateString()}`;
        const url = await exportToSpotify(cb, songs, name);
        if (!cancelled) setResult(url);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Export failed";
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onExport = () => {
    if (songs.length === 0) {
      setError("No songs to export yet.");
      return;
    }
    setError(null);
    void startSpotifyAuth();
  };

  const onBackfill = async () => {
    setBackfilling(true);
    try {
      const res = await backfillBpm();
      showToast(
        `Refreshed ${res.genresUpdated} song genres (of ${res.total}).`,
        "success"
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Backfill failed";
      showToast(msg, "error");
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="export">
      <button className="primary export-btn" onClick={onExport} disabled={busy}>
        {busy ? "Exporting…" : "📥 Export to Spotify"}
      </button>
      <button
        className="ghost"
        onClick={onBackfill}
        disabled={backfilling}
        title="Re-fetch missing genres for existing songs"
      >
        {backfilling ? "Refreshing…" : "🔄 Refresh genres"}
      </button>
      {result && (
        <a className="export-success" href={result} target="_blank" rel="noreferrer">
          ✅ Playlist created — open in Spotify ↗
        </a>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
