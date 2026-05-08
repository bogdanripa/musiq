import { useEffect, useState } from "react";
import {
  consumePendingCallback,
  exportToSpotify,
  startSpotifyAuth,
} from "../spotifyExport";
import type { Song } from "../types";

interface Props {
  songs: Song[];
}

export function ExportToSpotify({ songs }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cb = consumePendingCallback();
    if (!cb) return;
    let cancelled = false;
    setBusy(true);
    (async () => {
      try {
        const name = `Bogdan's Birthday — ${new Date().toLocaleDateString()}`;
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
    // We intentionally only run on mount — `songs` may not be loaded yet, but
    // we read the snapshot at the moment the callback fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onClick = () => {
    if (songs.length === 0) {
      setError("No songs to export yet.");
      return;
    }
    setError(null);
    void startSpotifyAuth();
  };

  return (
    <div className="export">
      <button
        className="primary export-btn"
        onClick={onClick}
        disabled={busy}
      >
        {busy ? "Exporting…" : "📥 Export to Spotify"}
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
