import {
  initializeStorage,
  listStories,
  loadStory,
  saveStory,
} from '../server/storage.mjs';
import { translateSentences } from '../server/translations.mjs';

await initializeStorage();
const summaries = await listStories();
const pending = [];

for (const summary of [...summaries].reverse()) {
  const story = await loadStory(summary.id);
  if (
    Array.isArray(story.sentenceTranslations) &&
    story.sentenceTranslations.length
  ) {
    continue;
  }
  pending.push(story);
}

if (!pending.length) {
  console.log('All saved texts already have sentence translations.');
}

for (const story of pending) {
  console.log(`Translating: ${story.title}`);
  story.sentenceTranslations = await translateSentences(story);
  story.schemaVersion = Math.max(2, Number(story.schemaVersion) || 1);
  story.generation = {
    ...story.generation,
    translationModel: 'gpt-5.6-luna',
    translationReasoning: 'low',
  };
  story.updatedAt = new Date().toISOString();
  await saveStory(story);
  console.log(`Saved ${story.sentenceTranslations.length} translations.`);
}
