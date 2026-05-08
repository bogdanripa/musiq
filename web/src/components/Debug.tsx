import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import type { Song } from "../types";

export function Debug() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    songs: Array<{ id: string; name: string; score: number; addedBy: string }>;
    voters: Array<{
      uid: string;
      name: string;
      total: number;
      ups: number;
      downs: number;
      tracks: Array<{ trackId: string; v: number; songName: string }>;
    }>;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [songsSnap, votesSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "songs")),
        getDocs(collection(db, "userVotes")),
        getDocs(collection(db, "users")),
      ]);
      const songsById = new Map<string, Song>();
      const songs = songsSnap.docs.map((d) => {
        const s = d.data() as Song;
        songsById.set(d.id, s);
        return {
          id: d.id,
          name: s.name,
          score: s.score,
          addedBy: s.addedBy.name,
        };
      });
      const userNames: Record<string, string> = {};
      for (const u of usersSnap.docs) {
        userNames[u.id] = (u.data().displayName as string) ?? "(no name)";
      }
      const voters = votesSnap.docs.map((d) => {
        const map = (d.data().votes ?? {}) as Record<string, 1 | -1>;
        const tracks = Object.entries(map).map(([trackId, v]) => ({
          trackId,
          v: v as number,
          songName: songsById.get(trackId)?.name ?? "(deleted)",
        }));
        const ups = tracks.filter((t) => t.v === 1).length;
        const downs = tracks.filter((t) => t.v === -1).length;
        return {
          uid: d.id,
          name: userNames[d.id] ?? "(unknown)",
          total: tracks.length,
          ups,
          downs,
          tracks,
        };
      });
      voters.sort((a, b) => b.total - a.total);
      setData({ songs: songs.sort((a, b) => b.score - a.score), voters });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !data) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="debug">
      <button className="ghost" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide debug" : "🔧 Debug data"}
      </button>
      {open && (
        <div className="debug-body">
          <button className="ghost" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          {data && (
            <>
              <h4>Songs ({data.songs.length})</h4>
              <ul>
                {data.songs.map((s) => (
                  <li key={s.id}>
                    score=<b>{s.score}</b> · {s.name} <i>(added by {s.addedBy})</i>
                  </li>
                ))}
              </ul>
              <h4>Voters ({data.voters.length})</h4>
              <ul>
                {data.voters.map((v) => (
                  <li key={v.uid}>
                    <b>{v.name}</b>: {v.total} entries — {v.ups}↑ / {v.downs}↓
                    <details>
                      <summary>show votes</summary>
                      <ul>
                        {v.tracks.map((t) => (
                          <li key={t.trackId}>
                            {t.v > 0 ? "↑" : "↓"} {t.songName}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
