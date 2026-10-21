/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ViewType, Playlist } from './types/music.ts';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { PlayerProvider, usePlayer } from './context/PlayerContext.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { Navbar } from './components/layout/Navbar.tsx';
import { RightPlayerPanel } from './components/layout/RightPlayerPanel.tsx';
import { BottomPlayerBar } from './components/layout/BottomPlayerBar.tsx';
import { MobileNav } from './components/layout/MobileNav.tsx';
import { AuthModal } from './components/modals/AuthModal.tsx';
import { CreatePlaylistModal } from './components/modals/CreatePlaylistModal.tsx';
import { HomeView } from './views/HomeView.tsx';
import { SearchView } from './views/SearchView.tsx';
import { LibraryView } from './views/LibraryView.tsx';
import { LikedSongsView } from './views/LikedSongsView.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import { LyricsView } from './views/LyricsView.tsx';
import { ArtistView } from './views/ArtistView.tsx';
import { PlaylistView } from './views/PlaylistView.tsx';
import { getUserPlaylists, testFirestoreConnection } from './services/firebase.ts';

function SoundWaveMain() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [viewPayload, setViewPayload] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);

  // Fetch user playlists from Firestore
  const fetchPlaylists = async () => {
    if (user) {
      try {
        const playlists = await getUserPlaylists(user.uid);
        setUserPlaylists(playlists);
      } catch (e) {
        console.warn('Playlists fetch notice:', e);
      }
    } else {
      setUserPlaylists([]);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, [user]);

  const handleNavigate = (view: ViewType, payload?: any) => {
    setCurrentView(view);
    setViewPayload(payload || null);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchSubmit = (query: string) => {
    setSearchQuery(query);
    handleNavigate('search', { query });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0c10] text-zinc-100 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Desktop Left Sidebar */}
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        userPlaylists={userPlaylists}
        onOpenCreatePlaylist={() => setCreatePlaylistOpen(true)}
        className="hidden md:flex"
      />

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-xs" 
            onClick={() => setMobileMenuOpen(false)}
          />
          <Sidebar
            currentView={currentView}
            onNavigate={handleNavigate}
            userPlaylists={userPlaylists}
            onOpenCreatePlaylist={() => {
              setMobileMenuOpen(false);
              setCreatePlaylistOpen(true);
            }}
            className="relative z-10 w-72 h-full shadow-2xl"
          />
        </div>
      )}

      {/* Center Main Stage */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0b0e14]">
        {/* Sticky Top Navbar */}
        <Navbar
          currentView={currentView}
          onNavigate={handleNavigate}
          onSearchSubmit={handleSearchSubmit}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
        />

        {/* Dynamic View Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-24 md:pb-8">
          {currentView === 'home' && (
            <HomeView 
              onNavigate={handleNavigate}
              onOpenCreatePlaylist={() => setCreatePlaylistOpen(true)}
            />
          )}

          {currentView === 'search' && (
            <SearchView 
              initialQuery={viewPayload?.query || searchQuery}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'library' && (
            <LibraryView 
              onNavigate={handleNavigate}
              userPlaylists={userPlaylists}
              onOpenCreatePlaylist={() => setCreatePlaylistOpen(true)}
              onRefreshPlaylists={fetchPlaylists}
            />
          )}

          {currentView === 'liked' && (
            <LikedSongsView 
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView 
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'lyrics' && (
            <LyricsView 
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'artist' && (
            <ArtistView 
              artistName={viewPayload?.name || 'Billie Eilish'}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'playlist' && (
            <PlaylistView 
              playlistId={viewPayload?.id || 'curated_discover'}
              initialPlaylist={viewPayload?.playlist}
              name={viewPayload?.name}
              onNavigate={handleNavigate}
              onRefreshPlaylists={fetchPlaylists}
            />
          )}
        </div>

        {/* Mobile / Tablet Bottom Player Bar */}
        <BottomPlayerBar 
          onNavigate={handleNavigate} 
          className="xl:hidden"
        />

        {/* Mobile Bottom Navigation */}
        <MobileNav 
          currentView={currentView}
          onNavigate={handleNavigate}
        />
      </main>

      {/* Desktop Right Player Panel (Matches Reference UI) */}
      <RightPlayerPanel 
        onNavigate={handleNavigate}
        className="hidden xl:flex"
      />

      {/* Modals */}
      <AuthModal />
      <CreatePlaylistModal
        isOpen={createPlaylistOpen}
        onClose={() => setCreatePlaylistOpen(false)}
        onPlaylistCreated={(newPl) => {
          setUserPlaylists(prev => [newPl, ...prev]);
          handleNavigate('playlist', { id: newPl.id, playlist: newPl, name: newPl.name });
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <SoundWaveMain />
      </PlayerProvider>
    </AuthProvider>
  );
}
