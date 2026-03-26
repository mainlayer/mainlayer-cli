import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config-service
vi.mock('../../src/services/config-service.js', () => ({
  configService: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(),
    getApiUrl: vi.fn(),
  },
}));

import { configService } from '../../src/services/config-service.js';
import { configCommand } from '../../src/cli/config.js';

describe('config command', () => {
  let stdoutLines: string[];
  let stderrLines: string[];
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    stdoutLines = [];
    stderrLines = [];

    // Capture console.log (stdout)
    vi.spyOn(console, 'log').mockImplementation((msg: string) => {
      stdoutLines.push(String(msg));
    });
    // Capture console.error (stderr)
    vi.spyOn(console, 'error').mockImplementation((msg: string) => {
      stderrLines.push(String(msg));
    });

    // Reset process.exitCode
    process.exitCode = undefined;

    // Default: non-TTY so we get JSON output
    originalIsTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  describe('config --list', () => {
    it('returns all config keys with jwt value masked as ***', async () => {
      vi.mocked(configService.getAll).mockReturnValue({
        apiUrl: 'https://api.mainlayer.io',
        jwt: 'super-secret-token',
        email: 'user@example.com',
      });

      const cmd = configCommand();
      await cmd.parseAsync(['--list'], { from: 'user' });

      const output = stdoutLines.join('');
      const parsed = JSON.parse(output);
      expect(parsed.jwt).toBe('***');
      expect(parsed.email).toBe('user@example.com');
      expect(parsed.apiUrl).toBe('https://api.mainlayer.io');
    });

    it('config --list --json outputs valid JSON with jwt masked', async () => {
      vi.mocked(configService.getAll).mockReturnValue({
        jwt: 'my-token',
        apiUrl: 'https://api.mainlayer.io',
      });

      // In TTY mode, --json flag forces JSON output
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true, configurable: true });

      const cmd = configCommand();
      await cmd.parseAsync(['--list', '--json'], { from: 'user' });

      const output = stdoutLines.join('');
      const parsed = JSON.parse(output);
      expect(parsed.jwt).toBe('***');
      expect(parsed.apiUrl).toBe('https://api.mainlayer.io');
    });
  });

  describe('config unset', () => {
    it('calls configService.delete(key) and returns confirmation', async () => {
      const cmd = configCommand();
      await cmd.parseAsync(['unset', 'apiUrl'], { from: 'user' });

      expect(configService.delete).toHaveBeenCalledWith('apiUrl');
      const output = stdoutLines.join('');
      const parsed = JSON.parse(output);
      expect(parsed.unset).toBe('apiUrl');
    });

    it('prints error and sets exit code for unknown key', async () => {
      const cmd = configCommand();
      await cmd.parseAsync(['unset', 'unknownKey'], { from: 'user' });

      expect(configService.delete).not.toHaveBeenCalled();
      expect(stderrLines.join('')).toMatch(/Unknown config key/);
      expect(process.exitCode).toBe(4); // VALIDATION_ERROR exit code
    });
  });
});
