import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  orderBy,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "./firebase";
import type { SearchTrack, Song } from "./types";

const _spotifySearch = httpsCallable<{ q: string }, { tracks: SearchTrack[] }>(
  functions,
  "spotifySearch"
);
const _addSong = httpsCallable<Record<string, unknown>, { ok: true }>(
  functions,
  "addSong"
);
const _removeSong = httpsCallable<{ trackId: string }, { ok: true }>(
  functions,
  "removeSong"
);
const _backfillBpm = httpsCallable<
  unknown,
  { updated: number; skipped: number; total: number }
>(functions, "backfillBpm");

export async function backfillBpm() {
  const res = await _backfillBpm();
  return res.data;
}

export async function searchSpotify(q: string): Promise<SearchTrack[]> {
  const res = await _spotifySearch({ q });
  return res.data.tracks;
}

export async function removeSong(trackId: string): Promise<void> {
  await _removeSong({ trackId });
}

export async function addSong(track: SearchTrack): Promise<void> {
  await _addSong({
    trackId: track.id,
    name: track.name,
    artists: track.artists,
    album: track.album,
    coverUrl: track.coverUrl,
    previewUrl: track.previewUrl,
    durationMs: track.durationMs,
    explicit: track.explicit,
  });
}

export function subscribeSongs(cb: (songs: Song[]) => void): () => void {
  const q = query(collection(db, "songs"), orderBy("score", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => d.data() as Song));
  });
}

export type VoteMap = Record<string, 1 | -1>;

export function subscribeMyVotes(uid: string, cb: (v: VoteMap) => void): () => void {
  const ref = doc(db, "userVotes", uid);
  return onSnapshot(ref, (snap) => {
    const data = snap.data();
    cb((data?.votes as VoteMap) ?? {});
  });
}

export type VoteCounts = Record<string, number>;

export function subscribeAllVoteCounts(cb: (counts: VoteCounts) => void): () => void {
  return onSnapshot(collection(db, "userVotes"), (snap) => {
    const counts: VoteCounts = {};
    for (const d of snap.docs) {
      const votes = (d.data().votes ?? {}) as Record<string, unknown>;
      counts[d.id] = Object.keys(votes).length;
    }
    cb(counts);
  });
}

export async function castVote(trackId: string, next: 1 | -1 | 0): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in required");
  const songRef = doc(db, "songs", trackId);
  const voteRef = doc(db, "userVotes", user.uid);

  await runTransaction(db, async (tx) => {
    const [songSnap, voteSnap] = await Promise.all([tx.get(songRef), tx.get(voteRef)]);
    if (!songSnap.exists()) throw new Error("Song no longer exists");
    const votes: VoteMap = voteSnap.exists() ? (voteSnap.data()?.votes ?? {}) : {};
    const prev: 1 | -1 | 0 = votes[trackId] ?? 0;
    const delta = next - prev;
    if (delta === 0) return;

    const newScore = (songSnap.data().score ?? 0) + delta;
    tx.update(songRef, { score: newScore });

    const newVotes = { ...votes };
    if (next === 0) delete newVotes[trackId];
    else newVotes[trackId] = next;
    tx.set(voteRef, { votes: newVotes });
  });
}
