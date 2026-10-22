import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { PlayerProvider } from './context/PlayerContext.tsx';
import { ViewType, Playlist, Track } from './types/music.ts';
import { subscribeUserPlaylists } from './services/firebase.ts';

// Layout Components
import { Sidebar } from './components/layout/Sidebar.tsx';
import { Navbar } from './components/layout/Navbar.tsx';
import { RightPlayerPanel } from './components/layout/RightPlayerPanel.tsx';
import { BottomPlayerBar } from './components/layout/BottomPlayerBar.tsx';
import { MobileNav } from './components/layout/MobileNav.tsx';

// Views
import { HomeView } from './views/HomeView.tsx';
import { SearchView } from './views/SearchView.tsx';
import { LibraryView } from './views/LibraryView.tsx';
import { LikedSongsView } from './views/LikedSongsView.tsx';
import { ArtistView } from './views/ArtistView.tsx';
import { AlbumView } from './views/AlbumView.tsx';
import { PlaylistView } from './views/PlaylistView.tsx';
import { LyricsView } from './views/LyricsView.tsx';
import { SettingsView } from './views/SettingsView.tsx';

// Modals
import { AuthModal } from './components/modals/AuthModal.tsx';
import { CreatePlaylistModal } from './components/modals/CreatePlaylistModal.tsx';
import { AddToPlaylistModal } from './components/modals/AddToPlaylistModal.tsx';

const AppContent: React.FC = () => {
  const { user } = useAuth();

  // Navigation State
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [navPayload, setNavPayload] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Mobile sidebar drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Playlists state from Firestore
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Modal States
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  const [addToPlaylistOpen, setAddToPlaylistOpen] = useState(false);
  const [trackToAddToPlaylist, setTrackToAddToPlaylist] = useState<Track | null>(null);

  // Subscribe to real-time user playlists from Firestore
  useEffect(() => {
    if (!user) {
      setUserPlaylists([]);
      return;
    }

    const unsubscribe = subscribeUserPlaylists(user.uid, (playlists) => {
      setUserPlaylists(playlists);
    });

    return () => unsubscribe();
  }, [user, refreshCounter]);

  const handleNavigate = (view: ViewType, payload?: any) => {
    setCurrentView(view);
    if (view !== 'search') {
      setSearchQuery('');
    }
    if (payload !== undefined) {
      setNavPayload(payload);
    }
    setMobileMenuOpen(false);
  };

  const handleSearchSubmit = (query: string) => {
    setSearchQuery(query);
    setCurrentView('search');
    setNavPayload({ initialQuery: query });
    setMobileMenuOpen(false);
  };

  const handleOpenAddToPlaylist = (track: Track) => {
    setTrackToAddToPlaylist(track);
    setAddToPlaylistOpen(true);
  };

  const handlePlaylistCreated = (playlist: Playlist) => {
    setRefreshCounter(prev => prev + 1);
    handleNavigate('playlist', {
      playlistId: playlist.id,
      initialPlaylist: playlist,
      name: playlist.name,
    });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0d14] text-white overflow-hidden font-['Plus_Jakarta_Sans',sans-serif] antialiased select-none">
      {/* Main App Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          userPlaylists={userPlaylists}
          onOpenCreatePlaylist={() => setCreatePlaylistOpen(true)}
          className="hidden md:flex"
        />

        {/* Mobile Slide-in Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#0e1116] z-10 shadow-2xl">
              <Sidebar
                currentView={currentView}
                onNavigate={handleNavigate}
                userPlaylists={userPlaylists}
                onOpenCreatePlaylist={() => {
                  setMobileMenuOpen(false);
                  setCreatePlaylistOpen(true);
                }}
                className="w-full h-full"
              />
            </div>
          </div>
        )}

        {/* Center Main Stage */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0a0d14] overflow-hidden relative">
          <Navbar
            currentView={currentView}
            onNavigate={handleNavigate}
            onSearchSubmit={handleSearchSubmit}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
          />

          {/* Dynamic Content Views */}
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative">
            {currentView === 'home' && (
              <HomeView
                onNavigate={handleNavigate}
                onOpenCreatePlaylist={() => setCreatePlaylistOpen(true)}
              />
            )}

            {currentView === 'search' && (
              <SearchView
                initialQuery={navPayload.initialQuery || searchQuery}
                onNavigate={handleNavigate}
                onOpenAddToPlaylist={handleOpenAddToPlaylist}
              />
            )}

            {currentView === 'library' && (
              <LibraryView
                onNavigate={handleNavigate}
                userPlaylists={userPlaylists}
                onOpenCreatePlaylist={() => setCreatePlaylistOpen(true)}
                onRefreshPlaylists={() => setRefreshCounter(prev => prev + 1)}
              />
            )}

            {currentView === 'liked' && (
              <LikedSongsView onNavigate={handleNavigate} />
            )}

            {currentView === 'artist' && (
              <ArtistView
                artistName={navPayload.artistName || 'Artist'}
                artistId={navPayload.artistId}
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'album' && (
              <AlbumView
                albumId={navPayload.albumId || ''}
                albumTitle={navPayload.albumTitle}
                artistName={navPayload.artistName}
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'playlist' && (
              <PlaylistView
                playlistId={navPayload.playlistId || ''}
                initialPlaylist={navPayload.initialPlaylist}
                name={navPayload.name}
                onNavigate={handleNavigate}
                onRefreshPlaylists={() => setRefreshCounter(prev => prev + 1)}
              />
            )}

            {currentView === 'lyrics' && (
              <LyricsView onNavigate={handleNavigate} />
            )}

            {currentView === 'settings' && (
              <SettingsView onNavigate={handleNavigate} />
            )}
          </div>
        </main>

        {/* Right Player & Queue Panel (Desktop Large Screens) */}
        <RightPlayerPanel
          onNavigate={handleNavigate}
          onOpenAddToPlaylist={handleOpenAddToPlaylist}
          className="hidden xl:flex"
        />
      </div>

      {/* Bottom Audio Player Bar */}
      <BottomPlayerBar onNavigate={handleNavigate} />

      {/* Mobile Navigation Tabs */}
      <MobileNav currentView={currentView} onNavigate={handleNavigate} />

      {/* Modals */}
      <AuthModal />

      <CreatePlaylistModal
        isOpen={createPlaylistOpen}
        onClose={() => setCreatePlaylistOpen(false)}
        onPlaylistCreated={handlePlaylistCreated}
      />

      <AddToPlaylistModal
        isOpen={addToPlaylistOpen}
        onClose={() => {
          setAddToPlaylistOpen(false);
          setTrackToAddToPlaylist(null);
        }}
        track={trackToAddToPlaylist}
        userPlaylists={userPlaylists}
        onOpenCreatePlaylist={() => {
          setAddToPlaylistOpen(false);
          setCreatePlaylistOpen(true);
        }}
        onRefreshPlaylists={() => setRefreshCounter(prev => prev + 1)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <AppContent />
      </PlayerProvider>
    </AuthProvider>
  );
}
