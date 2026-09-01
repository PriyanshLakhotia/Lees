import path from 'node:path';

import { SCHEMAS_DIRECTORY } from './config.mjs';
import { runCodex } from './codex.mjs';
import { buildSentenceTranslationPrompt } from './prompts.mjs';
import { chunk, extractSentences } from './text.mjs';

function sentenceKey(sentence) {
  return `${sentence.paragraphIndex}:${sentence.sentenceIndex}`;
}

async function translateChunk(story, sentences) {
  const requestTranslations = async (targetSentences) => {
    const prompt = await buildSentenceTranslationPrompt(story, targetSentences);
    return runCodex({
      prompt,
      model: 'gpt-5.6-luna',
      effort: 'low',
      schemaPath: path.join(
        SCHEMAS_DIRECTORY,
        'sentence-translations.schema.json',
      ),
      timeoutMs: 5 * 60 * 1000,
    });
  };

  const first = await requestTranslations(sentences);
  const received = new Map(
    (Array.isArray(first.entries) ? first.entries : []).map((entry) => [
      sentenceKey(entry),
      entry,
    ]),
  );
  const missing = sentences.filter(
    (sentence) =>
      !String(received.get(sentenceKey(sentence))?.english || '').trim(),
  );

  if (missing.length) {
    const repair = await requestTranslations(missing);
    for (const entry of Array.isArray(repair.entries) ? repair.entries : []) {
      received.set(sentenceKey(entry), entry);
    }
  }

  return sentences.map((sentence) => {
    const english = String(
      received.get(sentenceKey(sentence))?.english || '',
    ).trim();
    if (!english) {
      throw new Error(
        `Sentence translation was incomplete at paragraph ${sentence.paragraphIndex + 1}, sentence ${sentence.sentenceIndex + 1}.`,
      );
    }
    return { ...sentence, english };
  });
}

export async function translateSentences(story) {
  const sentences = extractSentences(story.paragraphs);
  const translatedChunks = await Promise.all(
    chunk(sentences, 100).map((sentenceChunk) =>
      translateChunk(story, sentenceChunk),
    ),
  );
  return translatedChunks.flat();
}
