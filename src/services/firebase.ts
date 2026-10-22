import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc,
  collectionGroup, 
  getDoc, 
  setDoc, 
  deleteDoc,
  deleteField,
  writeBatch, 
  collection, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  Unsubscribe 
} from 'firebase/firestore';
import { Track, Playlist, LikedTrackItem, PlaybackHistoryItem, PlaybackProgressItem, ListeningSession, UserProfile, UserSettings } from '../types/music.ts';

// Firebase Web configuration is public client configuration, supplied per deployment.
// Keep secrets (for example, service-account keys) out of VITE_* variables.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim() || undefined,
};

const firestoreDatabaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID?.trim();

const requiredFirebaseValues: Record<string, string | undefined> = {
  VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  VITE_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  VITE_FIREBASE_STORAGE_BUCKET: firebaseConfig.storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
  VITE_FIREBASE_APP_ID: firebaseConfig.appId,
  VITE_FIRESTORE_DATABASE_ID: firestoreDatabaseId,
};

const missingFirebaseValues = Object.entries(requiredFirebaseValues)
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingFirebaseValues.length > 0) {
  throw new Error(
    `[SoundWave] Missing Firebase environment variables: ${missingFirebaseValues.join(', ')}. ` +
    'Configure them in .env.local for local development or Project Settings > Environment Variables in Vercel.'
  );
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firestoreDatabaseId!);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    userId: auth.currentUser?.uid,
    operationType,
    path
  };
  console.warn('Firestore Notice:', JSON.stringify(errInfo));
}

// User Profile Operations
export async function syncUserProfile(user: User): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'User',
    photoURL: user.photoURL || '',
    updatedAt: new Date().toISOString()
  };

  try {
    const existing = await getDoc(userRef);
    if (!existing.exists()) {
      await setDoc(userRef, {
        ...profile,
        createdAt: new Date().toISOString()
      }, { merge: true });
    }
    return profile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    return profile;
  }
}

// Liked Tracks with Realtime onSnapshot Listener
export function subscribeLikedTracks(
  userId: string, 
  onUpdate: (tracks: LikedTrackItem[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'users', userId, 'likedTracks'), 
    orderBy('likedAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(d => d.data() as LikedTrackItem);
    onUpdate(items);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, `users/${userId}/likedTracks`);
  });
}

export async function addLikedTrack(userId: string, track: Track): Promise<void> {
  const path = `users/${userId}/likedTracks/${track.id}`;
  try {
    const item: LikedTrackItem = {
      id: track.id,
      videoId: track.id,
      userId,
      title: track.title,
      artist: track.artist,
      album: track.album || '',
      thumbnailUrl: track.thumbnailUrl,
      duration: track.duration,
      likedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', userId, 'likedTracks', track.id), item);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function removeLikedTrack(userId: string, trackId: string): Promise<void> {
  const path = `users/${userId}/likedTracks/${trackId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'likedTracks', trackId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Playlists with Realtime onSnapshot Listener
export function subscribeUserPlaylists(
  userId: string, 
  onUpdate: (playlists: Playlist[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'users', userId, 'playlists'), 
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(d => d.data() as Playlist);
    onUpdate(items);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, `users/${userId}/playlists`);
  });
}

export async function createFirestorePlaylist(
  userId: string, 
  name: string, 
  description: string = '', 
  coverUrl: string = ''
): Promise<Playlist> {
  const id = 'pl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const path = `users/${userId}/playlists/${id}`;
  const newPlaylist: Playlist = {
    id,
    userId,
    name,
    description,
    coverUrl: coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
    trackCount: 0,
    tracks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'users', userId, 'playlists', id), newPlaylist);
    return newPlaylist;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    return newPlaylist;
  }
}

// Public sharing stores a minimal snapshot under a high-entropy unlisted token.
// Provider stream URLs and bulky search metadata are intentionally not copied to public documents.
function toShareableTracks(tracks: Track[]): Track[] {
  return tracks.slice(0, 500).filter(Boolean).map(track => ({
    id: String(track.id || ''),
    title: String(track.title || 'Unknown track'),
    artist: String(track.artist || 'Unknown artist'),
    album: String(track.album || ''),
    thumbnailUrl: String(track.thumbnailUrl || ''),
    duration: Number.isFinite(track.duration) ? Math.max(0, track.duration) : 0,
  }));
}

function createShareToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return Array.from({ length: 48 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export async function createOrUpdateSharedPlaylist(
  userId: string,
  playlistId: string,
  creatorName: string
): Promise<string> {
  const playlistRef = doc(db, 'users', userId, 'playlists', playlistId);
  const snap = await getDoc(playlistRef);
  if (!snap.exists()) throw new Error('This playlist no longer exists.');
  const playlist = snap.data() as Playlist;
  if (playlist.userId !== userId) throw new Error('Only the playlist owner can create a share link.');

  const shareId = typeof playlist.shareId === 'string' && playlist.shareId
    ? playlist.shareId
    : createShareToken();
  const publicTracks = toShareableTracks(playlist.tracks || []);
  const now = new Date().toISOString();
  const shareRef = doc(db, 'sharedPlaylists', shareId);
  const batch = writeBatch(db);

  batch.set(shareRef, {
    id: playlist.id,
    playlistId: playlist.id,
    shareId,
    ownerId: userId,
    name: String(playlist.name || 'Shared playlist'),
    description: String(playlist.description || ''),
    coverUrl: String(playlist.coverUrl || publicTracks[0]?.thumbnailUrl || ''),
    creator: String(creatorName || 'SoundWave listener'),
    trackCount: publicTracks.length,
    tracks: publicTracks,
    isPublic: true,
    createdAt: String(playlist.createdAt || now),
    updatedAt: now,
  });
  batch.set(playlistRef, { shareId, updatedAt: now }, { merge: true });
  await batch.commit();
  return shareId;
}

export async function getSharedPlaylist(shareId: string): Promise<Playlist | null> {
  if (!/^[a-fA-F0-9]{32,80}$/.test(shareId)) return null;
  const snap = await getDoc(doc(db, 'sharedPlaylists', shareId));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.isPublic !== true || !Array.isArray(data.tracks)) return null;

  const tracks = toShareableTracks(data.tracks as Track[]).filter(track => track.id && track.title);
  return {
    id: String(data.playlistId || data.id || shareId),
    name: String(data.name || 'Shared playlist'),
    description: String(data.description || ''),
    coverUrl: String(data.coverUrl || tracks[0]?.thumbnailUrl || ''),
    trackCount: tracks.length,
    tracks,
    creator: String(data.creator || 'SoundWave listener'),
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
  };
}

export async function revokeSharedPlaylistLink(userId: string, playlistId: string): Promise<void> {
  const playlistRef = doc(db, 'users', userId, 'playlists', playlistId);
  const snap = await getDoc(playlistRef);
  if (!snap.exists()) throw new Error('This playlist no longer exists.');
  const playlist = snap.data() as Playlist;
  if (playlist.userId !== userId) throw new Error('Only the playlist owner can disable sharing.');
  if (!playlist.shareId) return;

  const batch = writeBatch(db);
  const shareRef = doc(db, 'sharedPlaylists', playlist.shareId);
  const shareSnap = await getDoc(shareRef);
  if (shareSnap.exists() && shareSnap.data().ownerId === userId) batch.delete(shareRef);
  batch.set(playlistRef, { shareId: deleteField(), updatedAt: new Date().toISOString() }, { merge: true });
  await batch.commit();
}

export async function addTrackToUserPlaylist(userId: string, playlistId: string, track: Track): Promise<void> {
  const path = `users/${userId}/playlists/${playlistId}`;
  try {
    const playlistRef = doc(db, 'users', userId, 'playlists', playlistId);
    const snap = await getDoc(playlistRef);
    if (!snap.exists()) return;

    const data = snap.data() as Playlist;
    if (data.userId !== userId) throw new Error('Only the playlist owner can edit this playlist.');
    if ((data.tracks || []).some(existing => existing.id === track.id)) return;

    const updatedTracks = [...(data.tracks || []), track];
    const now = new Date().toISOString();
    const playlistUpdate: Record<string, any> = {
      tracks: updatedTracks,
      trackCount: updatedTracks.length,
      updatedAt: now,
    };
    const batch = writeBatch(db);
    let sharedRef: ReturnType<typeof doc> | null = null;

    if (data.shareId) {
      const candidateRef = doc(db, 'sharedPlaylists', data.shareId);
      const sharedSnap = await getDoc(candidateRef);
      if (sharedSnap.exists() && sharedSnap.data().ownerId === userId && sharedSnap.data().isPublic === true) {
        sharedRef = candidateRef;
      } else {
        playlistUpdate.shareId = deleteField();
      }
    }

    batch.set(playlistRef, playlistUpdate, { merge: true });
    if (sharedRef) {
      const publicTracks = toShareableTracks(updatedTracks);
      batch.set(sharedRef, { tracks: publicTracks, trackCount: publicTracks.length, updatedAt: now }, { merge: true });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    throw err;
  }
}

export async function removeTrackFromUserPlaylist(userId: string, playlistId: string, trackId: string): Promise<void> {
  const path = `users/${userId}/playlists/${playlistId}`;
  try {
    const playlistRef = doc(db, 'users', userId, 'playlists', playlistId);
    const snap = await getDoc(playlistRef);
    if (!snap.exists()) return;

    const data = snap.data() as Playlist;
    if (data.userId !== userId) throw new Error('Only the playlist owner can edit this playlist.');

    const updatedTracks = (data.tracks || []).filter(track => track.id !== trackId);
    const now = new Date().toISOString();
    const playlistUpdate: Record<string, any> = {
      tracks: updatedTracks,
      trackCount: updatedTracks.length,
      updatedAt: now,
    };
    const batch = writeBatch(db);
    let sharedRef: ReturnType<typeof doc> | null = null;

    if (data.shareId) {
      const candidateRef = doc(db, 'sharedPlaylists', data.shareId);
      const sharedSnap = await getDoc(candidateRef);
      if (sharedSnap.exists() && sharedSnap.data().ownerId === userId && sharedSnap.data().isPublic === true) {
        sharedRef = candidateRef;
      } else {
        playlistUpdate.shareId = deleteField();
      }
    }

    batch.set(playlistRef, playlistUpdate, { merge: true });
    if (sharedRef) {
      const publicTracks = toShareableTracks(updatedTracks);
      batch.set(sharedRef, { tracks: publicTracks, trackCount: publicTracks.length, updatedAt: now }, { merge: true });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    throw err;
  }
}

export async function deleteUserPlaylist(userId: string, playlistId: string): Promise<void> {
  const path = `users/${userId}/playlists/${playlistId}`;
  try {
    const playlistRef = doc(db, 'users', userId, 'playlists', playlistId);
    const snap = await getDoc(playlistRef);
    if (!snap.exists()) return;

    const data = snap.data() as Playlist;
    if (data.userId !== userId) throw new Error('Only the playlist owner can delete this playlist.');

    const batch = writeBatch(db);
    if (data.shareId) {
      const shareRef = doc(db, 'sharedPlaylists', data.shareId);
      const shareSnap = await getDoc(shareRef);
      if (shareSnap.exists() && shareSnap.data().ownerId === userId) batch.delete(shareRef);
    }
    batch.delete(playlistRef);
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    throw err;
  }
}

// History with Realtime onSnapshot Listener
export function subscribePlaybackHistory(
  userId: string, 
  onUpdate: (history: PlaybackHistoryItem[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'users', userId, 'history'), 
    orderBy('playedAt', 'desc'),
    limit(20)
  );
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(d => d.data() as PlaybackHistoryItem);
    onUpdate(items);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, `users/${userId}/history`);
  });
}

export async function addPlaybackHistory(userId: string, track: Track): Promise<void> {
  const path = `users/${userId}/history/${track.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'history', track.id), {
      id: track.id,
      videoId: track.id,
      userId,
      title: track.title,
      artist: track.artist,
      thumbnailUrl: track.thumbnailUrl,
      duration: track.duration,
      playedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getUserIsAdmin(userId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.exists() && snap.data().admin === true;
}

export function subscribeAdminListeningSessions(onUpdate: (items: ListeningSession[]) => void): Unsubscribe {
  const q = query(collectionGroup(db, 'listeningSessions'), orderBy('updatedAt', 'desc'), limit(2000));
  return onSnapshot(q, snapshot => onUpdate(snapshot.docs.map(d => d.data() as ListeningSession)),
    err => handleFirestoreError(err, OperationType.LIST, 'users/*/listeningSessions'));
}

// Continue Listening: private per-user playback positions for cross-device resume.
export function subscribePlaybackProgress(userId: string, onUpdate: (items: PlaybackProgressItem[]) => void): Unsubscribe {
  const q = query(collection(db, 'users', userId, 'playbackProgress'), orderBy('updatedAt', 'desc'), limit(12));
  return onSnapshot(q, snapshot => {
    onUpdate(snapshot.docs.map(d => d.data() as PlaybackProgressItem)
      .filter(item => Number.isFinite(item.position) && item.position >= 5 && item.position < (item.duration || Infinity) - 8));
  }, err => handleFirestoreError(err, OperationType.LIST, `users/${userId}/playbackProgress`));
}

export async function savePlaybackProgress(userId: string, track: Track, position: number, duration: number): Promise<void> {
  const path = `users/${userId}/playbackProgress/${track.id}`;
  try {
    if (!Number.isFinite(position) || position < 5) return;
    const actualDuration = Number.isFinite(duration) && duration > 0 ? duration : track.duration;
    if (actualDuration > 0 && position >= actualDuration - 8) {
      await deleteDoc(doc(db, 'users', userId, 'playbackProgress', track.id));
      return;
    }
    await setDoc(doc(db, 'users', userId, 'playbackProgress', track.id), {
      id: track.id, videoId: track.id, userId,
      title: track.title, artist: track.artist, thumbnailUrl: track.thumbnailUrl,
      duration: actualDuration || 0, position: Math.floor(position),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function clearPlaybackProgress(userId: string, trackId: string): Promise<void> {
  const path = `users/${userId}/playbackProgress/${trackId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'playbackProgress', trackId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveListeningSession(
  userId: string, sessionId: string, track: Track, secondsListened: number, startedAt: string, completed = false
): Promise<void> {
  const path = `users/${userId}/listeningSessions/${sessionId}`;
  try {
    await setDoc(doc(db, 'users', userId, 'listeningSessions', sessionId), {
      id: sessionId, userId, videoId: track.id, title: track.title, artist: track.artist,
      thumbnailUrl: track.thumbnailUrl, duration: track.duration || 0,
      secondsListened: Math.min(86400, Math.max(0, Math.floor(secondsListened))),
      startedAt, updatedAt: new Date().toISOString(), completed,
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeListeningSessions(userId: string, onUpdate: (items: ListeningSession[]) => void): Unsubscribe {
  const q = query(collection(db, 'users', userId, 'listeningSessions'), orderBy('updatedAt', 'desc'), limit(500));
  return onSnapshot(q, snapshot => onUpdate(snapshot.docs.map(d => d.data() as ListeningSession)),
    err => handleFirestoreError(err, OperationType.LIST, `users/${userId}/listeningSessions`));
}

// User Settings
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const path = `users/${userId}/settings/preferences`;
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'));
    if (snap.exists()) {
      return snap.data() as UserSettings;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

export async function saveUserSettings(userId: string, settings: UserSettings): Promise<void> {
  const path = `users/${userId}/settings/preferences`;
  try {
    await setDoc(doc(db, 'users', userId, 'settings', 'preferences'), {
      ...settings,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
