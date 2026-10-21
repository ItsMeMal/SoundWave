export interface BaseTrack {
  id: string;
  title: string;
  artist: string;
  duration?: number;
}

/**
 * Calculates next queue index based on shuffle, repeat mode, and current index
 */
export function getNextTrackIndex(
  currentIndex: number,
  queueLength: number,
  repeatMode: 'off' | 'all' | 'one',
  isShuffle: boolean,
  shuffledIndices?: number[]
): number | null {
  if (queueLength === 0) return null;
  if (repeatMode === 'one') return currentIndex;

  if (isShuffle && shuffledIndices && shuffledIndices.length === queueLength) {
    const posInShuffled = shuffledIndices.indexOf(currentIndex);
    if (posInShuffled >= 0 && posInShuffled < shuffledIndices.length - 1) {
      return shuffledIndices[posInShuffled + 1];
    }
    if (repeatMode === 'all') {
      return shuffledIndices[0];
    }
    return null;
  }

  if (currentIndex + 1 < queueLength) {
    return currentIndex + 1;
  }

  if (repeatMode === 'all') {
    return 0;
  }

  return null;
}

/**
 * Calculates previous track index
 */
export function getPreviousTrackIndex(
  currentIndex: number,
  queueLength: number,
  currentTime: number,
  shuffledIndices?: number[]
): number {
  if (queueLength === 0) return 0;
  // If track has been playing for more than 3 seconds, restart current track
  if (currentTime > 3) {
    return currentIndex;
  }

  if (shuffledIndices && shuffledIndices.length === queueLength) {
    const pos = shuffledIndices.indexOf(currentIndex);
    if (pos > 0) return shuffledIndices[pos - 1];
    return shuffledIndices[0];
  }

  if (currentIndex > 0) {
    return currentIndex - 1;
  }
  return 0;
}

/**
 * Generates a randomized index array for shuffle playback
 */
export function createShuffleIndices(length: number, currentFirstIndex: number = 0): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  // Remove current track
  const remaining = indices.filter(i => i !== currentFirstIndex);
  // Fisher-Yates shuffle on remaining
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }
  return [currentFirstIndex, ...remaining];
}
