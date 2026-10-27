/**
 * Script Execution and Quality Gate Tools for Apohub Dev MCP Server
 */

import { spawn } from 'child_process';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../../../');

export interface CommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  success: boolean;
}

export function executeCommand(cmd: string, args: string[], env: Record<string, string> = {}): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        ...env
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('close', (code) => {
      resolve({
        command: `${cmd} ${args.join(' ')}`,
        exitCode: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: code === 0
      });
    });

    child.on('error', (err) => {
      resolve({
        command: `${cmd} ${args.join(' ')}`,
        exitCode: 1,
        stdout,
        stderr: `${stderr}\n${err.message}`.trim(),
        success: false
      });
    });
  });
}

export async function seedEmulatorData(mode: 'full' | 'users-only' = 'full', password?: string): Promise<CommandResult> {
  const seedPassword = password || process.env.APOHUB_SEED_PASSWORD || 'AdminDev123!';
  const scriptName = mode === 'users-only' ? 'scripts/populate-users-only.cjs' : 'scripts/populate-sample-data.cjs';

  return executeCommand('bun', [scriptName], {
    APOHUB_SEED_PASSWORD: seedPassword,
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080',
    FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099',
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT || 'demo-apohub'
  });
}

export async function validateRulesAndIndexes(): Promise<{
  rulesResult: CommandResult;
  indexesResult: CommandResult;
  valid: boolean;
}> {
  const [rulesResult, indexesResult] = await Promise.all([
    executeCommand('node', ['scripts/deploy-rules.js', 'validate']),
    executeCommand('node', ['scripts/deploy-indexes.js', 'validate'])
  ]);

  return {
    rulesResult,
    indexesResult,
    valid: rulesResult.success && indexesResult.success
  };
}

export async function runQualityGate(
  gate: 'typecheck' | 'lint' | 'test:unit' | 'test:rules' | 'build' | 'all'
): Promise<CommandResult | { results: Record<string, CommandResult>; success: boolean }> {
  if (gate === 'all') {
    const typecheck = await executeCommand('bun', ['run', 'typecheck']);
    const lint = await executeCommand('bun', ['run', 'lint']);
    const testUnit = await executeCommand('bun', ['run', 'test:unit']);
    const results = { typecheck, lint, 'test:unit': testUnit };
    const success = typecheck.success && lint.success && testUnit.success;
    return { results, success };
  }

  const scriptMap: Record<string, string[]> = {
    typecheck: ['run', 'typecheck'],
    lint: ['run', 'lint'],
    'test:unit': ['run', 'test:unit'],
    'test:rules': ['run', 'test:rules'],
    build: ['run', 'build']
  };

  const args = scriptMap[gate] || ['run', gate];
  return executeCommand('bun', args);
}
