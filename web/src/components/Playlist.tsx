import { useMemo, useState } from "react";
import {
  castVote,
  removeSong,
  type AllVotes,
  type UserDirectory,
  type VoteMap,
} from "../api";
import { auth } from "../firebase";
import type { Song } from "../types";
import { PreviewButton, SpotifyEmbed } from "./PreviewButton";

import type { Filters } from "../filters";

interface Props {
  songs: Song[];
  myVotes: VoteMap;
  showToast: (msg: string, kind?: "info" | "success" | "error") => void;
  filters: Filters;
  onFilter: (next: Filters) => void;
  allVotes: AllVotes;
  users: UserDirectory;
}

export function Playlist({
  songs,
  myVotes,
  showToast,
  filters,
  onFilter,
  allVotes,
  users,
}: Props) {
  const myUid = auth.currentUser?.uid;
  const [deleting, setDeleting] = useState<string | null>(null);

  const onDelete = async (s: Song) => {
    if (deleting) return;
    if (!confirm(`Remove "${s.name}" from the playlist? This frees up one of your 5 picks.`)) return;
    setDeleting(s.trackId);
    try {
      await removeSong(s.trackId);
      showToast(`Removed "${s.name}".`, "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not remove song.";
      showToast(msg, "error");
    } finally {
      setDeleting(null);
    }
  };

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, "up" | "down" | null>>({});

  if (songs.length === 0) {
    const isFiltered = !!(filters.adder || filters.genre || filters.artist);
    return (
      <div className="empty">
        {isFiltered ? (
          <>
            No songs match the current filter.{" "}
            <button className="ghost inline" onClick={() => onFilter({})}>
              Clear filters
            </button>
          </>
        ) : (
          "No songs yet — be the first to add one!"
        )}
      </div>
    );
  }

  const onVote = async (trackId: string, target: 1 | -1, songName: string) => {
    if (pending[trackId]) return;
    const current = myVotes[trackId] ?? 0;
    const next = current === target ? 0 : target;
    setPending((p) => ({ ...p, [trackId]: target === 1 ? "up" : "down" }));
    try {
      await castVote(trackId, next);
      if (next === 0) showToast(`Removed your vote on "${songName}".`, "info");
      else showToast(
        next === 1 ? `Upvoted "${songName}" 👍` : `Downvoted "${songName}" 👎`,
        "success"
      );
    } catch (e) {
      console.error(e);
      showToast("Could not register your vote — try again.", "error");
    } finally {
      setPending((p) => ({ ...p, [trackId]: null }));
    }
  };

  const togglePlay = (trackId: string) => {
    setPlayingId((current) => (current === trackId ? null : trackId));
  };

  // For each trackId: list of voter names (excluding the song's adder).
  // Direction (up/down) is intentionally hidden.
  const votersByTrack = useMemo(() => {
    const adderByTrack = new Map<string, string>();
    for (const s of songs) adderByTrack.set(s.trackId, s.addedBy.uid);
    const map = new Map<string, string[]>();
    for (const [uid, votes] of Object.entries(allVotes)) {
      for (const trackId of Object.keys(votes)) {
        const adder = adderByTrack.get(trackId);
        if (!adder || adder === uid) continue;
        const name = users[uid]?.displayName ?? null;
        if (!name) continue;
        const arr = map.get(trackId) ?? [];
        arr.push(name);
        map.set(trackId, arr);
      }
    }
    for (const [k, arr] of map) arr.sort((a, b) => a.localeCompare(b));
    return map;
  }, [songs, allVotes, users]);

  return (
    <ol className="playlist">
      {songs.map((s, idx) => {
        const myVote = myVotes[s.trackId] ?? 0;
        const playing = playingId === s.trackId;
        const busy = pending[s.trackId];
        return (
          <li key={s.trackId} className="song-wrap">
            <div className="song">
              <div className="rank">{idx + 1}</div>
              {s.coverUrl ? (
                <img className="cover" src={s.coverUrl} alt="" />
              ) : (
                <div className="cover placeholder" />
              )}
              <div className="meta">
                <div className="title">
                  {s.name} {s.explicit && <span className="explicit">E</span>}
                </div>
                <div className="artist">
                  {s.artists.map((a, i) => (
                    <span key={a.id || a.name}>
                      {i > 0 && ", "}
                      <button
                        className="filterable"
                        onClick={() => onFilter({ ...filters, artist: a.name })}
                        title={`Filter by ${a.name}`}
                      >
                        {a.name}
                      </button>
                    </span>
                  ))}
                </div>
                <div className="sub">
                  <span>{s.album}</span>
                  {s.genres?.[0] && (
                    <>
                      {" · "}
                      <button
                        className="filterable"
                        onClick={() => onFilter({ ...filters, genre: s.genres[0] })}
                        title={`Filter by ${s.genres[0]}`}
                      >
                        {s.genres[0]}
                      </button>
                    </>
                  )}
                </div>
                <div className="added-by">
                  <button
                    className="filterable adder-link"
                    onClick={() =>
                      onFilter({
                        ...filters,
                        adder: { uid: s.addedBy.uid, name: s.addedBy.name },
                      })
                    }
                    title={`Filter by ${s.addedBy.name}`}
                  >
                    {s.addedBy.photoURL && <img src={s.addedBy.photoURL} alt="" />}
                    <span>added by {s.addedBy.name}</span>
                  </button>
                  {s.addedBy.uid === myUid && (
                    <button
                      className="delete-song"
                      onClick={() => onDelete(s)}
                      disabled={deleting === s.trackId}
                      title="Remove this song (frees up one of your 5 picks)"
                    >
                      {deleting === s.trackId ? "…" : "✕ Remove"}
                    </button>
                  )}
                </div>
              </div>
              <PreviewButton active={playing} onToggle={() => togglePlay(s.trackId)} />
              <div className="votes">
                <button
                  className={`vote up ${myVote === 1 ? "active" : ""} ${busy === "up" ? "loading" : ""}`}
                  onClick={() => onVote(s.trackId, 1, s.name)}
                  disabled={!!busy}
                  aria-label={myVote === 1 ? "Remove upvote" : "Upvote"}
                  title={myVote === 1 ? "Remove upvote" : "Upvote"}
                >
                  <span className="arrow">▲</span>
                  <span className="vlabel">Up</span>
                </button>
                <div className="score-wrap">
                  <div
                    className={`score ${s.score > 0 ? "pos" : s.score < 0 ? "neg" : ""}`}
                    tabIndex={0}
                  >
                    {s.score > 0 ? `+${s.score}` : s.score}
                  </div>
                  {(votersByTrack.get(s.trackId)?.length ?? 0) > 0 && (
                    <div className="voters-pop" role="tooltip">
                      <div className="vp-title">Voted by</div>
                      <ul>
                        {votersByTrack.get(s.trackId)!.map((n) => (
                          <li key={n}>{n}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <button
                  className={`vote down ${myVote === -1 ? "active" : ""} ${busy === "down" ? "loading" : ""}`}
                  onClick={() => onVote(s.trackId, -1, s.name)}
                  disabled={!!busy}
                  aria-label={myVote === -1 ? "Remove downvote" : "Downvote"}
                  title={myVote === -1 ? "Remove downvote" : "Downvote"}
                >
                  <span className="arrow">▼</span>
                  <span className="vlabel">Down</span>
                </button>
              </div>
            </div>
            {playing && <SpotifyEmbed trackId={s.trackId} />}
          </li>
        );
      })}
    </ol>
  );
}
