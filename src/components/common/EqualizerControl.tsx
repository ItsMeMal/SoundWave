import React from 'react';
import { AudioLines, Info, Waves } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext.tsx';
import { EqualizerPreset } from '../../context/PlayerContext.tsx';

const presets: EqualizerPreset[] = ['Off', 'Flat', 'Bass Boost', 'Pop', 'Rock', 'Vocal', 'Treble'];
const labels = ['60 Hz', '170 Hz', '350 Hz', '1 kHz', '3.5 kHz', '10 kHz'];

export const EqualizerControl: React.FC = () => {
  const { equalizerPreset, equalizerBands, setEqualizerPreset, setEqualizerBand } = usePlayer();

  return (
    <section className="bg-[#121620] rounded-xl border border-[#1e2432] p-5 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-center">
          <AudioLines className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Audio Equalizer</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Shape bass, mids, and treble with six frequency bands.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {presets.map(preset => (
          <button
            key={preset}
            type="button"
            onClick={() => setEqualizerPreset(preset)}
            aria-pressed={equalizerPreset === preset}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
              equalizerPreset === preset
                ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-300'
                : 'bg-[#181d2a] border-[#252c3c] text-zinc-400 hover:text-white hover:border-zinc-600'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {labels.map((label, index) => (
          <label key={label} className="flex flex-col items-center gap-2 rounded-xl bg-[#181d2a]/70 border border-white/[0.04] p-3">
            <span className="text-[10px] font-semibold text-zinc-400">{label}</span>
            <span className="text-xs font-mono text-emerald-300">{equalizerBands[index] > 0 ? '+' : ''}{equalizerBands[index]} dB</span>
            <input
              aria-label={`${label} equalizer gain`}
              type="range"
              min={-12}
              max={12}
              step={1}
              value={equalizerBands[index] ?? 0}
              onChange={event => setEqualizerBand(index, Number(event.target.value))}
              className="h-28 w-5 cursor-pointer accent-emerald-400"
              style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
            />
          </label>
        ))}
      </div>

      <p className="mt-4 flex gap-2 text-[11px] leading-relaxed text-zinc-500">
        <Waves className="h-4 w-4 shrink-0 text-emerald-400/70" />
        Changes apply to direct audio streams. If SoundWave falls back to the YouTube player because a source blocks browser audio processing, the equalizer cannot affect that fallback.
      </p>
      <p className="mt-2 flex gap-2 text-[11px] leading-relaxed text-zinc-500">
        <Info className="h-4 w-4 shrink-0" />
        The first non-flat preset may reload the active direct stream so the browser can route it through its audio processor.
      </p>
    </section>
  );
};
