import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone, CheckCircle2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setShowPrompt(false);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt || installing) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === 'accepted') setShowPrompt(false);
    } catch (error) {
      console.warn('[SoundWave] PWA installation prompt failed:', error);
    } finally {
      setInstallPrompt(null);
      setInstalling(false);
      setShowPrompt(false);
    }
  };

  if (!showPrompt || !installPrompt || installed) return null;

  return (
    <aside
      role="dialog"
      aria-label="Install SoundWave"
      className="fixed bottom-24 left-4 z-[80] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#151922]/95 p-4 text-white shadow-2xl shadow-black/40 backdrop-blur-xl sm:bottom-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold">Install SoundWave</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Add the app to your device for a faster, app-like experience.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPrompt(false)}
          className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Installable PWA
        </span>
        <button
          type="button"
          onClick={() => void handleInstall()}
          disabled={installing}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-emerald-300 disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          {installing ? 'Opening…' : 'Install app'}
        </button>
      </div>
    </aside>
  );
};
