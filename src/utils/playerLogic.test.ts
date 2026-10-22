import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, formatCount, parseLyrics } from './formatters.ts';
import { getNextTrackIndex, getPreviousTrackIndex } from './playerLogic.ts';

test('formatTime converts seconds into mm:ss accurately', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(65), '1:05');
  assert.equal(formatTime(211), '3:31');
  assert.equal(formatTime(3605), '1:00:05');
});

test('formatCount formats numeric counts properly', () => {
  assert.equal(formatCount(950), '950');
  assert.equal(formatCount(1500), '1.5K');
  assert.equal(formatCount(525894736), '525.9M');
});

test('parseLyrics handles timestamped and plain lines', () => {
  const sample = `
    [00:15.30]First line of lyrics
    [01:02]Chorus kicks in
    Outro without timestamp
  `;
  const result = parseLyrics(sample);
  assert.equal(result.length, 3);
  assert.equal(result[0].text, 'First line of lyrics');
  assert.equal(result[0].time, 15.3);
  assert.equal(result[1].time, 62);
  assert.equal(result[2].text, 'Outro without timestamp');
  assert.equal(result[2].time, undefined);
});

test('getNextTrackIndex handles standard, repeat one, repeat all and bounds', () => {
  assert.equal(getNextTrackIndex(0, 3, 'off', false), 1);
  assert.equal(getNextTrackIndex(1, 3, 'off', false), 2);
  assert.equal(getNextTrackIndex(2, 3, 'off', false), null);
  assert.equal(getNextTrackIndex(2, 3, 'all', false), 0);
  assert.equal(getNextTrackIndex(1, 3, 'one', false), 1);
});

test('getPreviousTrackIndex restarts track if past 3 seconds', () => {
  assert.equal(getPreviousTrackIndex(2, 5, 10), 2);
  assert.equal(getPreviousTrackIndex(2, 5, 1.5), 1);
  assert.equal(getPreviousTrackIndex(0, 5, 1.5), 0);
});
