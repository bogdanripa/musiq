import { useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Song } from "../types";
import type { VoteCounts } from "../api";
import type { Filters } from "../filters";

interface Props {
  songs: Song[];
  voteCounts: VoteCounts;
  filters?: Filters;
  onFilter?: (next: Filters) => void;
}

const COLORS = ["#ff7a6b", "#ffb86b", "#ffd76b", "#a3e36b", "#6be3c8", "#6bbfff", "#a06bff", "#ff6bd9"];

export function Stats({ songs, voteCounts, filters, onFilter }: Props) {
  const genreData = useMemo(() => {
    const map = new Map<string, number>();
    let untagged = 0;
    for (const s of songs) {
      if (!s.genres || s.genres.length === 0) {
        untagged += 1;
        continue;
      }
      // Count every genre the song has (some songs span 2-3 genres).
      for (const g of s.genres) {
        map.set(g, (map.get(g) ?? 0) + 1);
      }
    }
    const top = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    if (untagged > 0) top.push({ name: "untagged", value: untagged });
    return top;
  }, [songs]);

  const topPicks = useMemo(
    () => [...songs].filter((s) => s.score > 0).slice(0, 3),
    [songs]
  );

  const contributors = useMemo(() => {
    type Entry = {
      uid: string;
      name: string;
      photoURL: string | null;
      songs: number;
      votes: number;
    };
    const map = new Map<string, Entry>();
    for (const s of songs) {
      const e = map.get(s.addedBy.uid) ?? {
        uid: s.addedBy.uid,
        name: s.addedBy.name,
        photoURL: s.addedBy.photoURL,
        songs: 0,
        votes: 0,
      };
      e.songs += 1;
      map.set(s.addedBy.uid, e);
    }
    for (const [uid, count] of Object.entries(voteCounts)) {
      const e = map.get(uid);
      if (e) e.votes = count;
      // Voters who never added a song are skipped — we have no name for them.
    }
    return Array.from(map.values())
      .map((e) => ({ ...e, total: e.songs + e.votes }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [songs, voteCounts]);

  const totalSongs = songs.length;
  const totalVotes = songs.reduce((sum, s) => sum + Math.abs(s.score), 0);
  const totalDuration = songs.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const totalMin = Math.round(totalDuration / 60000);

  return (
    <section className="stats">
      <div className="stat-card numbers">
        <div className="num"><span>{totalSongs}</span> songs</div>
        <div className="num"><span>{totalVotes}</span> votes</div>
        <div className="num"><span>{totalMin}</span> min</div>
      </div>

      <div className="stat-card">
        <h3>Top genres</h3>
        {genreData.length === 0 ? (
          <div className="muted">No genre data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={genreData} dataKey="value" nameKey="name" innerRadius={30} outerRadius={55}>
                {genreData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="legend">
          {genreData.map((g, i) => (
            <span key={g.name}>
              <i style={{ background: COLORS[i % COLORS.length] }} /> {g.name}
            </span>
          ))}
        </div>
      </div>

      <div className="stat-card">
        <h3>Top picks</h3>
        {topPicks.length === 0 ? (
          <div className="muted">No upvoted songs yet</div>
        ) : (
          <ul className="picks">
            {topPicks.map((s, i) => (
              <li key={s.trackId}>
                <span className="rank-badge">{i + 1}</span>
                {s.coverUrl && <img src={s.coverUrl} alt="" />}
                <div className="pmeta">
                  <div className="pname">{s.name}</div>
                  <div className="partist">{s.artistNames}</div>
                </div>
                <span className={`pscore ${s.score > 0 ? "pos" : ""}`}>+{s.score}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="stat-card">
        <h3>Top contributors</h3>
        <ul className="contribs">
          {contributors.map((c) => (
            <li
              key={c.uid}
              title={`${c.songs} songs + ${c.votes} votes — click to filter`}
              className={onFilter ? "clickable" : ""}
              onClick={() =>
                onFilter && onFilter({ ...filters, adder: { uid: c.uid, name: c.name } })
              }
            >
              {c.photoURL && <img src={c.photoURL} alt="" />}
              <span className="cn">{c.name}</span>
              <span className="cc">{c.total} pts</span>
            </li>
          ))}
          {contributors.length === 0 && <li className="muted">No songs yet</li>}
        </ul>
      </div>
    </section>
  );
}
