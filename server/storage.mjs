import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { LIBRARY_PATH, STORIES_DIRECTORY } from './config.mjs';

const EMPTY_LIBRARY = { schemaVersion: 1, stories: [] };
let mutationQueue = Promise.resolve();

function storyDirectory(id) {
  if (!/^[a-z0-9][a-z0-9-]{5,100}$/.test(id)) {
    throw new Error('Invalid story identifier.');
  }
  return path.join(STORIES_DIRECTORY, id);
}

async function atomicWrite(filePath, contents) {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, contents, 'utf8');
  await rename(temporaryPath, filePath);
}

function withMutationLock(action) {
  const result = mutationQueue.then(action, action);
  mutationQueue = result.catch(() => {});
  return result;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw error;
  }
}

function asSummary(story) {
  return {
    id: story.id,
    title: story.title,
    subtitle: story.subtitle,
    summaryEnglish: story.summaryEnglish,
    type: story.request.type,
    topic: story.request.topic,
    genre: story.request.genre,
    level: story.request.level,
    length: story.request.length,
    readingMinutes: story.readingMinutes,
    wordCount: story.wordCount,
    createdAt: story.createdAt,
    read: story.state.read,
    favourite: story.state.favourite,
    hasNotes: Boolean(story.state.notes.trim()),
  };
}

function quoteYaml(value) {
  return JSON.stringify(value ?? '');
}

function storyMarkdown(story) {
  const sourceLines = story.sources.length
    ? story.sources.map(
        (source) =>
          `- [${source.title}](${source.url}) — ${source.publisher}${source.publishedAt ? `, ${source.publishedAt}` : ''}`,
      )
    : ['- None (original fiction)'];
  const usefulWords = Object.values(story.annotations)
    .filter((entry) => entry.difficulty !== 'common')
    .slice(0, 40)
    .map((entry) => `- **${entry.word}** (${entry.lemma}) — ${entry.meaning}`);
  const sentenceTranslations = Array.isArray(story.sentenceTranslations)
    ? story.sentenceTranslations.map(
        (entry) => `- ${entry.dutch}\n  - ${entry.english}`,
      )
    : [];

  return `---
id: ${quoteYaml(story.id)}
title: ${quoteYaml(story.title)}
level: ${quoteYaml(story.request.level)}
type: ${quoteYaml(story.request.type)}
topic: ${quoteYaml(story.request.topic)}
length: ${quoteYaml(story.request.length)}
createdAt: ${quoteYaml(story.createdAt)}
read: ${story.state.read}
favourite: ${story.state.favourite}
---

# ${story.title}

_${story.subtitle}_

${story.paragraphs.join('\n\n')}

## Sentence translations

${sentenceTranslations.length ? sentenceTranslations.join('\n') : '- Not available.'}

## Sources

${sourceLines.join('\n')}

## Selected vocabulary

${usefulWords.length ? usefulWords.join('\n') : '- No words marked above common difficulty.'}

## Personal notes

${story.state.notes || '_No notes yet._'}
`;
}

export async function initializeStorage() {
  await mkdir(STORIES_DIRECTORY, { recursive: true });
  try {
    await readFile(LIBRARY_PATH, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await atomicWrite(
      LIBRARY_PATH,
      `${JSON.stringify(EMPTY_LIBRARY, null, 2)}\n`,
    );
  }
}

export async function listStories() {
  const library = await readJson(LIBRARY_PATH, EMPTY_LIBRARY);
  return library.stories;
}

export async function loadStory(id) {
  return readJson(path.join(storyDirectory(id), 'story.json'));
}

export async function saveStory(story) {
  return withMutationLock(async () => {
    const directory = storyDirectory(story.id);
    await mkdir(directory, { recursive: true });
    await atomicWrite(
      path.join(directory, 'request.json'),
      `${JSON.stringify(story.request, null, 2)}\n`,
    );
    await atomicWrite(
      path.join(directory, 'story.json'),
      `${JSON.stringify(story, null, 2)}\n`,
    );
    await atomicWrite(path.join(directory, 'story.md'), storyMarkdown(story));

    const library = await readJson(LIBRARY_PATH, EMPTY_LIBRARY);
    library.stories = [
      asSummary(story),
      ...library.stories.filter((item) => item.id !== story.id),
    ];
    await atomicWrite(LIBRARY_PATH, `${JSON.stringify(library, null, 2)}\n`);
    return story;
  });
}

export async function updateStoryState(id, patch) {
  return withMutationLock(async () => {
    const story = await loadStory(id);
    story.state = {
      ...story.state,
      ...(typeof patch.read === 'boolean' ? { read: patch.read } : {}),
      ...(typeof patch.favourite === 'boolean'
        ? { favourite: patch.favourite }
        : {}),
      ...(typeof patch.notes === 'string'
        ? { notes: patch.notes.slice(0, 12_000) }
        : {}),
    };
    story.updatedAt = new Date().toISOString();

    const directory = storyDirectory(id);
    await atomicWrite(
      path.join(directory, 'story.json'),
      `${JSON.stringify(story, null, 2)}\n`,
    );
    await atomicWrite(path.join(directory, 'story.md'), storyMarkdown(story));

    const library = await readJson(LIBRARY_PATH, EMPTY_LIBRARY);
    library.stories = library.stories.map((item) =>
      item.id === id ? asSummary(story) : item,
    );
    await atomicWrite(LIBRARY_PATH, `${JSON.stringify(library, null, 2)}\n`);
    return story;
  });
}
