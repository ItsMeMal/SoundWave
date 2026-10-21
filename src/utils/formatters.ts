/**
 * Formats duration in seconds into 'm:ss' or 'h:mm:ss'
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Returns dynamic greeting based on current local hour
 */
export function getGreeting(hour: number = new Date().getHours()): string {
  if (hour >= 4 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 22) return 'Good evening';
  return 'Good night';
}

/**
 * Formats large view or listener counts (e.g. 1540000 -> "1.5M")
 */
export function formatCount(count: number): string {
  if (isNaN(count) || count < 0) return '0';
  if (count >= 1_000_000_000) {
    return (count / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (count >= 1_000_000) {
    return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1_000) {
    return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toString();
}

/**
 * Parses raw lyrics into structured timestamped or plain lines
 */
export interface LyricLine {
  time?: number;
  text: string;
}

export function parseLyrics(rawLyrics: string): LyricLine[] {
  if (!rawLyrics) return [];
  const lines = rawLyrics.split('\n');
  const result: LyricLine[] = [];

  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(timeRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millis = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      const timeInSec = minutes * 60 + seconds + millis / 1000;
      const text = trimmed.replace(timeRegex, '').trim();
      if (text) {
        result.push({ time: timeInSec, text });
      }
    } else {
      result.push({ text: trimmed });
    }
  }

  return result;
}
