import React from 'react';
import { Home, Search, Library } from 'lucide-react';
import { ViewType } from '../../types/music.ts';

interface MobileNavProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentView, onNavigate }) => {
  return (
    <nav 
      className="md:hidden bg-[#0c0f14]/95 backdrop-blur-lg border-t border-[#1a1f29] h-14 flex items-center justify-around select-none z-30"
      aria-label="Mobile Navigation"
    >
      <button
        onClick={() => onNavigate('home')}
        className={`flex flex-col items-center justify-center flex-1 h-full py-1 ${
          currentView === 'home' ? 'text-emerald-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <Home className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">Home</span>
      </button>

      <button
        onClick={() => onNavigate('search')}
        className={`flex flex-col items-center justify-center flex-1 h-full py-1 ${
          currentView === 'search' ? 'text-emerald-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <Search className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">Search</span>
      </button>

      <button
        onClick={() => onNavigate('library')}
        className={`flex flex-col items-center justify-center flex-1 h-full py-1 ${
          currentView === 'library' ? 'text-emerald-400 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <Library className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">Your Library</span>
      </button>
    </nav>
  );
};
