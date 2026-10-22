import React, { useState } from 'react';
import { Check, Clock3, Moon, Timer, X } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext.tsx';
import { formatTime } from '../../utils/formatters.ts';

interface SleepTimerControlProps {
  className?: string;
}

const PRESETS = [5, 10, 15, 30, 45, 60];

export const SleepTimerControl: React.FC<SleepTimerControlProps> = ({ className = '' }) => {
  const {
    sleepTimerRemainingSeconds,
    sleepTimerEndOfTrack,
    scheduleSleepTimer,
    scheduleSleepTimerEndOfTrack,
    cancelSleepTimer,
  } = usePlayer();
  const [open, setOpen] = useState(false);
  const timerActive = sleepTimerRemainingSeconds !== null || sleepTimerEndOfTrack;

  const statusLabel = sleepTimerEndOfTrack
    ? 'At end of track'
    : sleepTimerRemainingSeconds !== null
      ? formatTime(sleepTimerRemainingSeconds)
      : 'Off';

  return (
    <div className={`relative z-30 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
          timerActive
            ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
            : 'border-white/[0.07] bg-white/[0.025] text-zinc-300 hover:border-white/10 hover:bg-white/[0.05] hover:text-white'
        }`}
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
          timerActive
            ? 'border-emerald-400/20 bg-emerald-400/10'
            : 'border-white/5 bg-white/[0.04] text-zinc-400'
        }`}>
          {timerActive ? <Moon className="h-4 w-4" /> : <Timer className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold">Sleep timer</span>
          <span className={`mt-0.5 block text-[11px] ${timerActive ? 'text-emerald-300/80' : 'text-zinc-500'}`}>
            {timerActive ? statusLabel : 'Stop playback automatically'}
          </span>
        </span>
        <Clock3 className={`h-4 w-4 shrink-0 ${timerActive ? 'text-emerald-300' : 'text-zinc-500'}`} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Sleep timer settings"
          className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-white/10 bg-[#111720]/[0.99] p-4 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">Sleep timer</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                Pause your music after a set time or when this track ends.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Close sleep timer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Pause after</p>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map(minutes => (
              <button
                type="button"
                key={minutes}
                onClick={() => {
                  scheduleSleepTimer(minutes);
                  setOpen(false);
                }}
                className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-2 py-2.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-300"
              >
                {minutes} min
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              scheduleSleepTimerEndOfTrack();
              setOpen(false);
            }}
            className={`mt-2 flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
              sleepTimerEndOfTrack
                ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                : 'border-white/[0.07] bg-white/[0.025] text-zinc-200 hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <Moon className="h-4 w-4" />
              At the end of this track
            </span>
            {sleepTimerEndOfTrack && <Check className="h-4 w-4" />}
          </button>

          {timerActive && (
            <button
              type="button"
              onClick={() => {
                cancelSleepTimer();
                setOpen(false);
              }}
              className="mt-3 w-full rounded-xl border border-rose-400/15 px-3 py-2.5 text-xs font-semibold text-rose-300 transition-colors hover:border-rose-400/30 hover:bg-rose-400/10"
            >
              Cancel sleep timer
            </button>
          )}
        </div>
      )}
    </div>
  );
};
