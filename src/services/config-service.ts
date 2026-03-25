import Conf from 'conf';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { MainlayerConfig } from '../types/config.js';
import type { ConfigKey } from '../types/config.js';

export class ConfigService {
  private conf: Conf<MainlayerConfig>;

  constructor(cwd?: string) {
    this.conf = new Conf<MainlayerConfig>({
      cwd: cwd ?? join(homedir(), '.mainlayer'),
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
}

export const configService = new ConfigService();
