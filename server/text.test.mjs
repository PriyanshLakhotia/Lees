import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countWords,
  estimateReadingMinutes,
  extractSentences,
  extractUniqueWords,
  normalizeWord,
} from './text.mjs';

test('normalizes Dutch words without losing diacritics', () => {
  assert.equal(normalizeWord('ÉÉN'), 'één');
  assert.equal(normalizeWord('Trein'), 'trein');
});

test('extracts unique words and preserves compounds', () => {
  const words = extractUniqueWords([
    'De trein rijdt. De fiets-bel staat stil.',
  ]);
  assert.deepEqual(words, [
    'de',
    'trein',
    'rijdt',
    'fiets-bel',
    'staat',
    'stil',
  ]);
  assert.equal(countWords(['De trein rijdt. De trein stopt.']), 6);
});

test('reading time is level-sensitive and capped at ten minutes', () => {
  assert.equal(estimateReadingMinutes(140, 'A0'), 2);
  assert.equal(estimateReadingMinutes(140, 'C1'), 1);
  assert.equal(estimateReadingMinutes(10_000, 'A2'), 10);
});

test('segments Dutch paragraphs into indexed complete sentences', () => {
  assert.deepEqual(
    extractSentences([
      'Rood betekent: stop. Ga daarna door.',
      'Er staat: “Fietsers vrij”. Dat is duidelijk.',
    ]),
    [
      { paragraphIndex: 0, sentenceIndex: 0, dutch: 'Rood betekent: stop.' },
      { paragraphIndex: 0, sentenceIndex: 1, dutch: 'Ga daarna door.' },
      {
        paragraphIndex: 1,
        sentenceIndex: 0,
        dutch: 'Er staat: “Fietsers vrij”.',
      },
      { paragraphIndex: 1, sentenceIndex: 1, dutch: 'Dat is duidelijk.' },
    ],
  );
});
