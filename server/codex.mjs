import { spawn } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  CODEX_BINARY,
  MAX_PARALLEL_CODEX_PROCESSES,
  ROOT_DIRECTORY,
  RUNTIME_DIRECTORY,
} from './config.mjs';

let runningProcesses = 0;
const processWaiters = [];

async function acquireProcessSlot() {
  if (runningProcesses < MAX_PARALLEL_CODEX_PROCESSES) {
    runningProcesses += 1;
    return;
  }

  await new Promise((resolve) => processWaiters.push(resolve));
  runningProcesses += 1;
}

function releaseProcessSlot() {
  runningProcesses -= 1;
  processWaiters.shift()?.();
}

function parseStructuredOutput(rawOutput) {
  const trimmed = rawOutput.trim();
  const unfenced = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;
  return JSON.parse(unfenced);
}

export async function runCodex({
  prompt,
  model,
  effort,
  schemaPath,
  search = false,
  timeoutMs = 8 * 60 * 1000,
}) {
  await acquireProcessSlot();
  await mkdir(RUNTIME_DIRECTORY, { recursive: true });

  const outputPath = path.join(RUNTIME_DIRECTORY, `${randomUUID()}.json`);
  const args = [
    ...(search ? ['--search'] : []),
    'exec',
    '--ephemeral',
    '--sandbox',
    'read-only',
    '--model',
    model,
    '--config',
    `model_reasoning_effort="${effort}"`,
    '--output-schema',
    schemaPath,
    '--output-last-message',
    outputPath,
    '--color',
    'never',
    '-',
  ];

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(CODEX_BINARY, args, {
        cwd: ROOT_DIRECTORY,
        env: { ...process.env, NO_COLOR: '1' },
        stdio: ['pipe', 'ignore', 'pipe'],
      });

      let stderr = '';
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 3_000).unref();
        settled = true;
        reject(new Error('Codex generation timed out.'));
      }, timeoutMs);

      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        stderr = `${stderr}${chunk}`.slice(-24_000);
      });

      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Could not start Codex: ${error.message}`));
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code === 0) {
          resolve();
        } else {
          const detail = stderr.trim().split('\n').slice(-8).join('\n');
          reject(new Error(detail || `Codex exited with status ${code}.`));
        }
      });

      child.stdin.end(prompt);
    });

    const output = await readFile(outputPath, 'utf8');
    return parseStructuredOutput(output);
  } finally {
    await rm(outputPath, { force: true }).catch(() => {});
    releaseProcessSlot();
  }
}
