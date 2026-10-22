import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, LoaderCircle, ShieldCheck, Share2, Unlink, X } from 'lucide-react';
import { Playlist } from '../../types/music.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { createOrUpdateSharedPlaylist, revokeSharedPlaylistLink } from '../../services/firebase.ts';
import { ConfirmDialog } from '../common/ConfirmDialog.tsx';

interface SharePlaylistModalProps {
  isOpen: boolean;
  playlist: Playlist | null;
  onClose: () => void;
  onShareChange: (shareId?: string) => void;
}

export const SharePlaylistModal: React.FC<SharePlaylistModalProps> = ({
  isOpen, playlist, onClose, onShareChange,
}) => {
  const { user } = useAuth();
  const { notify } = useToast();
  const [shareId, setShareId] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setShareId(playlist?.shareId || '');
      setConfirmRevoke(false);
    }
  }, [isOpen, playlist?.id, playlist?.shareId]);

  const shareUrl = shareId && typeof window !== 'undefined'
    ? `${window.location.origin}/?share=${encodeURIComponent(shareId)}`
    : '';

  const handleCreateLink = async () => {
    if (!user || !playlist || busy) return;
    setBusy(true);
    try {
      const id = await createOrUpdateSharedPlaylist(user.uid, playlist.id, user.displayName || 'SoundWave listener');
      setShareId(id);
      onShareChange(id);
      const url = `${window.location.origin}/?share=${encodeURIComponent(id)}`;
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        // The generated URL remains visible and can be copied manually.
      }
      notify({
        variant: 'success',
        title: 'Share link ready',
        description: copied ? 'The link was copied to your clipboard.' : 'Your link is ready below. Copy it to share the playlist.',
      });
    } catch (error) {
      notify({
        variant: 'error',
        title: 'Could not create share link',
        description: error instanceof Error ? error.message : 'Check your connection and publish the sharing rules in Firebase.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      notify({ variant: 'success', title: 'Link copied', description: 'Send it to anyone you want to share this playlist with.' });
    } catch {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
      notify({ variant: 'info', title: 'Copy the selected link', description: 'Your browser blocked clipboard access. Press Ctrl+C or copy from the selected field.' });
    }
  };

  const handleSystemShare = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: playlist?.name || 'SoundWave playlist',
          text: 'Listen to this playlist on SoundWave',
          url: shareUrl,
        });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          notify({ variant: 'error', title: 'Could not open sharing', description: error.message });
        }
      }
      return;
    }
    await handleCopyLink();
  };

  const handleRevoke = async () => {
    if (!user || !playlist || busy) return;
    setBusy(true);
    try {
      await revokeSharedPlaylistLink(user.uid, playlist.id);
      setShareId('');
      setConfirmRevoke(false);
      onShareChange(undefined);
      notify({
        variant: 'success',
        title: 'Sharing disabled',
        description: 'The public link has been revoked and can no longer open this playlist.',
      });
    } catch (error) {
      notify({
        variant: 'error',
        title: 'Could not disable sharing',
        description: error instanceof Error ? error.message : 'Check your connection and try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen || !playlist) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[85] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        onMouseDown={event => {
          if (event.target === event.currentTarget && !busy) onClose();
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-playlist-title"
          className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#121720] shadow-2xl shadow-black/50"
        >
          <div className="flex items-start gap-3 border-b border-white/5 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
              <Share2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="share-playlist-title" className="text-base font-bold text-white">Share playlist</h2>
              <p className="mt-1 truncate text-xs text-zinc-400">{playlist.name}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
              aria-label="Close share playlist dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div className="flex gap-3 rounded-xl border border-sky-400/15 bg-sky-400/[0.06] p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
              <p className="text-xs leading-relaxed text-zinc-300">
                Anyone with the link can view and play this playlist. Your other playlists and account details stay private.
              </p>
            </div>

            {shareUrl ? (
              <>
                <label htmlFor="share-playlist-url" className="block text-[11px] font-semibold text-zinc-400">Share link</label>
                <div className="flex gap-2">
                  <input
                    ref={linkInputRef}
                    id="share-playlist-url"
                    type="url"
                    readOnly
                    value={shareUrl}
                    onFocus={event => event.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-zinc-200 outline-none focus:border-emerald-400/50"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCopyLink()}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-400 px-3 py-2.5 text-xs font-bold text-black transition-colors hover:bg-emerald-300"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSystemShare()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/5"
                  >
                    <ExternalLink className="h-4 w-4" /> Share…
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRevoke(true)}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/15 px-3 py-2.5 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-400/10 disabled:opacity-50"
                  >
                    <Unlink className="h-4 w-4" /> Disable link
                  </button>
                </div>
                <p className="flex items-center gap-2 text-[11px] text-emerald-300/80">
                  <Check className="h-3.5 w-3.5" /> This link updates when you add or remove tracks.
                </p>
              </>
            ) : (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-zinc-400">
                  <Link2 className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-white">Create a share link</p>
                <p className="mt-1 text-xs text-zinc-500">Create an unlisted link. Only people with the link can open it.</p>
                <button
                  type="button"
                  onClick={() => void handleCreateLink()}
                  disabled={busy}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-black transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  {busy ? 'Creating link…' : 'Create share link'}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        isOpen={confirmRevoke}
        title="Disable this share link?"
        description="Anyone with the current link will lose access. You can create a new link later."
        confirmLabel="Disable link"
        isLoading={busy}
        onConfirm={handleRevoke}
        onCancel={() => {
          if (!busy) setConfirmRevoke(false);
        }}
      />
    </>
  );
};
