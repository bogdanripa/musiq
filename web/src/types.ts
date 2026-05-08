import { Timestamp } from "firebase/firestore";

export interface Artist {
  id: string;
  name: string;
}

export interface Song {
  trackId: string;
  name: string;
  artists: Artist[];
  artistNames: string;
  album: string;
  coverUrl: string | null;
  previewUrl: string | null;
  durationMs: number;
  explicit: boolean;
  genres: string[];
  bpm: number | null;
  addedBy: { uid: string; name: string; photoURL: string | null };
  addedAt: Timestamp | null;
  score: number;
}

export interface SearchTrack {
  id: string;
  name: string;
  artists: Artist[];
  album: string;
  coverUrl: string | null;
  previewUrl: string | null;
  durationMs: number;
  explicit: boolean;
}
