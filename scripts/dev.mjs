#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import readline from 'node:readline';
import { freePorts, killTree } from './lib/ports.mjs';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createConnection } from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(root, 'server');
const clientDir = path.join(root, 'client');
const args = new Set(process.argv.slice(2));

const useColour = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, text) => (useColour ? `[${code}m${text}[0m` : text);
const colours = { api: '36', web: '35', dev: '32', warn: '33', error: '31', dim: '90' };
const log = (tag, message) => console.log(`${paint(colours[tag] || '0', `[${tag}]`)} ${message}`);

const children = [];
let shuttingDown = false;

main().catch((error) => {
  log('error', error.stack || error.message);
  process.exit(1);
});

async function main() {
  console.log(paint('1', '\nPaperTruth — crowd-consensus answer key\n'));

  ensureEnvFile(
    path.join(serverDir, '.env'),
    path.join(serverDir, '.env.example'),
    (contents) =>
      contents.replace(
        /^JWT_SECRET=.*$/m,
        `JWT_SECRET=${randomBytes(48).toString('base64url')}`
      )
  );
  ensureEnvFile(path.join(clientDir, '.env'), path.join(clientDir, '.env.example'));

  if (!args.has('--no-install')) {
    ensureDependencies('server', serverDir);
    ensureDependencies('client', clientDir);
  }

  const apiPort = readApiPort();
  const runApi = !args.has('--web-only');
  const runWeb = !args.has('--api-only');

  const busy = [];
  if (runApi && (await isPortInUse(apiPort))) busy.push(apiPort);
  if (runWeb && (await isPortInUse(5173))) busy.push(5173);
  if (busy.length > 0) {
    log('error', `port ${busy.join(' and ')} already in use — PaperTruth may still be running.`);
    log('error', 'Free them with:  npm run stop     (then npm run dev again)');
    process.exit(1);
  }

  const mongo = readMongoUri();
  if (await isPortOpen(mongo.host, mongo.port)) {
    log('dev', `MongoDB is up on ${mongo.host}:${mongo.port}`);
    if (!args.has('--no-seed')) await maybeSeed(args.has('--seed'));
  } else {
    log('warn', `MongoDB is NOT reachable on ${mongo.host}:${mongo.port}.`);
    log('warn', 'Start it first — on Windows:  net start MongoDB  (as administrator)');
    log('warn', 'The API will keep retrying, but nothing will load until it is running.');
  }

  if (runApi) {
    start('api', process.execPath, ['--watch-path=src', path.join('src', 'index.js')], serverDir);
  }
  if (runWeb) {
    const vite = path.join(clientDir, 'node_modules', 'vite', 'bin', 'vite.js');
    if (!existsSync(vite)) throw new Error('Vite is not installed. Run: npm --prefix client install');
    start('web', process.execPath, [vite], clientDir);
  }

  console.log('');
  log('dev', `API   ${paint(colours.dim, `http://localhost:${apiPort}`)}`);
  log('dev', `App   ${paint(colours.dim, 'http://localhost:5173')}   ← open this`);
  log('dev', `Sign in as ${paint(colours.dim, 'admin@papertruth.com / admin123')} or ${paint(colours.dim, 'aarav@student.papertruth.com / student123')}`);
  log('dev', `Press ${paint(colours.dim, 'Ctrl+C')} to stop both.\n`);
}

function ensureEnvFile(target, example, transform) {
  if (existsSync(target)) return;
  if (!existsSync(example)) {
    log('warn', `${path.relative(root, example)} is missing — cannot create ${path.relative(root, target)}`);
    return;
  }
  const raw = readFileSync(example, 'utf8');
  writeFileSync(target, transform ? transform(raw) : raw);
  log('dev', `created ${path.relative(root, target)} from its example`);
}

function ensureDependencies(label, directory) {
  if (existsSync(path.join(directory, 'node_modules'))) return;
  log('dev', `installing ${label} dependencies (first run — this takes a minute)…`);
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['install', '--no-audit', '--no-fund'], {
    cwd: directory,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) throw new Error(`npm install failed in ${label}/`);
  log('dev', `${label} dependencies installed`);
}

function readApiPort() {
  const fromEnv = Number(process.env.PORT);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  const envPath = path.join(serverDir, '.env');
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, 'utf8').match(/^PORT=(\d+)/m);
    if (match) return Number(match[1]);
  }
  return 5000;
}

function readMongoUri() {
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    const envPath = path.join(serverDir, '.env');
    if (existsSync(envPath)) {
      uri = readFileSync(envPath, 'utf8').match(/^MONGODB_URI=(.*)$/m)?.[1]?.trim();
    }
  }
  uri = uri || 'mongodb://127.0.0.1:27017/papertruth';
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]+@)?([^:/,?]+)(?::(\d+))?/i);
  return { uri, host: match?.[1] || '127.0.0.1', port: Number(match?.[2] || 27017) };
}

async function isPortInUse(port) {
  return (await isPortOpen('127.0.0.1', port, 400)) || (await isPortOpen('::1', port, 400));
}

function isPortOpen(host, port, timeout = 1500) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function maybeSeed(force) {
  let shouldSeed = force;

  if (!shouldSeed) {
    try {
      const require = createRequire(pathToFileURL(path.join(serverDir, 'package.json')));
      const mongoose = require('mongoose');
      const { uri } = readMongoUri();
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      const exams = await mongoose.connection.db.collection('exams').countDocuments();
      await mongoose.connection.close();
      shouldSeed = exams === 0;
      if (!shouldSeed) log('dev', `database already has ${exams} exam(s) — skipping the seed`);
    } catch (error) {
      log('warn', `could not check the database (${error.message}) — skipping the seed`);
      return;
    }
  }

  if (!shouldSeed) return;

  log('dev', force ? 'reseeding the demo cohort…' : 'empty database — seeding the demo cohort…');
  const result = spawnSync(process.execPath, [path.join('scripts', 'simulate.js')], {
    cwd: serverDir,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    log('warn', 'the seed script did not finish cleanly — the app will still start');
  }
}

function start(tag, command, commandArgs, cwd) {
  const child = spawn(command, commandArgs, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  prefix(tag, child.stdout);
  prefix(tag, child.stderr);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    log('warn', `${tag} exited (${signal || `code ${code}`}) — shutting everything down`);
    shutdown(code ?? 1);
  });
  child.on('error', (error) => {
    log('error', `${tag} failed to start: ${error.message}`);
    shutdown(1);
  });
  return child;
}

function prefix(tag, stream) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim() === '') continue;
      console.log(`${paint(colours[tag], `[${tag}]`)} ${line}`);
    }
  });
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    killTree(child.pid);
  }

  // The API runs under `node --watch`, which re-spawns the server under a new
  // pid, so the tree we recorded can be stale. Sweep the ports to be sure.
  const freed = freePorts();
  if (freed > 0) log('dev', `released ${freed} lingering process(es) still holding a dev port`);

  log('dev', 'stopped.');
  process.exit(code);
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(signal, () => {
    console.log('');
    log('dev', 'stopping…');
    shutdown(0);
  });
}

// On Windows a console Ctrl+C is only delivered reliably to a Node process that
// is reading stdin, so attach a readline interface purely to catch it.
if (process.platform === 'win32' && process.stdin.isTTY) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('SIGINT', () => {
    console.log('');
    log('dev', 'stopping…');
    shutdown(0);
  });
}

process.on('exit', () => {
  if (shuttingDown) return;
  for (const child of children) killTree(child.pid);
});
