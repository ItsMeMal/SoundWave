import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, Clock3, Headphones, LoaderCircle, Music2, ShieldAlert, Users } from 'lucide-react';
import { ViewType, ListeningSession } from '../types/music.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { getUserIsAdmin, subscribeAdminListeningSessions } from '../services/firebase.ts';

interface ListeningStatsViewProps {
  onNavigate: (view: ViewType, payload?: any) => void;
}

function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

export const ListeningStatsView: React.FC<ListeningStatsViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [access, setAccess] = useState<'checking' | 'admin' | 'denied' | 'signed-out'>('checking');
  const [sessions, setSessions] = useState<ListeningSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setAccess('signed-out');
      setLoading(false);
      return;
    }
    setAccess('checking');
    void getUserIsAdmin(user.uid).then(isAdmin => {
      if (!cancelled) {
        setAccess(isAdmin ? 'admin' : 'denied');
        setLoading(!isAdmin);
      }
    }).catch(() => {
      if (!cancelled) {
        setAccess('denied');
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (access !== 'admin') return;
    setLoading(true);
    const unsubscribe = subscribeAdminListeningSessions(items => {
      setSessions(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [access]);

  const stats = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = sessions.filter(session => {
      const timestamp = Date.parse(session.startedAt);
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    });
    const tracks = new Map<string, { title: string; artist: string; thumbnailUrl: string; seconds: number; plays: number }>();
    const artists = new Map<string, { artist: string; seconds: number; plays: number }>();
    for (const session of sessions) {
      const trackKey = session.videoId || session.id;
      const seconds = Math.max(0, Number(session.secondsListened) || 0);
      const current = tracks.get(trackKey) || {
        title: session.title || 'Unknown track',
        artist: session.artist || 'Unknown artist',
        thumbnailUrl: session.thumbnailUrl || '',
        seconds: 0,
        plays: 0,
      };
      current.seconds += seconds;
      current.plays += 1;
      tracks.set(trackKey, current);

      const artistKey = (session.artist || 'Unknown artist').trim().toLowerCase();
      const artist = artists.get(artistKey) || { artist: session.artist || 'Unknown artist', seconds: 0, plays: 0 };
      artist.seconds += seconds;
      artist.plays += 1;
      artists.set(artistKey, artist);
    }
    return {
      totalSeconds: sessions.reduce((sum, session) => sum + Math.max(0, Number(session.secondsListened) || 0), 0),
      recentSeconds: recent.reduce((sum, session) => sum + Math.max(0, Number(session.secondsListened) || 0), 0),
      recentSessions: recent.length,
      uniqueListeners: new Set(recent.map(session => session.userId)).size,
      topTracks: [...tracks.values()].sort((a, b) => b.seconds - a.seconds).slice(0, 8),
      topArtists: [...artists.values()].sort((a, b) => b.seconds - a.seconds).slice(0, 8),
    };
  }, [sessions]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 max-w-6xl mx-auto w-full">
      <button onClick={() => onNavigate('settings')} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-6 group">
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to Settings
      </button>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-emerald-300">SoundWave / Admin</p>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-2">Listening Analytics</h1>
          <p className="text-sm text-zinc-400 mt-1">Platform-level listening activity, top tracks, and artist trends.</p>
        </div>
        {access === 'admin' && <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"><ShieldAlert className="w-4 h-4" /> Admin access</span>}
      </div>

      {access === 'checking' || loading ? (
        <div className="py-20 flex flex-col items-center gap-3 text-zinc-400">
          <LoaderCircle className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-sm">Checking access and loading analytics…</p>
        </div>
      ) : access !== 'admin' ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-6 md:p-8">
          <ShieldAlert className="h-8 w-8 text-amber-300 mb-4" />
          <h2 className="text-lg font-bold text-white">{access === 'signed-out' ? 'Sign in required' : 'Admin access required'}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Only accounts explicitly marked with <code className="text-zinc-200">admin: true</code> in their Firestore user profile can view platform-wide analytics. This flag cannot be assigned from the client app; a project owner must set it in Firebase Console.
          </p>
          {!user && <p className="mt-3 text-xs text-zinc-500">Sign in to check your account role.</p>}
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-400">Aggregates from the latest {sessions.length} stored listening sessions.</p>
            {sessions.length === 2000 && <p className="text-[11px] text-amber-300">Showing the latest 2,000 sessions.</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Listen time · all loaded sessions', value: formatMinutes(stats.totalSeconds), icon: Clock3 },
              { label: 'Listen time · last 30 days', value: formatMinutes(stats.recentSeconds), icon: Headphones },
              { label: 'Listening sessions · last 30 days', value: stats.recentSessions.toLocaleString(), icon: BarChart3 },
              { label: 'Listeners · last 30 days', value: stats.uniqueListeners.toLocaleString(), icon: Users },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-[#1e2432] bg-[#121620] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs leading-relaxed text-zinc-400">{item.label}</span>
                  <item.icon className="h-4 w-4 text-emerald-300" />
                </div>
                <p className="mt-4 text-2xl font-black text-white">{item.value}</p>
              </div>
            ))}
          </div>

          {sessions.length === 0 ? (
            <div className="rounded-2xl border border-[#1e2432] bg-[#121620] p-10 text-center">
              <BarChart3 className="mx-auto h-10 w-10 text-zinc-600" />
              <h2 className="mt-4 text-base font-bold text-white">Analytics will appear as music is played</h2>
              <p className="mt-2 text-sm text-zinc-400">Listening sessions start collecting after this feature is deployed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <section className="rounded-2xl border border-[#1e2432] bg-[#121620] p-5">
                <h2 className="flex items-center gap-2 text-base font-bold text-white mb-4"><Music2 className="h-4 w-4 text-emerald-300" /> Top tracks</h2>
                <div className="space-y-2">
                  {stats.topTracks.map((track, index) => (
                    <div key={`${track.title}-${index}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/[0.03]">
                      <span className="w-5 text-xs font-mono text-zinc-500">{index + 1}</span>
                      {track.thumbnailUrl ? <img src={track.thumbnailUrl} alt="" className="h-10 w-10 rounded-lg object-cover bg-zinc-800" /> : <div className="h-10 w-10 rounded-lg bg-zinc-800" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{track.title}</p>
                        <p className="truncate text-xs text-zinc-400">{track.artist} · {track.plays} sessions</p>
                      </div>
                      <span className="text-xs font-mono text-emerald-300">{formatMinutes(track.seconds)}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-2xl border border-[#1e2432] bg-[#121620] p-5">
                <h2 className="flex items-center gap-2 text-base font-bold text-white mb-4"><Users className="h-4 w-4 text-emerald-300" /> Top artists</h2>
                <div className="space-y-2">
                  {stats.topArtists.map((artist, index) => (
                    <div key={artist.artist} className="flex items-center gap-3 rounded-xl p-3 hover:bg-white/[0.03]">
                      <span className="w-5 text-xs font-mono text-zinc-500">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{artist.artist}</p>
                        <p className="text-xs text-zinc-400">{artist.plays} sessions</p>
                      </div>
                      <span className="text-xs font-mono text-emerald-300">{formatMinutes(artist.seconds)}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
};
