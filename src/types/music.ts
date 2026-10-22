export interface TrackArtist {
  name: string;
  id?: string;
}

export interface TrackThumbnail {
  url: string;
  width?: number;
  height?: number;
}

export interface Track {
  id: string; // videoId
  title: string;
  artist: string;
  artists?: TrackArtist[];
  album?: string;
  thumbnailUrl: string;
  thumbnails?: TrackThumbnail[];
  duration: number; // in seconds
  streamUrl?: string;
  source?: 'api' | 'custom' | 'liked' | 'history';
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  trackCount: number;
  tracks: Track[];
  userId?: string;
  creator?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LikedTrackItem {
  id: string;
  videoId: string;
  userId: string;
  title: string;
  artist: string;
  album?: string;
  thumbnailUrl: string;
  duration: number;
  likedAt: string;
}

export interface PlaybackHistoryItem {
  id: string;
  videoId: string;
  userId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration?: number;
  playedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserSettings {
  playbackQuality: 'Low' | 'Normal' | 'High' | 'Lossless';
  downloadQuality: 'Low' | 'Normal' | 'High';
  autoplay: boolean;
  theme: 'dark' | 'light' | 'system';
  language: string;
}

export interface SearchResult {
  tracks: Track[];
  total?: number;
}

export interface LyricsResponse {
  id: string;
  source: string;
  lyrics: string;
}

export interface ArtistDetail {
  id: string;
  name: string;
  subscribers?: string;
  description?: string;
  thumbnails?: { url: string }[];
  topTracks: Track[];
  albums?: any[];
}

export interface AlbumDetail {
  id: string;
  title: string;
  artist: string;
  year?: string;
  coverUrl?: string;
  trackCount?: number;
  tracks: Track[];
}

export type ViewType = 
  | 'home'
  | 'search'
  | 'library'
  | 'liked'
  | 'artist'
  | 'album'
  | 'playlist'
  | 'lyrics'
  | 'settings';
