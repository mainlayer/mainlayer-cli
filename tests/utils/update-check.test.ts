import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock latest-version module
vi.mock('latest-version', () => ({
  default: vi.fn(),
}));

// Mock config-service
vi.mock('../../src/services/config-service.js', () => ({
  configService: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

import latestVersion from 'latest-version';
import { configService } from '../../src/services/config-service.js';

describe('checkForUpdates', () => {
  let originalIsTTY: boolean | undefined;
  let originalNoUpdateNotifier: string | undefined;
  let originalStderrWrite: typeof process.stderr.write;
  const stderrOutput: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    originalIsTTY = process.stdout.isTTY;
    originalNoUpdateNotifier = process.env['NO_UPDATE_NOTIFIER'];
    originalStderrWrite = process.stderr.write.bind(process.stderr);
    stderrOutput.length = 0;
    process.stderr.write = (chunk: string | Uint8Array) => {
      stderrOutput.push(String(chunk));
      return true;
    };
    // Default: TTY mode on, no env suppressor
    Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true, configurable: true });
    delete process.env['NO_UPDATE_NOTIFIER'];
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
    if (originalNoUpdateNotifier !== undefined) {
      process.env['NO_UPDATE_NOTIFIER'] = originalNoUpdateNotifier;
    } else {
      delete process.env['NO_UPDATE_NOTIFIER'];
    }
    process.stderr.write = originalStderrWrite;
  });

  it('returns immediately when NO_UPDATE_NOTIFIER is set', async () => {
    process.env['NO_UPDATE_NOTIFIER'] = '1';
    const { checkForUpdates } = await import('../../src/utils/update-check.js');
    await checkForUpdates();
    expect(latestVersion).not.toHaveBeenCalled();
  });

  it('returns immediately when process.stdout.isTTY is false', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true, configurable: true });
    const { checkForUpdates } = await import('../../src/utils/update-check.js');
    await checkForUpdates();
    expect(latestVersion).not.toHaveBeenCalled();
  });

  it('skips fetch when lastUpdateCheck was set less than 24h ago', async () => {
    const recentTimestamp = String(Date.now() - 1000); // 1 second ago
    vi.mocked(configService.get).mockReturnValue(recentTimestamp);
    const { checkForUpdates } = await import('../../src/utils/update-check.js');
    await checkForUpdates();
    expect(latestVersion).not.toHaveBeenCalled();
  });

  it('calls latestVersion and writes to stderr when a newer version exists', async () => {
    vi.mocked(configService.get).mockReturnValue(undefined);
    vi.mocked(latestVersion).mockResolvedValue('9.9.9');
    const { checkForUpdates } = await import('../../src/utils/update-check.js');
    await checkForUpdates();
    expect(latestVersion).toHaveBeenCalledWith('@mainlayer/cli');
    expect(stderrOutput.join('')).toContain('9.9.9');
  });

  it('swallows network errors silently (no throw, no output)', async () => {
    vi.mocked(configService.get).mockReturnValue(undefined);
    vi.mocked(latestVersion).mockRejectedValue(new Error('network error'));
    const { checkForUpdates } = await import('../../src/utils/update-check.js');
    await expect(checkForUpdates()).resolves.toBeUndefined();
    expect(stderrOutput).toHaveLength(0);
  });

  it('sets lastUpdateCheck in configService after successful fetch', async () => {
    vi.mocked(configService.get).mockReturnValue(undefined);
    vi.mocked(latestVersion).mockResolvedValue('0.0.0'); // same as current, no output
    const { checkForUpdates } = await import('../../src/utils/update-check.js');
    await checkForUpdates();
    expect(configService.set).toHaveBeenCalledWith('lastUpdateCheck', expect.any(String));
  });
});
