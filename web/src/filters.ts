import type { Song } from "./types";

export interface Filters {
  adder?: { uid: string; name: string };
  genre?: string;
  artist?: string;
}

export function filterSongs(songs: Song[], f: Filters): Song[] {
  return songs.filter((s) => {
    if (f.adder && s.addedBy.uid !== f.adder.uid) return false;
    if (f.genre && !(s.genres ?? []).includes(f.genre)) return false;
    if (f.artist && !s.artists.some((a) => a.name === f.artist)) return false;
    return true;
  });
}

export function isFilterActive(f: Filters): boolean {
  return Boolean(f.adder || f.genre || f.artist);
}
