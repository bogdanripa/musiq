import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
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
  { total: number; bpmUpdated: number; genresUpdated: number }
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
// uid -> { trackId -> 1|-1 }
export type AllVotes = Record<string, Record<string, 1 | -1>>;

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

export function subscribeAllVotes(cb: (all: AllVotes) => void): () => void {
  return onSnapshot(collection(db, "userVotes"), (snap) => {
    const all: AllVotes = {};
    for (const d of snap.docs) {
      all[d.id] = (d.data().votes ?? {}) as Record<string, 1 | -1>;
    }
    cb(all);
  });
}

// Per-user song limits stored at meta/limits
export interface Limits {
  default: number;
  perUser: Record<string, number>;
}

export function subscribeLimits(cb: (l: Limits) => void): () => void {
  return onSnapshot(doc(db, "meta", "limits"), (snap) => {
    const d = snap.data();
    cb({
      default: typeof d?.default === "number" ? d.default : 5,
      perUser: (d?.perUser as Record<string, number>) ?? {},
    });
  });
}

export async function setUserLimit(uid: string, limit: number | null) {
  // null clears the per-user override
  const ref = doc(db, "meta", "limits");
  const snap = await getDoc(ref);
  const cur = (snap.data() as Limits | undefined) ?? { default: 5, perUser: {} };
  const perUser = { ...cur.perUser };
  if (limit == null) delete perUser[uid];
  else perUser[uid] = limit;
  await setDoc(ref, { default: cur.default, perUser }, { merge: true });
}

export async function setDefaultLimit(limit: number) {
  await setDoc(doc(db, "meta", "limits"), { default: limit }, { merge: true });
}

export interface UserProfile {
  displayName: string | null;
  photoURL: string | null;
}
export type UserDirectory = Record<string, UserProfile>;

export function subscribeUsers(cb: (users: UserDirectory) => void): () => void {
  return onSnapshot(collection(db, "users"), (snap) => {
    const dir: UserDirectory = {};
    for (const d of snap.docs) {
      const data = d.data();
      dir[d.id] = {
        displayName: (data.displayName as string) ?? null,
        photoURL: (data.photoURL as string) ?? null,
      };
    }
    cb(dir);
  });
}

export interface ExportInfo {
  playlistId: string;
  playlistUrl: string;
  lastExportedAt?: unknown;
}

export function subscribeExportInfo(cb: (info: ExportInfo | null) => void) {
  return onSnapshot(doc(db, "meta", "export"), (snap) => {
    cb(snap.exists() ? (snap.data() as ExportInfo) : null);
  });
}

export async function fetchAllSongs(): Promise<Song[]> {
  const snap = await getDocs(collection(db, "songs"));
  return snap.docs.map((d) => d.data() as Song);
}

export async function getExportInfo(): Promise<ExportInfo | null> {
  const snap = await getDoc(doc(db, "meta", "export"));
  return snap.exists() ? (snap.data() as ExportInfo) : null;
}

export async function saveExportInfo(playlistId: string, playlistUrl: string) {
  await setDoc(doc(db, "meta", "export"), {
    playlistId,
    playlistUrl,
    lastExportedAt: serverTimestamp(),
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
