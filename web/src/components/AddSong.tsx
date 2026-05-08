import { useEffect, useRef, useState } from "react";
import { addSong, castVote, searchSpotify, type VoteMap } from "../api";
import type { SearchTrack, Song } from "../types";
import { PreviewButton, SpotifyEmbed } from "./PreviewButton";

interface Props {
  songs: Song[];
  myCount: number;
  myVotes: VoteMap;
  showToast: (msg: string, kind?: "info" | "success" | "error") => void;
  unlimited?: boolean;
}

const SONG_CAP = 5;

export function AddSong({ songs, myCount, myVotes, showToast, unlimited }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const existingIds = new Set(songs.map((s) => s.trackId));
  const remaining = unlimited ? Infinity : SONG_CAP - myCount;

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const tracks = await searchSpotify(query.trim());
        setResults(tracks);
      } catch (e) {
        console.error(e);
        setError("Search failed.");
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  const onAdd = async (t: SearchTrack) => {
    setAdding(t.id);
    setError(null);
    try {
      if (existingIds.has(t.id)) {
        // Already in the playlist — turn the click into an upvote (unless
        // they already upvoted, in which case just say so).
        const existing = myVotes[t.id] ?? 0;
        if (existing === 1) {
          showToast(`"${t.name}" is already in the playlist — you've upvoted it.`, "info");
        } else {
          await castVote(t.id, 1);
          showToast(`"${t.name}" was already added — upvoted for you. 👍`, "success");
        }
        setQuery("");
        setResults([]);
        return;
      }
      await addSong(t);
      showToast(`Added "${t.name}". 🎵`, "success");
      setQuery("");
      setResults([]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not add song.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setAdding(null);
    }
  };

  return (
    <section className="add-song">
      <div className="add-header">
        <h2>🎵 Add a song to the playlist</h2>
        <span className="cap">
          {unlimited
            ? `${myCount} added (host — no limit)`
            : remaining > 0
              ? `${remaining} of ${SONG_CAP} picks left`
              : `You've used all ${SONG_CAP} picks`}
        </span>
      </div>
      <div className="search-wrap">
        <span className="search-icon" aria-hidden>🔎</span>
        <input
          className="search"
          type="search"
          placeholder="Search Spotify — type a song or artist name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={remaining <= 0}
          autoFocus
        />
      </div>
      {error && <div className="error">{error}</div>}
      {loading && <div className="loading">Searching…</div>}
      {results.length > 0 && (
        <ul className="results">
          {results.map((t) => {
            const already = existingIds.has(t.id);
            return (
              <li key={t.id} className="result-wrap">
                <div className="result">
                  {t.coverUrl ? (
                    <img src={t.coverUrl} alt="" />
                  ) : (
                    <div className="cover placeholder small" />
                  )}
                  <div className="meta">
                    <div className="title">
                      {t.name} {t.explicit && <span className="explicit">E</span>}
                    </div>
                    <div className="artist">
                      {t.artists.map((a) => a.name).join(", ")} · {t.album}
                    </div>
                  </div>
                  <PreviewButton
                    active={playingId === t.id}
                    onToggle={() => setPlayingId((id) => (id === t.id ? null : t.id))}
                    size="sm"
                  />
                  <button
                    className="primary"
                    disabled={adding === t.id || (already && (myVotes[t.id] ?? 0) === 1) || (!already && remaining <= 0)}
                    onClick={() => onAdd(t)}
                  >
                    {adding === t.id
                      ? "…"
                      : already
                        ? (myVotes[t.id] ?? 0) === 1 ? "✓ Upvoted" : "👍 Upvote"
                        : "Add"}
                  </button>
                </div>
                {playingId === t.id && <SpotifyEmbed trackId={t.id} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
