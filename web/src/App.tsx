import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { subscribeMyVotes, subscribeSongs, type VoteMap } from "./api";
import type { Song } from "./types";
import { SignIn } from "./components/SignIn";
import { Playlist } from "./components/Playlist";
import { AddSong } from "./components/AddSong";
import { Stats } from "./components/Stats";
import { ExportToSpotify } from "./components/ExportToSpotify";
import { Toast } from "./components/Toast";
import "./App.css";

const HOST_EMAIL = "bogdanripa@gmail.com";

type ToastState = { message: string; kind: "info" | "success" | "error" } | null;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [myVotes, setMyVotes] = useState<VoteMap>({});
  const [toast, setToast] = useState<ToastState>(null);

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
        <h1>🎉 Bogdan's Birthday Playlist</h1>
        <div className="user">
          {user.photoURL && <img src={user.photoURL} alt="" />}
          <span>{user.displayName ?? user.email}</span>
          <button className="ghost" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </header>

      <Stats songs={songs} />

      {user.email === HOST_EMAIL && <ExportToSpotify songs={songs} />}

      <AddSong songs={songs} myCount={myCount} myVotes={myVotes} showToast={showToast} />

      <Playlist songs={songs} myVotes={myVotes} showToast={showToast} />

      <footer className="footer">
        BPM data provided by{" "}
        <a href="https://getsongbpm.com" target="_blank" rel="noreferrer">
          Get Song BPM
        </a>
      </footer>

      <Toast
        message={toast?.message ?? null}
        kind={toast?.kind}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
