import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { PlayerProvider } from './context/PlayerContext.tsx';
import { ViewType, Playlist, Track } from './types/music.ts';
import { subscribeUserPlaylists, getSharedPlaylist } from './services/firebase.ts';

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
import { ListeningStatsView } from './views/ListeningStatsView.tsx';

// Modals
import { AuthModal } from './components/modals/AuthModal.tsx';
import { CreatePlaylistModal } from './components/modals/CreatePlaylistModal.tsx';
import { AddToPlaylistModal } from './components/modals/AddToPlaylistModal.tsx';
import { ToastProvider, useToast } from './context/ToastContext.tsx';
import { PWAInstallPrompt } from './components/common/PWAInstallPrompt.tsx';

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useToast();

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

  // Resolve unlisted public share links without requiring the recipient to sign in.
  useEffect(() => {
    const initialUrl = new URL(window.location.href);
    const shareId = initialUrl.searchParams.get('share');
    if (!shareId) return;

    let cancelled = false;
    setCurrentView('playlist');
    setNavPayload({ playlistId: '', name: 'Shared playlist', isShared: true, shareLoading: true });

    const cleanInvalidShareParam = () => {
      const invalidUrl = new URL(window.location.href);
      invalidUrl.searchParams.delete('share');
      window.history.replaceState({}, '', `${invalidUrl.pathname}${invalidUrl.search}${invalidUrl.hash}`);
    };

    void getSharedPlaylist(shareId).then(sharedPlaylist => {
      if (cancelled) return;
      if (!sharedPlaylist) {
        setCurrentView('home');
        setNavPayload({});
        cleanInvalidShareParam();
        notify({
          variant: 'error',
          title: 'Shared playlist unavailable',
          description: 'The link may be invalid or its owner has disabled sharing.',
        });
        return;
      }

      setNavPayload({
        playlistId: sharedPlaylist.id,
        initialPlaylist: sharedPlaylist,
        name: sharedPlaylist.name,
        isShared: true,
        shareLoading: false,
      });
      setCurrentView('playlist');
    }).catch(error => {
      if (cancelled) return;
      setCurrentView('home');
      setNavPayload({});
      cleanInvalidShareParam();
      notify({
        variant: 'error',
        title: 'Could not open shared playlist',
        description: 'Check the link and make sure the updated Firestore sharing rules have been published.',
      });
      console.warn('[SoundWave] Shared playlist load failed:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [notify]);

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
                isShared={Boolean(navPayload.isShared)}
                shareLoading={Boolean(navPayload.shareLoading)}
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

            {currentView === 'stats' && (
              <ListeningStatsView onNavigate={handleNavigate} />
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

      {/* Install prompt appears only when the browser reports that installation is available. */}
      <PWAInstallPrompt />

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
    <ToastProvider>
      <AuthProvider>
        <PlayerProvider>
          <AppContent />
        </PlayerProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
