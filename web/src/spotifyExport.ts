import type { Song } from "./types";

const CLIENT_ID = "67dba1fb82c845f39bfaeb92f6b4f802";
const REDIRECT_URI = `${window.location.origin}/`;
const SCOPES = "playlist-modify-private playlist-modify-public";

const STORAGE_KEY = "spotify_export_state";

function base64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(text: string): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return new Uint8Array(buf);
}

function randomString(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return base64Url(bytes).slice(0, len);
}

export async function startSpotifyAuth(): Promise<void> {
  const verifier = randomString(64);
  const challenge = base64Url(await sha256(verifier));
  const state = randomString(16);
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ verifier, state, t: Date.now() })
  );
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("state", state);
  window.location.href = url.toString();
}

export interface PendingCallback {
  code: string;
  verifier: string;
}

export function consumePendingCallback(): PendingCallback | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return null;

  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const saved = JSON.parse(raw) as { verifier: string; state: string };
  if (saved.state !== state) return null;

  sessionStorage.removeItem(STORAGE_KEY);

  // Strip query params from the URL so a refresh doesn't re-trigger.
  const clean = window.location.origin + window.location.pathname;
  window.history.replaceState({}, "", clean);

  return { code, verifier: saved.verifier };
}

async function exchangeToken(cb: PendingCallback): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: cb.code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: cb.verifier,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token exchange failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

async function spotifyFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function exportToSpotify(
  cb: PendingCallback,
  songs: Song[],
  playlistName: string
): Promise<string> {
  const token = await exchangeToken(cb);

  const me = await spotifyFetch(token, "/me");
  const playlist = await spotifyFetch(token, `/users/${me.id}/playlists`, {
    method: "POST",
    body: JSON.stringify({
      name: playlistName,
      description: "Created by the Birthday Party Playlist app 🎉",
      public: false,
    }),
  });

  const ordered = [...songs].sort((a, b) => b.score - a.score);
  const uris = ordered.map((s) => `spotify:track:${s.trackId}`);

  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    await spotifyFetch(token, `/playlists/${playlist.id}/tracks`, {
      method: "POST",
      body: JSON.stringify({ uris: chunk }),
    });
  }

  return playlist.external_urls.spotify as string;
}
