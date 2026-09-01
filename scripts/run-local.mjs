import { spawn } from 'node:child_process';

const mode = process.argv[2] === 'start' ? 'start' : 'dev';
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  throw new Error('Run this script through npm.');
}

const commands = [
  [process.execPath, ['server/index.mjs']],
  [process.execPath, [npmCli, 'run', mode === 'dev' ? 'dev:web' : 'start:web']],
  ...(mode === 'start'
    ? [[process.execPath, ['scripts/local-proxy.mjs']]]
    : []),
];

const children = commands.map(([command, args]) =>
  spawn(command, args, { stdio: 'inherit', env: process.env }),
);

let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(exitCode), 500).unref();
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (stopping) return;
    if (signal === 'SIGTERM') return stop(0);
    stop(code || 0);
  });
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
