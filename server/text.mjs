const WORD_PATTERN = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu;
const SENTENCE_SEGMENTER = new Intl.Segmenter('nl-NL', {
  granularity: 'sentence',
});

export function normalizeWord(value) {
  return value.normalize('NFC').toLocaleLowerCase('nl-NL');
}

export function extractWords(paragraphs) {
  return paragraphs.flatMap((paragraph) => paragraph.match(WORD_PATTERN) || []);
}

export function extractUniqueWords(paragraphs) {
  return [...new Set(extractWords(paragraphs).map(normalizeWord))];
}

export function extractSentences(paragraphs) {
  const sentences = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    let sentenceIndex = 0;
    for (const { segment } of SENTENCE_SEGMENTER.segment(paragraph)) {
      const dutch = segment.trim();
      if (!dutch) continue;
      sentences.push({ paragraphIndex, sentenceIndex, dutch });
      sentenceIndex += 1;
    }
  });
  return sentences;
}

export function countWords(paragraphs) {
  return extractWords(paragraphs).length;
}

export function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

const READING_SPEEDS = {
  A0: 70,
  A1: 85,
  A2: 105,
  B1: 125,
  B2: 145,
  C1: 160,
};

export function estimateReadingMinutes(wordCount, level) {
  const speed = READING_SPEEDS[level] || READING_SPEEDS.A2;
  return Math.min(10, Math.max(1, Math.ceil(wordCount / speed)));
}
