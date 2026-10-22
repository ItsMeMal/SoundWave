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
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  Unsubscribe 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Track, Playlist, LikedTrackItem, PlaybackHistoryItem, UserProfile, UserSettings } from '../types/music.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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

export async function addTrackToUserPlaylist(userId: string, playlistId: string, track: Track): Promise<void> {
  const path = `users/${userId}/playlists/${playlistId}`;
  try {
    const playlistRef = doc(db, 'users', userId, 'playlists', playlistId);
    const snap = await getDoc(playlistRef);
    if (snap.exists()) {
      const data = snap.data() as Playlist;
      const exists = data.tracks?.some(t => t.id === track.id);
      if (!exists) {
        const updatedTracks = [...(data.tracks || []), track];
        await setDoc(playlistRef, {
          tracks: updatedTracks,
          trackCount: updatedTracks.length,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function removeTrackFromUserPlaylist(userId: string, playlistId: string, trackId: string): Promise<void> {
  const path = `users/${userId}/playlists/${playlistId}`;
  try {
    const playlistRef = doc(db, 'users', userId, 'playlists', playlistId);
    const snap = await getDoc(playlistRef);
    if (snap.exists()) {
      const data = snap.data() as Playlist;
      const updatedTracks = (data.tracks || []).filter(t => t.id !== trackId);
      await setDoc(playlistRef, {
        tracks: updatedTracks,
        trackCount: updatedTracks.length,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteUserPlaylist(userId: string, playlistId: string): Promise<void> {
  const path = `users/${userId}/playlists/${playlistId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'playlists', playlistId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
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
