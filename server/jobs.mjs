import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { MAX_PARALLEL_GENERATIONS, SCHEMAS_DIRECTORY } from './config.mjs';
import { runCodex } from './codex.mjs';
import { buildAnnotationPrompt, buildStoryPrompt } from './prompts.mjs';
import { saveStory } from './storage.mjs';
import { translateSentences } from './translations.mjs';
import {
  chunk,
  countWords,
  estimateReadingMinutes,
  extractUniqueWords,
  normalizeWord,
} from './text.mjs';

const jobs = new Map();
const queuedJobIds = [];
let activeGenerations = 0;

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    detail: job.detail,
    request: job.request,
    storyId: job.storyId || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    error: job.error || null,
  };
}

function updateJob(job, changes) {
  Object.assign(job, changes, { updatedAt: new Date().toISOString() });
}

function createStoryId(title) {
  const slug =
    title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('nl-NL')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 55) || 'dutch-text';
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  return `${stamp}-${slug}-${randomUUID().slice(0, 6)}`;
}

function validateDraft(draft) {
  if (
    !draft ||
    typeof draft.title !== 'string' ||
    !Array.isArray(draft.paragraphs)
  ) {
    throw new Error('Codex returned an incomplete story.');
  }
  const paragraphs = draft.paragraphs
    .map((paragraph) => String(paragraph).trim())
    .filter(Boolean);
  if (paragraphs.length < 2)
    throw new Error('The generated story was too short.');
  return { ...draft, paragraphs };
}

async function annotateWords(story, words, onProgress) {
  const wordChunks = chunk(words, 180);
  let completed = 0;

  const results = await Promise.all(
    wordChunks.map(async (wordChunk) => {
      const annotate = async (targetWords) => {
        const prompt = await buildAnnotationPrompt(story, targetWords);
        return runCodex({
          prompt,
          model: 'gpt-5.6-luna',
          effort: 'low',
          schemaPath: path.join(SCHEMAS_DIRECTORY, 'annotations.schema.json'),
          timeoutMs: 5 * 60 * 1000,
        });
      };

      const first = await annotate(wordChunk);
      const entries = Array.isArray(first.entries) ? first.entries : [];
      const received = new Set(
        entries.map((entry) => normalizeWord(String(entry.word))),
      );
      const missing = wordChunk.filter((word) => !received.has(word));

      if (missing.length) {
        const repair = await annotate(missing);
        entries.push(...(Array.isArray(repair.entries) ? repair.entries : []));
      }

      completed += 1;
      onProgress(completed, wordChunks.length);
      return entries;
    }),
  );

  const annotations = {};
  for (const entry of results.flat()) {
    const word = normalizeWord(String(entry.word || ''));
    if (!words.includes(word)) continue;
    annotations[word] = {
      word,
      lemma: String(entry.lemma || word),
      meaning: String(entry.meaning || '').trim(),
      partOfSpeech: String(entry.partOfSpeech || ''),
      difficulty: ['common', 'useful', 'advanced'].includes(entry.difficulty)
        ? entry.difficulty
        : 'useful',
      exampleNl: String(entry.exampleNl || ''),
      exampleEn: String(entry.exampleEn || ''),
    };
  }

  const missing = words.filter((word) => !annotations[word]?.meaning);
  if (missing.length) {
    throw new Error(
      `Word annotation was incomplete (${missing.length} words missing).`,
    );
  }
  return annotations;
}

async function runGeneration(job) {
  try {
    updateJob(job, {
      status: 'running',
      stage: 'drafting',
      detail: 'Researching and writing',
    });
    const prompt = await buildStoryPrompt(job.request);
    const draft = validateDraft(
      await runCodex({
        prompt,
        model: 'gpt-5.6-terra',
        effort: 'high',
        schemaPath: path.join(SCHEMAS_DIRECTORY, 'story-draft.schema.json'),
        search: job.request.type !== 'fiction',
      }),
    );

    const storyId = createStoryId(draft.title);
    const baseStory = {
      schemaVersion: 2,
      id: storyId,
      request: job.request,
      title: draft.title.trim(),
      subtitle: draft.subtitle.trim(),
      summaryEnglish: draft.summaryEnglish.trim(),
      paragraphs: draft.paragraphs,
      tags: draft.tags.map(String).slice(0, 5),
      sources: draft.sources
        .filter((source) => /^https?:\/\//i.test(source.url))
        .map((source) => ({
          ...source,
          retrievedAt: new Date().toISOString(),
        })),
    };
    const words = extractUniqueWords(baseStory.paragraphs);

    updateJob(job, {
      stage: 'annotating',
      detail: `Adding reading aids · words 0/${Math.ceil(words.length / 180)}`,
    });
    const [annotations, sentenceTranslations] = await Promise.all([
      annotateWords(baseStory, words, (complete, total) => {
        updateJob(job, {
          detail: `Adding reading aids · words ${complete}/${total}`,
        });
      }),
      translateSentences(baseStory),
    ]);
    const wordCount = countWords(baseStory.paragraphs);
    const createdAt = new Date().toISOString();
    const story = {
      ...baseStory,
      wordCount,
      readingMinutes: estimateReadingMinutes(wordCount, job.request.level),
      annotations,
      sentenceTranslations,
      state: { read: false, favourite: false, notes: '' },
      generation: {
        storyModel: 'gpt-5.6-terra',
        storyReasoning: 'high',
        annotationModel: 'gpt-5.6-luna',
        annotationReasoning: 'low',
        translationModel: 'gpt-5.6-luna',
        translationReasoning: 'low',
      },
      createdAt,
      updatedAt: createdAt,
    };

    updateJob(job, { stage: 'saving', detail: 'Saving to your library' });
    await saveStory(story);
    updateJob(job, {
      status: 'completed',
      stage: 'completed',
      detail: 'Ready to read',
      storyId,
    });
  } catch (error) {
    updateJob(job, {
      status: 'failed',
      stage: 'failed',
      detail: 'Generation failed',
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    activeGenerations -= 1;
    drainQueue();
  }
}

function drainQueue() {
  while (activeGenerations < MAX_PARALLEL_GENERATIONS && queuedJobIds.length) {
    const job = jobs.get(queuedJobIds.shift());
    if (!job || job.status !== 'queued') continue;
    activeGenerations += 1;
    void runGeneration(job);
  }
}

export function createGenerationJob(request) {
  const now = new Date().toISOString();
  const job = {
    id: randomUUID(),
    status: 'queued',
    stage: 'queued',
    detail: 'Waiting to start',
    request,
    storyId: null,
    createdAt: now,
    updatedAt: now,
    error: null,
  };
  jobs.set(job.id, job);
  queuedJobIds.push(job.id);
  drainQueue();
  return publicJob(job);
}

export function listJobs() {
  return [...jobs.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30)
    .map(publicJob);
}

export function getJob(id) {
  const job = jobs.get(id);
  return job ? publicJob(job) : null;
}
