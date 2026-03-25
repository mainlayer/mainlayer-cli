import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// We need to create a ConfigService with a custom cwd for tests
// so they don't pollute the real ~/.mainlayer/config.json

let tmpDir: string;

// Import ConfigService class (not the singleton) for testability
import { ConfigService } from '../../src/services/config-service.js';

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'mainlayer-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  // Clean up env vars set during tests
  delete process.env['MAINLAYER_API_URL'];
});

function makeService() {
  return new ConfigService(tmpDir);
}

describe('ConfigService', () => {
  it('get returns undefined for unset key', () => {
    const svc = makeService();
    expect(svc.get('jwt')).toBeUndefined();
  });

  it('set persists value and get returns it', () => {
    const svc = makeService();
    svc.set('apiUrl', 'https://example.com');
    expect(svc.get('apiUrl')).toBe('https://example.com');
  });

  it('delete removes the key', () => {
    const svc = makeService();
    svc.set('jwt', 'token123');
    svc.delete('jwt');
    expect(svc.get('jwt')).toBeUndefined();
  });

  it('getAll returns full config object', () => {
    const svc = makeService();
    svc.set('email', 'user@example.com');
    svc.set('userId', 'abc123');
    const all = svc.getAll();
    expect(all.email).toBe('user@example.com');
    expect(all.userId).toBe('abc123');
  });

  it('clear removes all config keys', () => {
    const svc = makeService();
    svc.set('jwt', 'token');
    svc.set('email', 'user@example.com');
    svc.clear();
    expect(svc.get('jwt')).toBeUndefined();
    expect(svc.get('email')).toBeUndefined();
  });

  describe('getApiUrl', () => {
    it('returns config value when set', () => {
      const svc = makeService();
      svc.set('apiUrl', 'https://custom.io');
      expect(svc.getApiUrl()).toBe('https://custom.io');
    });

    it('falls back to MAINLAYER_API_URL env var when not in config', () => {
      const svc = makeService();
      process.env['MAINLAYER_API_URL'] = 'https://env.example.com';
      expect(svc.getApiUrl()).toBe('https://env.example.com');
    });

    it('falls back to default https://api.mainlayer.io when neither config nor env set', () => {
      const svc = makeService();
      delete process.env['MAINLAYER_API_URL'];
      expect(svc.getApiUrl()).toBe('https://api.mainlayer.io');
    });

    it('config value takes precedence over env var', () => {
      const svc = makeService();
      svc.set('apiUrl', 'https://config-wins.io');
      process.env['MAINLAYER_API_URL'] = 'https://env-loses.io';
      expect(svc.getApiUrl()).toBe('https://config-wins.io');
    });
  });
});
