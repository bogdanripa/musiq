import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { subscribeMyVotes, subscribeSongs, type VoteMap } from "./api";
import type { Song } from "./types";
import { SignIn } from "./components/SignIn";
import { Playlist } from "./components/Playlist";
import { AddSong } from "./components/AddSong";
import { Stats } from "./components/Stats";
import "./App.css";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [myVotes, setMyVotes] = useState<VoteMap>({});

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); }), []);

  useEffect(() => {
    if (!user) { setSongs([]); return; }
    return subscribeSongs(setSongs);
  }, [user]);

  useEffect(() => {
    if (!user) { setMyVotes({}); return; }
    return subscribeMyVotes(user.uid, setMyVotes);
  }, [user]);

  const myCount = useMemo(
    () => songs.filter((s) => s.addedBy.uid === user?.uid).length,
    [songs, user]
  );

  if (!authReady) return null;
  if (!user) {
    return <SignIn onSignIn={() => signInWithPopup(auth, googleProvider)} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>🎉 Bogdan's Birthday Playlist</h1>
        <div className="user">
          {user.photoURL && <img src={user.photoURL} alt="" />}
          <span>{user.displayName ?? user.email}</span>
          <button className="ghost" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </header>

      <Stats songs={songs} />

      <AddSong songs={songs} myCount={myCount} />

      <Playlist songs={songs} myVotes={myVotes} />

      <footer className="footer">
        BPM data via{" "}
        <a href="https://getsongbpm.com" target="_blank" rel="noreferrer">
          GetSongBPM
        </a>
      </footer>
    </div>
  );
}
