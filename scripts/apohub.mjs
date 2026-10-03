#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import net from 'node:net';
import process from 'node:process';

const root = new URL('../', import.meta.url).pathname;
const mode = process.argv[2] || 'dev';

await loadEnvFile('.env');

const run = (command, args, env = process.env) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
  });

  child.on('error', reject);
  child.on('exit', code => {
    if (code === 0) {
      resolve();
    } else {
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 1}`));
    }
  });
});

const start = (command, args, env = process.env) => {
  const child = spawn(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
  });

  child.on('error', error => {
    console.error(error);
  });

  return child;
};

async function loadEnvFile(fileName) {
  try {
    const content = await readFile(new URL(`../${fileName}`, import.meta.url), 'utf8');

    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;

      const value = match[2].replace(/^['"]|['"]$/g, '');
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function requireEnv(name) {
  if (!process.env[name]) {
    throw new Error(`${name} is required. Add it to .env.`);
  }
}

function waitForPort(port, host = '127.0.0.1', timeoutMs = 180_000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      const socket = net.createConnection({ port, host });
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
        } else {
          setTimeout(check, 500);
        }
      });
    };

    check();
  });
}

async function runDevelopment() {
  requireEnv('APOHUB_SEED_PASSWORD');

  const env = {
    ...process.env,
    GCLOUD_PROJECT: 'demo-apohub',
    VITE_FIREBASE_PROJECT_ID: 'demo-apohub',
    VITE_USE_EMULATOR: 'true',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  };

  const emulator = start('bun', ['run', 'emulator:start'], env);
  const children = [emulator];

  try {
    await Promise.all([8080, 9099, 5001, 9199].map(port => waitForPort(port)));
    await run('bun', ['run', 'sample-data'], env);
    children.push(start('bun', ['run', 'dev:emulator'], env));

    await new Promise((resolve, reject) => {
      children.at(-1).once('exit', code => {
        if (code && code !== 0) reject(new Error(`Vite exited with code ${code}`));
        else resolve();
      });
    });
  } finally {
    for (const child of children) {
      if (!child.killed) child.kill('SIGTERM');
    }
  }
}

async function runProduction() {
  requireEnv('FIREBASE_PROJECT_ID');

  if (process.env.FIREBASE_PROJECT_ID.startsWith('demo-')) {
    throw new Error('FIREBASE_PROJECT_ID must be a production Firebase project.');
  }

  const env = {
    ...process.env,
    VITE_FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    VITE_USE_EMULATOR: 'false',
    FIREBASE_STATIC_BUILD: process.env.FIREBASE_STATIC_BUILD || 'false',
  };

  await run('bun', ['run', 'build'], env);

  const firebaseArgs = [
    'firebase-tools@latest',
    'deploy',
    '--project',
    process.env.FIREBASE_PROJECT_ID,
    '--only',
    'firestore:rules,firestore:indexes,functions,storage',
  ];

  if (process.env.FIREBASE_TOKEN) {
    firebaseArgs.push('--token', process.env.FIREBASE_TOKEN);
  }

  await run('bunx', firebaseArgs, env);

  if (process.env.DEPLOY_FRONTEND === 'true') {
    const vercelArgs = ['vercel', '--prod'];
    if (process.env.VERCEL_TOKEN) {
      vercelArgs.push('--token', process.env.VERCEL_TOKEN);
    }
    await run('bunx', vercelArgs, env);
  }
}

try {
  if (mode === 'dev') {
    await runDevelopment();
  } else if (mode === 'prod') {
    await runProduction();
  } else {
    throw new Error(`Unknown mode "${mode}". Use "dev" or "prod".`);
  }
} catch (error) {
  console.error(`\nAPOHUB ${mode} failed: ${error.message}`);
  process.exitCode = 1;
}
