import Conf from 'conf';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { MainlayerConfig } from '../types/config.js';
import type { ConfigKey } from '../types/config.js';

export class ConfigService {
  private conf: Conf<MainlayerConfig>;
  private readonly confCwd: string;
  private readonly defaultConf: Conf<Record<string, unknown>>;

  constructor(cwd?: string) {
    this.confCwd = cwd ?? join(homedir(), '.mainlayer');
    this.conf = new Conf<MainlayerConfig>({
      cwd: this.confCwd,
      configName: 'config',
    });
    this.defaultConf = new Conf<Record<string, unknown>>({
      cwd: this.confCwd,
      configName: 'config',
    });
  }

  get(key: ConfigKey): string | undefined {
    return this.conf.get(key) as string | undefined;
  }

  set(key: ConfigKey, value: string): void {
    this.conf.set(key, value);
  }

  delete(key: ConfigKey): void {
    this.conf.delete(key);
  }

  getAll(): MainlayerConfig {
    return this.conf.store;
  }

  getApiUrl(): string {
    return (
      this.get('apiUrl') ??
      process.env['MAINLAYER_API_URL'] ??
      'https://api.mainlayer.io'
    );
  }

  clear(): void {
    this.conf.clear();
  }

  /**
   * Switch the active profile. Reinitializes this.conf to point at
   * config.<name>.json (or config.json for 'default').
   */
  setProfile(name: string): void {
    const configName = name === 'default' ? 'config' : `config.${name}`;
    this.conf = new Conf<MainlayerConfig>({
      cwd: this.confCwd,
      configName,
    });
  }

  /**
   * Persist the active profile name to the default config.json.
   * Always writes to the default conf, regardless of what profile is currently active.
   */
  setActiveProfile(name: string): void {
    this.defaultConf.set('activeProfile', name);
  }

  /**
   * Returns the active profile name. Reads from MAINLAYER_PROFILE env var first,
   * then from the default config.json, then defaults to 'default'.
   */
  getActiveProfile(): string {
    return (
      process.env['MAINLAYER_PROFILE'] ??
      (this.defaultConf.get('activeProfile') as string | undefined) ??
      'default'
    );
  }
}

export const configService = new ConfigService();
