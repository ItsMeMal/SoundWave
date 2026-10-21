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
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocFromServer,
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Track, Playlist, LikedTrackItem, UserProfile, UserSettings } from '../types/music.ts';

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

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(p => ({
        providerId: p.providerId,
        email: p.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection() {
  // Graceful passive connection check
  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
    await Promise.race([getDocFromServer(doc(db, 'test', 'connection')), timeoutPromise]);
  } catch {
    // Normal during initial boot or offline state
  }
}

// User Profile Operations
export async function syncUserProfile(user: User): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'User',
    photoURL: user.photoURL || '',
    plan: 'Premium',
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

// Liked Tracks
export async function getLikedTracks(userId: string): Promise<LikedTrackItem[]> {
  const path = `users/${userId}/likedTracks`;
  try {
    const q = query(collection(db, 'users', userId, 'likedTracks'), orderBy('likedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as LikedTrackItem);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
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

// User Playlists
export async function getUserPlaylists(userId: string): Promise<Playlist[]> {
  const path = `users/${userId}/playlists`;
  try {
    const q = query(collection(db, 'users', userId, 'playlists'), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as Playlist);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
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

// History
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
      playedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Settings
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
