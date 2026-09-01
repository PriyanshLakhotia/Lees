import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSentenceTranslationPrompt,
  buildStoryPrompt,
} from './prompts.mjs';

test('story prompt composes the selected additive modules', async () => {
  const prompt = await buildStoryPrompt({
    type: 'fiction',
    topic: 'fiction',
    genre: 'mystery',
    idea: 'a missing bicycle key',
    level: 'A2',
    length: 'short',
  });

  assert.match(prompt, /Core writing brief/);
  assert.match(prompt, /Content module: fiction/);
  assert.match(prompt, /Language module: A2/);
  assert.match(prompt, /Length module: short/);
  assert.match(prompt, /a missing bicycle key/);
  assert.match(prompt, /Fiction genre: mystery/);
});

test('sentence translation prompt preserves indexed source sentences', async () => {
  const prompt = await buildSentenceTranslationPrompt(
    { title: 'De trein', request: { level: 'A1' } },
    [
      {
        paragraphIndex: 0,
        sentenceIndex: 0,
        dutch: 'De trein komt aan.',
      },
    ],
  );

  assert.match(prompt, /Sentence translation brief/);
  assert.match(prompt, /"paragraphIndex": 0/);
  assert.match(prompt, /De trein komt aan\./);
});
