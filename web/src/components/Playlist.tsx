import { castVote, type VoteMap } from "../api";
import type { Song } from "../types";
import { PreviewButton } from "./PreviewButton";

interface Props {
  songs: Song[];
  myVotes: VoteMap;
}

export function Playlist({ songs, myVotes }: Props) {
  if (songs.length === 0) {
    return (
      <div className="empty">
        No songs yet — be the first to add one!
      </div>
    );
  }

  const onVote = async (trackId: string, target: 1 | -1) => {
    const current = myVotes[trackId] ?? 0;
    const next = current === target ? 0 : target;
    try {
      await castVote(trackId, next);
    } catch (e) {
      console.error(e);
      alert("Could not register your vote — try again.");
    }
  };

  return (
    <ol className="playlist">
      {songs.map((s, idx) => {
        const myVote = myVotes[s.trackId] ?? 0;
        return (
          <li key={s.trackId} className="song">
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
              <div className="artist">{s.artistNames}</div>
              <div className="sub">
                <span>{s.album}</span>
                {s.bpm && <span> · {s.bpm} BPM</span>}
                {s.genres?.[0] && <span> · {s.genres[0]}</span>}
              </div>
              <div className="added-by">
                {s.addedBy.photoURL && <img src={s.addedBy.photoURL} alt="" />}
                <span>added by {s.addedBy.name}</span>
              </div>
            </div>
            <PreviewButton url={s.previewUrl} />
            <div className="votes">
              <button
                className={`vote up ${myVote === 1 ? "active" : ""}`}
                onClick={() => onVote(s.trackId, 1)}
                aria-label="Upvote"
              >
                ▲
              </button>
              <div className={`score ${s.score > 0 ? "pos" : s.score < 0 ? "neg" : ""}`}>
                {s.score > 0 ? `+${s.score}` : s.score}
              </div>
              <button
                className={`vote down ${myVote === -1 ? "active" : ""}`}
                onClick={() => onVote(s.trackId, -1)}
                aria-label="Downvote"
              >
                ▼
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
