import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import {
  subscribeAllVoteCounts,
  subscribeMyVotes,
  subscribeSongs,
  type VoteCounts,
  type VoteMap,
} from "./api";
import type { Song } from "./types";
import { SignIn } from "./components/SignIn";
import { Playlist } from "./components/Playlist";
import { AddSong } from "./components/AddSong";
import { Stats } from "./components/Stats";
import { ExportToSpotify } from "./components/ExportToSpotify";
import { Toast } from "./components/Toast";
import { FilterBar } from "./components/FilterBar";
import { filterSongs, type Filters } from "./filters";
import "./App.css";

const HOST_EMAIL = "bogdanripa@gmail.com";

type ToastState = { message: string; kind: "info" | "success" | "error" } | null;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [myVotes, setMyVotes] = useState<VoteMap>({});
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({});
  const [toast, setToast] = useState<ToastState>(null);
  const [filters, setFilters] = useState<Filters>({});

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); }), []);

  useEffect(() => {
    if (!user) { setSongs([]); return; }
    return subscribeSongs(setSongs);
  }, [user]);

  useEffect(() => {
    if (!user) { setMyVotes({}); return; }
    return subscribeMyVotes(user.uid, setMyVotes);
  }, [user]);

  useEffect(() => {
    if (!user) { setVoteCounts({}); return; }
    return subscribeAllVoteCounts(setVoteCounts);
  }, [user]);

  const myCount = useMemo(
    () => songs.filter((s) => s.addedBy.uid === user?.uid).length,
    [songs, user]
  );

  const filteredSongs = useMemo(() => filterSongs(songs, filters), [songs, filters]);

  const showToast = useCallback(
    (message: string, kind: "info" | "success" | "error" = "info") =>
      setToast({ message, kind }),
    []
  );

  if (!authReady) return null;
  if (!user) {
    return <SignIn onSignIn={() => signInWithPopup(auth, googleProvider)} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>🎉 Body's Birthday Playlist</h1>
        <div className="user">
          {user.photoURL && <img src={user.photoURL} alt="" />}
          <span>{user.displayName ?? user.email}</span>
          <button className="ghost" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </header>

      <Stats
        songs={filteredSongs}
        voteCounts={voteCounts}
        filters={filters}
        onFilter={setFilters}
      />

      {user.email === HOST_EMAIL && <ExportToSpotify songs={songs} showToast={showToast} />}

      <AddSong songs={songs} myCount={myCount} myVotes={myVotes} showToast={showToast} />

      <FilterBar
        filters={filters}
        onChange={setFilters}
        totalCount={songs.length}
        filteredCount={filteredSongs.length}
      />

      <Playlist
        songs={filteredSongs}
        myVotes={myVotes}
        showToast={showToast}
        filters={filters}
        onFilter={setFilters}
      />

      <footer className="footer">Made for the party 🎈</footer>

      <Toast
        message={toast?.message ?? null}
        kind={toast?.kind}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
