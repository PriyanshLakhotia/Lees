import http from 'node:http';
import path from 'node:path';

import { API_HOST, API_PORT, SCHEMAS_DIRECTORY } from './config.mjs';
import { runCodex } from './codex.mjs';
import { createGenerationJob, getJob, listJobs } from './jobs.mjs';
import { buildChatPrompt } from './prompts.mjs';
import {
  initializeStorage,
  listStories,
  loadStory,
  updateStoryState,
} from './storage.mjs';

const CONTENT_TYPES = new Set(['news', 'topic', 'history', 'fiction']);
const LEVELS = new Set(['A0', 'A1', 'A2', 'B1', 'B2', 'C1']);
const LENGTHS = new Set(['short', 'medium', 'long']);
const GENRES = new Set([
  'slice-of-life',
  'mystery',
  'science-fiction',
  'fantasy',
  'comedy',
  'drama',
  'romance',
]);

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  response.end(body);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function validateGenerationRequest(body) {
  const request = {
    type: String(body.type || ''),
    topic: String(body.topic || '')
      .trim()
      .slice(0, 80),
    genre: String(body.genre || 'slice-of-life'),
    idea: String(body.idea || '')
      .trim()
      .slice(0, 240),
    level: String(body.level || ''),
    length: String(body.length || ''),
  };
  if (!CONTENT_TYPES.has(request.type))
    throw new Error('Choose a valid content type.');
  if (!request.topic) throw new Error('Choose a topic.');
  if (!LEVELS.has(request.level))
    throw new Error('Choose a valid reading level.');
  if (!LENGTHS.has(request.length))
    throw new Error('Choose a valid reading length.');
  if (request.type === 'fiction' && !GENRES.has(request.genre))
    throw new Error('Choose a valid genre.');
  return request;
}

async function routeRequest(request, response) {
  const url = new URL(
    request.url,
    `http://${request.headers.host || 'localhost'}`,
  );
  const segments = url.pathname.split('/').filter(Boolean);

  if (request.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(response, 200, { ok: true });
  }
  if (request.method === 'GET' && url.pathname === '/api/stories') {
    return sendJson(response, 200, { stories: await listStories() });
  }
  if (
    request.method === 'GET' &&
    segments[0] === 'api' &&
    segments[1] === 'stories' &&
    segments[2]
  ) {
    return sendJson(response, 200, { story: await loadStory(segments[2]) });
  }
  if (
    request.method === 'PATCH' &&
    segments[0] === 'api' &&
    segments[1] === 'stories' &&
    segments[2]
  ) {
    const story = await updateStoryState(
      segments[2],
      await readJsonBody(request),
    );
    return sendJson(response, 200, { story });
  }
  if (request.method === 'GET' && url.pathname === '/api/jobs') {
    return sendJson(response, 200, { jobs: listJobs() });
  }
  if (
    request.method === 'GET' &&
    segments[0] === 'api' &&
    segments[1] === 'jobs' &&
    segments[2]
  ) {
    const job = getJob(segments[2]);
    return job
      ? sendJson(response, 200, { job })
      : sendJson(response, 404, { error: 'Job not found.' });
  }
  if (request.method === 'POST' && url.pathname === '/api/generations') {
    const job = createGenerationJob(
      validateGenerationRequest(await readJsonBody(request)),
    );
    return sendJson(response, 202, { job });
  }
  if (request.method === 'POST' && url.pathname === '/api/chat') {
    const body = await readJsonBody(request);
    const question = String(body.question || '')
      .trim()
      .slice(0, 2_000);
    const selection = String(body.selection || '')
      .trim()
      .slice(0, 2_000);
    if (!question) throw new Error('Ask a question first.');
    const story = await loadStory(String(body.storyId || ''));
    const prompt = await buildChatPrompt(story, question, selection);
    const answer = await runCodex({
      prompt,
      model: 'gpt-5.6-luna',
      effort: 'low',
      schemaPath: path.join(SCHEMAS_DIRECTORY, 'chat.schema.json'),
      timeoutMs: 3 * 60 * 1000,
    });
    return sendJson(response, 200, { answer });
  }

  return sendJson(response, 404, { error: 'Not found.' });
}

await initializeStorage();

const server = http.createServer((request, response) => {
  routeRequest(request, response).catch((error) => {
    const isMissing = error?.code === 'ENOENT';
    const isSyntaxError = error instanceof SyntaxError;
    const status = isMissing ? 404 : isSyntaxError ? 400 : 500;
    sendJson(response, status, {
      error: isMissing
        ? 'Story not found.'
        : error instanceof Error
          ? error.message
          : String(error),
    });
  });
});

server.listen(API_PORT, API_HOST, () => {
  console.log(`Lees API listening on http://${API_HOST}:${API_PORT}`);
});

function close() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', close);
process.on('SIGTERM', close);
