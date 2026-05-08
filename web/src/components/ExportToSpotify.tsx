import { useEffect, useState } from "react";
import {
  consumePendingCallback,
  exportToSpotify,
  startSpotifyAuth,
} from "../spotifyExport";
import {
  backfillBpm,
  fetchAllSongs,
  getExportInfo,
  saveExportInfo,
  subscribeExportInfo,
  type ExportInfo,
} from "../api";
import type { Song } from "../types";

interface Props {
  songs: Song[];
  showToast: (msg: string, kind?: "info" | "success" | "error") => void;
}

export function ExportToSpotify({ songs, showToast }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [exportInfo, setExportInfo] = useState<ExportInfo | null>(null);

  useEffect(() => subscribeExportInfo(setExportInfo), []);

  useEffect(() => {
    const cb = consumePendingCallback();
    if (!cb) return;
    let cancelled = false;
    setBusy(true);
    (async () => {
      try {
        // Fetch songs FRESH from Firestore. The `songs` prop is empty on the
        // page that handles the OAuth redirect (subscriptions haven't loaded
        // yet) and using it would PUT an empty playlist, wiping the existing
        // tracks. This guarantees we always have the real list before writing.
        const [existing, freshSongs] = await Promise.all([
          getExportInfo(),
          fetchAllSongs(),
        ]);
        if (freshSongs.length === 0) {
          throw new Error("No songs loaded — refused to clear playlist");
        }
        const name = "Body's 47th";
        const result = await exportToSpotify(
          cb,
          freshSongs,
          name,
          existing?.playlistId ?? null
        );
        await saveExportInfo(result.playlistId, result.playlistUrl);
        if (!cancelled) {
          showToast(
            existing
              ? `Spotify playlist refreshed (${freshSongs.length} songs) ✅`
              : `Spotify playlist created (${freshSongs.length} songs) ✅`,
            "success"
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Export failed";
        if (!cancelled) {
          setError(msg);
          showToast(msg, "error");
        }
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

  const hasExport = !!exportInfo;
  const buttonLabel = busy
    ? hasExport ? "Refreshing…" : "Exporting…"
    : hasExport ? "🔄 Refresh Spotify list" : "📥 Export to Spotify";

  return (
    <div className="export">
      <button className="primary export-btn" onClick={onExport} disabled={busy}>
        {buttonLabel}
      </button>
      <button
        className="ghost"
        onClick={onBackfill}
        disabled={backfilling}
        title="Re-fetch missing genres for existing songs"
      >
        {backfilling ? "Refreshing…" : "🔄 Refresh genres"}
      </button>
      {exportInfo && (
        <a
          className="export-success"
          href={exportInfo.playlistUrl}
          target="_blank"
          rel="noreferrer"
        >
          🎧 Open playlist in Spotify ↗
        </a>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
