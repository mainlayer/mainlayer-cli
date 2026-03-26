import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authCommand } from '../../src/cli/auth.js';

// Mock config-service
vi.mock('../../src/services/config-service.js', () => ({
  configService: {
    setActiveProfile: vi.fn(),
    getActiveProfile: vi.fn().mockReturnValue('default'),
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn().mockReturnValue({}),
    setProfile: vi.fn(),
  },
}));

// Mock output utils
vi.mock('../../src/utils/output.js', () => ({
  formatOutput: vi.fn(),
  printError: vi.fn(),
  printSuccess: vi.fn(),
  printTable: vi.fn(),
  truncate: vi.fn(),
}));

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  outro: vi.fn(),
  text: vi.fn(),
  password: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn(),
}));

// Mock prompt utils
vi.mock('../../src/utils/prompt.js', () => ({
  getCredentials: vi.fn(),
}));

// Mock api-client
vi.mock('../../src/services/api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock ora
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}));

// Mock node:fs for auth list tests
vi.mock('node:fs', () => ({
  readdirSync: vi.fn(),
}));

import { configService } from '../../src/services/config-service.js';
import { formatOutput } from '../../src/utils/output.js';
import { readdirSync } from 'node:fs';

describe('auth switch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (configService.getActiveProfile as ReturnType<typeof vi.fn>).mockReturnValue('default');
  });

  it('calls setActiveProfile with the given profile name', async () => {
    const cmd = authCommand();
    await cmd.parseAsync(['node', 'mainlayer', 'switch', 'staging']);
    expect(configService.setActiveProfile).toHaveBeenCalledWith('staging');
  });

  it('outputs { activeProfile: staging } after switching', async () => {
    const cmd = authCommand();
    await cmd.parseAsync(['node', 'mainlayer', 'switch', 'staging']);
    expect(formatOutput).toHaveBeenCalledWith(
      { activeProfile: 'staging' },
      expect.objectContaining({ json: expect.any(Boolean) }),
    );
  });

  it('calls setActiveProfile with "default" when switching to default', async () => {
    const cmd = authCommand();
    await cmd.parseAsync(['node', 'mainlayer', 'switch', 'default']);
    expect(configService.setActiveProfile).toHaveBeenCalledWith('default');
  });
});

describe('auth list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (configService.getActiveProfile as ReturnType<typeof vi.fn>).mockReturnValue('default');
  });

  it('returns ["default"] when ~/.mainlayer/ does not exist (ENOENT handled)', async () => {
    (readdirSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const err = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    });

    const cmd = authCommand();
    await cmd.parseAsync(['node', 'mainlayer', 'list']);
    expect(formatOutput).toHaveBeenCalledWith(
      expect.objectContaining({ profiles: ['default'] }),
      expect.anything(),
    );
  });

  it('returns ["default"] when ~/.mainlayer/ contains only config.json', async () => {
    (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['config.json']);

    const cmd = authCommand();
    await cmd.parseAsync(['node', 'mainlayer', 'list']);
    expect(formatOutput).toHaveBeenCalledWith(
      expect.objectContaining({ profiles: ['default'] }),
      expect.anything(),
    );
  });

  it('returns ["default", "staging"] when config.json and config.staging.json both exist', async () => {
    (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
      'config.json',
      'config.staging.json',
    ]);

    const cmd = authCommand();
    await cmd.parseAsync(['node', 'mainlayer', 'list']);
    expect(formatOutput).toHaveBeenCalledWith(
      expect.objectContaining({ profiles: expect.arrayContaining(['default', 'staging']) }),
      expect.anything(),
    );
  });

  it('includes active profile in output', async () => {
    (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['config.json']);
    (configService.getActiveProfile as ReturnType<typeof vi.fn>).mockReturnValue('default');

    const cmd = authCommand();
    await cmd.parseAsync(['node', 'mainlayer', 'list']);
    expect(formatOutput).toHaveBeenCalledWith(
      expect.objectContaining({ active: 'default' }),
      expect.anything(),
    );
  });
});
