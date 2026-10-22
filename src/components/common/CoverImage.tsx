import React, { useState } from 'react';
import { Music } from 'lucide-react';

interface CoverImageProps {
  src?: string;
  alt?: string;
  videoId?: string;
  className?: string;
  iconSize?: string;
}

export const CoverImage: React.FC<CoverImageProps> = ({
  src,
  alt = '',
  videoId,
  className = '',
  iconSize = 'w-1/2 h-1/2'
}) => {
  const [hasError, setHasError] = useState(false);
  const [triedYtFallback, setTriedYtFallback] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(src);

  const handleError = () => {
    if (videoId && !triedYtFallback && currentSrc && !currentSrc.includes('i.ytimg.com')) {
      setTriedYtFallback(true);
      setCurrentSrc(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
    } else {
      setHasError(true);
    }
  };

  if (hasError || !currentSrc) {
    return (
      <div 
        className={`flex items-center justify-center bg-[#181d26] border border-white/5 text-zinc-500 shrink-0 select-none ${className}`}
        aria-hidden="true"
      >
        <Music className={`${iconSize} text-zinc-600`} />
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      onError={handleError}
      loading="lazy"
      className={`object-cover bg-[#161a22] shrink-0 ${className}`}
    />
  );
};
