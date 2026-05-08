import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();

const SPOTIFY_CLIENT_ID = defineSecret("SPOTIFY_CLIENT_ID");
const SPOTIFY_CLIENT_SECRET = defineSecret("SPOTIFY_CLIENT_SECRET");
const GETSONGBPM_API_KEY = defineSecret("GETSONGBPM_API_KEY");

const SONG_CAP = 5;

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getSpotifyToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error("Spotify token error", res.status, text);
    throw new HttpsError("internal", "Failed to obtain Spotify token");
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.value;
}

export const spotifySearch = onCall(
  { secrets: [SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET], region: "us-central1" },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
    const q = String(req.data?.q ?? "").trim();
    if (!q) return { tracks: [] };

    const token = await getSpotifyToken(
      SPOTIFY_CLIENT_ID.value(),
      SPOTIFY_CLIENT_SECRET.value()
    );
    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q", q);
    url.searchParams.set("type", "track");
    url.searchParams.set("limit", "12");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      logger.error("Spotify search error", res.status, text);
      throw new HttpsError("internal", "Spotify search failed");
    }
    const data = (await res.json()) as {
      tracks: {
        items: Array<{
          id: string;
          name: string;
          duration_ms: number;
          preview_url: string | null;
          explicit: boolean;
          artists: Array<{ id: string; name: string }>;
          album: { name: string; images: Array<{ url: string; width: number }> };
        }>;
      };
    };

    const tracks = data.tracks.items.map((t) => ({
      id: t.id,
      name: t.name,
      durationMs: t.duration_ms,
      previewUrl: t.preview_url,
      explicit: t.explicit,
      artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
      album: t.album.name,
      coverUrl:
        t.album.images.find((i) => i.width <= 300)?.url ??
        t.album.images[0]?.url ??
        null,
    }));
    return { tracks };
  }
);

async function fetchArtistGenres(token: string, artistIds: string[]): Promise<string[]> {
  if (artistIds.length === 0) return [];
  const url = new URL("https://api.spotify.com/v1/artists");
  url.searchParams.set("ids", artistIds.slice(0, 50).join(","));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { artists: Array<{ genres: string[] }> };
  const all = data.artists.flatMap((a) => a.genres ?? []);
  return Array.from(new Set(all));
}

async function fetchSpotifyTempo(token: string, trackId: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      logger.info(`Spotify audio-features ${trackId} -> ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { tempo?: number };
    if (typeof data.tempo === "number" && data.tempo > 0) {
      return Math.round(data.tempo);
    }
    return null;
  } catch (e) {
    logger.warn("Spotify audio-features failed", e);
    return null;
  }
}

function cleanTitle(title: string): string {
  // GetSongBPM (like most music DBs) doesn't index parenthetical extras like
  // "(feat. X)", "(Remix)", "(angrier)". Strip them.
  return title
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s*-\s*(feat\.|featuring|remix|version|edit).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function lookupBpm(apiKey: string, artist: string, title: string): Promise<number | null> {
  if (!apiKey) return null;
  const cleanedTitle = cleanTitle(title);
  const cleanedArtist = artist.split(/[,&]/)[0].trim();
  try {
    const url = new URL("https://api.getsong.co/search/");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("type", "both");
    url.searchParams.set("lookup", `song:${cleanedTitle} artist:${cleanedArtist}`);
    logger.info(`BPM lookup query: song="${cleanedTitle}" artist="${cleanedArtist}"`);
    const res = await fetch(url.toString());
    const text = await res.text();
    logger.info(`BPM response (${res.status}): ${text.slice(0, 400)}`);
    if (!res.ok) return null;
    let data: { search?: Array<{ tempo?: string }> | { error?: string } };
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }
    if (Array.isArray(data.search) && data.search[0]?.tempo) {
      const bpm = parseInt(data.search[0].tempo, 10);
      return isNaN(bpm) ? null : bpm;
    }
    return null;
  } catch (e) {
    logger.warn("BPM lookup failed", e);
    return null;
  }
}

interface AddSongData {
  trackId: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album: string;
  coverUrl: string | null;
  previewUrl: string | null;
  durationMs: number;
  explicit: boolean;
}

export const addSong = onCall(
  {
    secrets: [SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, GETSONGBPM_API_KEY],
    region: "us-central1",
  },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
    const uid = req.auth.uid;
    const profile = req.auth.token;

    const data = req.data as AddSongData;
    if (!data?.trackId || !data?.name || !Array.isArray(data?.artists)) {
      throw new HttpsError("invalid-argument", "Missing track fields");
    }

    const db = getFirestore();
    const songRef = db.doc(`songs/${data.trackId}`);
    const userRef = db.doc(`users/${uid}`);
    const userVotesRef = db.doc(`userVotes/${uid}`);

    // Enrich (best-effort) with genres + BPM, before the transaction.
    const spotifyTokenPromise = (async () => {
      try {
        return await getSpotifyToken(
          SPOTIFY_CLIENT_ID.value(),
          SPOTIFY_CLIENT_SECRET.value()
        );
      } catch {
        return null;
      }
    })();
    const [genres, bpm] = await Promise.all([
      (async () => {
        const token = await spotifyTokenPromise;
        if (!token) return [];
        return fetchArtistGenres(
          token,
          data.artists.map((a) => a.id).filter(Boolean)
        );
      })(),
      (async () => {
        const token = await spotifyTokenPromise;
        let bpm: number | null = null;
        if (token) {
          bpm = await fetchSpotifyTempo(token, data.trackId);
        }
        if (bpm == null) {
          // Fallback to GetSongBPM (sparse coverage, but still try).
          bpm = await lookupBpm(
            GETSONGBPM_API_KEY.value(),
            data.artists[0]?.name ?? "",
            data.name
          );
        }
        return bpm;
      })(),
    ]);

    await db.runTransaction(async (tx) => {
      const [songSnap, userSnap, userVotesSnap] = await Promise.all([
        tx.get(songRef),
        tx.get(userRef),
        tx.get(userVotesRef),
      ]);
      if (songSnap.exists) {
        throw new HttpsError("already-exists", "This song is already in the playlist");
      }
      const currentCount = userSnap.exists ? (userSnap.data()?.songCount ?? 0) : 0;
      if (currentCount >= SONG_CAP) {
        throw new HttpsError(
          "failed-precondition",
          `You've already added ${SONG_CAP} songs — the limit per person.`
        );
      }
      tx.set(songRef, {
        trackId: data.trackId,
        name: data.name,
        artists: data.artists,
        artistNames: data.artists.map((a) => a.name).join(", "),
        album: data.album,
        coverUrl: data.coverUrl,
        previewUrl: data.previewUrl,
        durationMs: data.durationMs,
        explicit: !!data.explicit,
        genres,
        bpm,
        addedBy: {
          uid,
          name: profile.name ?? profile.email ?? "Anonymous",
          photoURL: profile.picture ?? null,
        },
        addedAt: FieldValue.serverTimestamp(),
        score: 1,
      });
      const existingVotes = (userVotesSnap.exists ? userVotesSnap.data()?.votes : {}) ?? {};
      tx.set(userVotesRef, {
        votes: { ...existingVotes, [data.trackId]: 1 },
      });
      if (userSnap.exists) {
        tx.update(userRef, {
          songCount: FieldValue.increment(1),
          displayName: profile.name ?? null,
          photoURL: profile.picture ?? null,
        });
      } else {
        tx.set(userRef, {
          songCount: 1,
          displayName: profile.name ?? null,
          photoURL: profile.picture ?? null,
        });
      }
    });

    return { ok: true };
  }
);

const HOST_EMAIL = "bogdanripa@gmail.com";

export const backfillBpm = onCall(
  {
    secrets: [GETSONGBPM_API_KEY, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET],
    region: "us-central1",
    timeoutSeconds: 300,
  },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
    if (req.auth.token.email !== HOST_EMAIL) {
      throw new HttpsError("permission-denied", "Host only");
    }

    const db = getFirestore();
    const snap = await db.collection("songs").get();
    const apiKey = GETSONGBPM_API_KEY.value();

    let bpmUpdated = 0;
    let genresUpdated = 0;

    // Spotify token (optional — only needed for genre refetch).
    let spotifyToken: string | null = null;
    try {
      spotifyToken = await getSpotifyToken(
        SPOTIFY_CLIENT_ID.value(),
        SPOTIFY_CLIENT_SECRET.value()
      );
    } catch (e) {
      logger.warn("Could not get Spotify token for genre backfill", e);
    }

    for (const doc of snap.docs) {
      const data = doc.data();
      const updates: Record<string, unknown> = {};

      if (data.bpm == null) {
        let bpm: number | null = null;
        if (spotifyToken) {
          bpm = await fetchSpotifyTempo(spotifyToken, doc.id);
        }
        if (bpm == null) {
          const title = data.name as string;
          const artist = (data.artists as Array<{ name: string }>)?.[0]?.name ?? "";
          bpm = await lookupBpm(apiKey, artist, title);
          await new Promise((r) => setTimeout(r, 250));
        }
        if (bpm != null) {
          updates.bpm = bpm;
          bpmUpdated++;
        }
      }

      if (
        spotifyToken &&
        (!Array.isArray(data.genres) || data.genres.length === 0)
      ) {
        const ids = (data.artists as Array<{ id: string }>)
          ?.map((a) => a.id)
          .filter(Boolean) ?? [];
        const genres = await fetchArtistGenres(spotifyToken, ids);
        if (genres.length > 0) {
          updates.genres = genres;
          genresUpdated++;
        }
      }

      if (Object.keys(updates).length > 0) {
        await doc.ref.update(updates);
      }
    }
    return {
      total: snap.size,
      bpmUpdated,
      genresUpdated,
      // legacy fields for compatibility
      updated: bpmUpdated,
      skipped: snap.size - bpmUpdated,
    };
  }
);

export const removeSong = onCall({ region: "us-central1" }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
  const uid = req.auth.uid;
  const trackId = String(req.data?.trackId ?? "").trim();
  if (!trackId) throw new HttpsError("invalid-argument", "Missing trackId");

  const db = getFirestore();
  const songRef = db.doc(`songs/${trackId}`);
  const userRef = db.doc(`users/${uid}`);

  await db.runTransaction(async (tx) => {
    const songSnap = await tx.get(songRef);
    if (!songSnap.exists) {
      throw new HttpsError("not-found", "Song no longer exists");
    }
    const data = songSnap.data()!;
    if (data.addedBy?.uid !== uid) {
      throw new HttpsError("permission-denied", "You can only delete your own songs");
    }
    tx.delete(songRef);
    tx.update(userRef, { songCount: FieldValue.increment(-1) });
  });

  return { ok: true };
});
