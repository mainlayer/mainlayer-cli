import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
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
  delete process.env['MAINLAYER_PROFILE'];
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

    it('falls back to default https://api.mainlayer.fr when neither config nor env set', () => {
      const svc = makeService();
      delete process.env['MAINLAYER_API_URL'];
      expect(svc.getApiUrl()).toBe('https://api.mainlayer.fr');
    });

    it('config value takes precedence over env var', () => {
      const svc = makeService();
      svc.set('apiUrl', 'https://config-wins.io');
      process.env['MAINLAYER_API_URL'] = 'https://env-loses.io';
      expect(svc.getApiUrl()).toBe('https://config-wins.io');
    });
  });

  describe('setProfile / getActiveProfile / setActiveProfile', () => {
    it('getActiveProfile returns "default" when no profile set', () => {
      const svc = new ConfigService(tmpDir);
      expect(svc.getActiveProfile()).toBe('default');
    });

    it('getActiveProfile returns MAINLAYER_PROFILE env var when set', () => {
      const svc = new ConfigService(tmpDir);
      process.env['MAINLAYER_PROFILE'] = 'staging';
      expect(svc.getActiveProfile()).toBe('staging');
    });

    it('setActiveProfile persists activeProfile to default config.json', () => {
      const svc = new ConfigService(tmpDir);
      svc.setActiveProfile('staging');
      // Read a fresh instance to verify persistence
      const svc2 = new ConfigService(tmpDir);
      expect(svc2.getActiveProfile()).toBe('staging');
    });

    it('setProfile("staging") causes get/set to use config.staging.json', () => {
      const svc = new ConfigService(tmpDir);
      svc.setProfile('staging');
      svc.set('jwt', 'staging-token');
      // Verify staged value is in config.staging.json (not config.json)
      const stagingFile = join(tmpDir, 'config.staging.json');
      expect(existsSync(stagingFile)).toBe(true);
      const contents = JSON.parse(readFileSync(stagingFile, 'utf8')) as Record<string, unknown>;
      expect(contents['jwt']).toBe('staging-token');
    });

    it('setProfile("staging") does not write to config.json', () => {
      const svc = new ConfigService(tmpDir);
      svc.setProfile('staging');
      svc.set('jwt', 'staging-only');
      const defaultSvc = new ConfigService(tmpDir);
      expect(defaultSvc.get('jwt')).toBeUndefined();
    });

    it('setProfile("default") reverts to config.json', () => {
      const svc = new ConfigService(tmpDir);
      svc.setProfile('staging');
      svc.set('jwt', 'staging-token');
      svc.setProfile('default');
      svc.set('jwt', 'default-token');
      // Default config should have default-token, not staging-token
      const defaultSvc = new ConfigService(tmpDir);
      expect(defaultSvc.get('jwt')).toBe('default-token');
    });
  });
});
