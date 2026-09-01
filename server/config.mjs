import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIRECTORY = path.resolve(serverDirectory, '..');
export const DATA_DIRECTORY = path.join(ROOT_DIRECTORY, 'data');
export const STORIES_DIRECTORY = path.join(DATA_DIRECTORY, 'stories');
export const RUNTIME_DIRECTORY = path.join(DATA_DIRECTORY, '.runtime');
export const LIBRARY_PATH = path.join(DATA_DIRECTORY, 'library.json');
export const PROMPTS_DIRECTORY = path.join(ROOT_DIRECTORY, 'prompts');
export const SCHEMAS_DIRECTORY = path.join(ROOT_DIRECTORY, 'schemas');
export const API_PORT = Number.parseInt(
  process.env.LEES_API_PORT || '4317',
  10,
);
export const API_HOST = '127.0.0.1';
export const MAX_PARALLEL_GENERATIONS = 3;
export const MAX_PARALLEL_CODEX_PROCESSES = 6;

const bundledCodex = '/Applications/ChatGPT.app/Contents/Resources/codex';

export const CODEX_BINARY =
  process.env.LEES_CODEX_BINARY ||
  (existsSync(bundledCodex) ? bundledCodex : 'codex');
