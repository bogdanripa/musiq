import { useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Song } from "../types";

interface Props { songs: Song[]; }

const COLORS = ["#ff7a6b", "#ffb86b", "#ffd76b", "#a3e36b", "#6be3c8", "#6bbfff", "#a06bff", "#ff6bd9"];

export function Stats({ songs }: Props) {
  const genreData = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of songs) {
      const g = s.genres?.[0];
      if (!g) continue;
      map.set(g, (map.get(g) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [songs]);

  const bpmData = useMemo(() => {
    const buckets = [
      { range: "<80",   min: 0,   max: 80 },
      { range: "80-100", min: 80, max: 100 },
      { range: "100-120", min: 100, max: 120 },
      { range: "120-140", min: 120, max: 140 },
      { range: "140+",  min: 140, max: 999 },
    ];
    return buckets.map((b) => ({
      range: b.range,
      count: songs.filter((s) => s.bpm != null && s.bpm >= b.min && s.bpm < b.max).length,
    }));
  }, [songs]);

  const contributors = useMemo(() => {
    const map = new Map<string, { name: string; photoURL: string | null; count: number; score: number }>();
    for (const s of songs) {
      const e = map.get(s.addedBy.uid) ?? { name: s.addedBy.name, photoURL: s.addedBy.photoURL, count: 0, score: 0 };
      e.count += 1;
      e.score += s.score;
      map.set(s.addedBy.uid, e);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [songs]);

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
        <h3>BPM</h3>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={bpmData}>
            <XAxis dataKey="range" tick={{ fontSize: 11 }} />
            <YAxis hide />
            <Tooltip />
            <Bar dataKey="count" fill="#6bbfff" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="stat-card">
        <h3>Top contributors</h3>
        <ul className="contribs">
          {contributors.map((c) => (
            <li key={c.name}>
              {c.photoURL && <img src={c.photoURL} alt="" />}
              <span className="cn">{c.name}</span>
              <span className="cc">{c.count} {c.count === 1 ? "song" : "songs"}</span>
            </li>
          ))}
          {contributors.length === 0 && <li className="muted">No songs yet</li>}
        </ul>
      </div>
    </section>
  );
}
