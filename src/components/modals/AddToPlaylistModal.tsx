import React, { useEffect, useState } from 'react';
import { X, Plus, Check, Music2, Loader2 } from 'lucide-react';
import { Track, Playlist } from '../../types/music.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { addTrackToUserPlaylist } from '../../services/firebase.ts';
import { useToast } from '../../context/ToastContext.tsx';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  userPlaylists: Playlist[];
  onOpenCreatePlaylist: () => void;
  onRefreshPlaylists: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  track,
  userPlaylists,
  onOpenCreatePlaylist,
  onRefreshPlaylists,
}) => {
  const { user, openAuthModal } = useAuth();
  const { notify } = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Optimistic "Added" state belongs only to the current track/modal session.
  // Without this reset, adding one track disables that playlist for every later track
  // until the whole page is refreshed.
  useEffect(() => {
    setAddedIds(new Set());
    setSavingId(null);
  }, [track?.id, isOpen]);

  if (!isOpen || !track) return null;

  const handleAddToPlaylist = async (playlist: Playlist) => {
    if (!user) {
      onClose();
      openAuthModal('login');
      return;
    }

    setSavingId(playlist.id);
    try {
      const result = await addTrackToUserPlaylist(user.uid, playlist.id, track);
      setAddedIds(prev => new Set(prev).add(playlist.id));
      onRefreshPlaylists();
      if (result.alreadyPresent) {
        notify({ variant: 'info', title: 'Already in playlist', description: `“${track.title}” is already in “${playlist.name}”.` });
      } else if (!result.sharedLinkUpdated) {
        notify({
          variant: 'warning',
          title: 'Song added, share link not updated',
          description: `“${track.title}” was added to “${playlist.name}”, but its public link could not be synced.`,
        });
      } else {
        notify({ variant: 'success', title: 'Added to playlist', description: `“${track.title}” was added to “${playlist.name}”.` });
      }
      setTimeout(() => {
        setSavingId(null);
      }, 500);
    } catch (e) {
      console.warn('Failed to add to playlist:', e);
      const detail = e instanceof Error ? e.message : 'Unexpected Firebase error.';
      notify({
        variant: 'error',
        title: 'Could not add to playlist',
        description: detail.includes('permission') || detail.includes('insufficient')
          ? 'Firestore denied this change. Confirm the latest firestore.rules are published to the same database SoundWave uses.'
          : detail,
      });
      setSavingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm bg-[#131720] border border-[#222838] rounded-2xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-full bg-zinc-800"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-base font-bold text-white mb-1">Add to Playlist</h3>
        <p className="text-xs text-zinc-400 truncate mb-4">
          Select a playlist for <span className="text-emerald-400 font-semibold">"{track.title}"</span>
        </p>

        {/* Playlists List */}
        <div className="max-h-64 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
          {userPlaylists.map((pl) => {
            const isAdded = addedIds.has(pl.id) || pl.tracks?.some(t => t.id === track.id);
            const isSaving = savingId === pl.id;

            return (
              <button
                key={pl.id}
                onClick={() => handleAddToPlaylist(pl)}
                disabled={isSaving || isAdded}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-colors text-left group ${
                  isAdded ? 'bg-emerald-500/10 border border-emerald-500/20' : 'hover:bg-[#1a202c]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={pl.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&q=80'}
                    alt={pl.name}
                    className="w-9 h-9 rounded-lg object-cover bg-zinc-800 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${isAdded ? 'text-emerald-400' : 'text-white'}`}>
                      {pl.name}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {pl.trackCount} {pl.trackCount === 1 ? 'song' : 'songs'}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pl-2">
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                  ) : isAdded ? (
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Added
                    </span>
                  ) : (
                    <Plus className="w-4 h-4 text-zinc-400 group-hover:text-white" />
                  )}
                </div>
              </button>
            );
          })}

          {userPlaylists.length === 0 && (
            <div className="py-6 text-center text-zinc-500 space-y-2">
              <Music2 className="w-8 h-8 mx-auto text-zinc-600" />
              <p className="text-xs">You don't have any playlists yet.</p>
            </div>
          )}
        </div>

        {/* CTA to Create New Playlist */}
        <div className="mt-4 pt-3 border-t border-zinc-800">
          <button
            onClick={() => {
              onClose();
              onOpenCreatePlaylist();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Create New Playlist</span>
          </button>
        </div>
      </div>
    </div>
  );
};
