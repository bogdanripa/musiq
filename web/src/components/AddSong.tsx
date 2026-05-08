import { useEffect, useRef, useState } from "react";
import { addSong, searchSpotify } from "../api";
import type { SearchTrack, Song } from "../types";
import { PreviewButton } from "./PreviewButton";

interface Props {
  songs: Song[];
  myCount: number;
}

const SONG_CAP = 5;

export function AddSong({ songs, myCount }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const existingIds = new Set(songs.map((s) => s.trackId));
  const remaining = SONG_CAP - myCount;

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
      await addSong(t);
      setQuery("");
      setResults([]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not add song.";
      setError(msg);
    } finally {
      setAdding(null);
    }
  };

  return (
    <section className="add-song">
      <div className="add-header">
        <h2>Add a song</h2>
        <span className="cap">
          {remaining > 0
            ? `${remaining} of ${SONG_CAP} picks left`
            : `You've used all ${SONG_CAP} picks`}
        </span>
      </div>
      <input
        className="search"
        type="search"
        placeholder="Search Spotify by song or artist…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={remaining <= 0}
      />
      {error && <div className="error">{error}</div>}
      {loading && <div className="loading">Searching…</div>}
      {results.length > 0 && (
        <ul className="results">
          {results.map((t) => {
            const already = existingIds.has(t.id);
            return (
              <li key={t.id} className="result">
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
                <PreviewButton url={t.previewUrl} size="sm" />
                <button
                  className="primary"
                  disabled={already || adding === t.id || remaining <= 0}
                  onClick={() => onAdd(t)}
                >
                  {already ? "Already added" : adding === t.id ? "Adding…" : "Add"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
