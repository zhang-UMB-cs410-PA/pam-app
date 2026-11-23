import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const windows = process.platform === 'win32';
const uvicorn = join(root, 'backend', '.venv', windows ? 'Scripts' : 'bin', windows ? 'uvicorn.exe' : 'uvicorn');

const major = Number(process.versions.node.split('.')[0]);
if (major < 22) fail(`Node 22 or newer is required (you have ${process.versions.node}). Run: nvm use 22`);

const setup = [
  [join(root, 'node_modules'), 'npm ci'],
  [join(root, 'pam-agent', 'node_modules'), 'cd pam-agent && npm ci'],
  [join(root, 'pam-agent', '.env'), 'cp pam-agent/.env.example pam-agent/.env, then fill it in'],
  [uvicorn, 'see backend/README.md (Setup)'],
  [join(root, 'backend', '.env'), 'cp backend/.env.example backend/.env, then fill it in'],
];
const missing = setup.filter(([path]) => !existsSync(path));
if (missing.length > 0) fail(['Setup is not finished:', ...missing.map(([, fix]) => `  ${fix}`)].join('\n'));

const children = [];
let stopping = false;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function prefixed(name, stream, output) {
  let buffered = '';
  stream.on('data', (chunk) => {
    const lines = (buffered + chunk).split('\n');
    buffered = lines.pop();
    for (const line of lines) output.write(`[${name}] ${line}\n`);
  });
}

function start(name, command, args, cwd, interactive = false) {
  const child = spawn(command, args, {
    cwd,
    stdio: interactive ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  if (!interactive) {
    prefixed(name, child.stdout, process.stdout);
    prefixed(name, child.stderr, process.stderr);
  }
  child.on('exit', (code) => {
    if (stopping) return;
    console.error(`[${name}] stopped (exit ${code}). Shutting everything down.`);
    stop(code ?? 1);
  });
  children.push(child);
}

function stop(code = 0) {
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill();
  setTimeout(() => process.exit(code), 500);
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

start('api', uvicorn, ['main:app', '--reload'], join(root, 'backend'));
start('agent', process.execPath, ['--env-file=.env', 'server.js'], join(root, 'pam-agent'));
start('expo', process.execPath, [join(root, 'node_modules', 'expo', 'bin', 'cli'), 'start', ...process.argv.slice(2)], root, true);
