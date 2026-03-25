import { describe, it, expect } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '../../dist/cli/index.js');

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execFileAsync(process.execPath, [CLI_PATH, ...args], {
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: execErr.stdout ?? '',
      stderr: execErr.stderr ?? '',
      exitCode: execErr.code ?? 1,
    };
  }
}

describe('CLI smoke tests', () => {
  it('--version exits 0 and contains "0.1.0"', async () => {
    const result = await runCli(['--version']);
    // Commander exits 0 on --version when exitOverride is used; output goes to stdout
    expect(result.stdout + result.stderr).toContain('0.1.0');
    expect(result.exitCode).toBe(0);
  });

  it('--help exits 0 and lists auth, wallet, config commands', async () => {
    const result = await runCli(['--help']);
    const output = result.stdout + result.stderr;
    expect(result.exitCode).toBe(0);
    expect(output).toContain('auth');
    expect(output).toContain('wallet');
    expect(output).toContain('config');
  });

  it('auth --help exits 0 and lists subcommands', async () => {
    const result = await runCli(['auth', '--help']);
    const output = result.stdout + result.stderr;
    expect(result.exitCode).toBe(0);
    expect(output).toContain('register');
    expect(output).toContain('login');
    expect(output).toContain('logout');
    expect(output).toContain('status');
    expect(output).toContain('api-key');
  });

  it('wallet --help exits 0 and lists subcommands', async () => {
    const result = await runCli(['wallet', '--help']);
    const output = result.stdout + result.stderr;
    expect(result.exitCode).toBe(0);
    expect(output).toContain('create');
    expect(output).toContain('import');
    expect(output).toContain('address');
    expect(output).toContain('balance');
    expect(output).toContain('export');
  });

  it('config --help exits 0 and lists subcommands', async () => {
    const result = await runCli(['config', '--help']);
    const output = result.stdout + result.stderr;
    expect(result.exitCode).toBe(0);
    expect(output).toContain('get');
    expect(output).toContain('set');
  });

  it('--json flag does not cause an error at the top-level help', async () => {
    const result = await runCli(['--json', '--help']);
    // Should still show help without crashing
    expect(result.exitCode).toBe(0);
  });
});
