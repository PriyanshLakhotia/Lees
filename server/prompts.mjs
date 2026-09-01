import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PROMPTS_DIRECTORY } from './config.mjs';

const promptCache = new Map();

async function readPrompt(relativePath) {
  if (!promptCache.has(relativePath)) {
    const contents = await readFile(
      path.join(PROMPTS_DIRECTORY, relativePath),
      'utf8',
    );
    promptCache.set(relativePath, contents.trim());
  }
  return promptCache.get(relativePath);
}

function todayInAmsterdam() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function buildStoryPrompt(request) {
  const [base, type, level, length] = await Promise.all([
    readPrompt('story/base.md'),
    readPrompt(`story/types/${request.type}.md`),
    readPrompt(`story/levels/${request.level}.md`),
    readPrompt(`story/lengths/${request.length}.md`),
  ]);

  const requestModule = `# Reader request

- Today's date in Amsterdam: ${todayInAmsterdam()}
- Content type: ${request.type}
- Topic category: ${request.topic}
- Fiction genre: ${request.type === 'fiction' ? request.genre : 'not applicable'}
- Specific idea: ${request.idea || 'Choose a specific, interesting angle within the topic category.'}
- CEFR level: ${request.level}
- Reading length: ${request.length}
- The summaryEnglish field is a neutral one-sentence library description, not part of the Dutch article.
- Paragraph strings contain only the reading text; do not put headings, bullets, or source notes inside them.
- For factual content, the sources array must contain direct URLs you actually used. For fiction it should be empty unless browsing was necessary.`;

  return [base, type, level, length, requestModule].join('\n\n---\n\n');
}

export async function buildAnnotationPrompt(story, words) {
  const base = await readPrompt('annotation/base.md');
  const article = story.paragraphs
    .map((paragraph, index) => `${index + 1}. ${paragraph}`)
    .join('\n\n');

  return `${base}

---

# Article context

Title: ${story.title}
CEFR level: ${story.request.level}

${article}

---

# Normalized words to annotate

${JSON.stringify(words)}`;
}

export async function buildChatPrompt(story, question, selection) {
  const base = await readPrompt('chat/base.md');
  const article = story.paragraphs.join('\n\n');

  return `${base}

---

# Dutch text

Title: ${story.title}
Level: ${story.request.level}

${article}

---

# Learner input

Highlighted selection: ${selection || '(none)'}

Question: ${question}`;
}
