import { Command } from 'commander';
import { KNOWN_CONFIG_KEYS } from '../types/config.js';
import type { ConfigKey } from '../types/config.js';
import { configService } from '../services/config-service.js';
import { EXIT_CODES } from '../utils/errors.js';
import { formatOutput, printError, printSuccess } from '../utils/output.js';

export function configCommand(): Command {
  const config = new Command('config').description('Read and write CLI configuration');

  config
    .option('--list', 'List all configuration values')
    .option('--json', 'Output as JSON')
    .action((opts: { list?: boolean; json?: boolean }) => {
      if (opts.list) {
        const all = configService.getAll();
        const display = { ...all };
        if (display.jwt) display.jwt = '***';
        const json = opts.json ?? !process.stdout.isTTY;
        formatOutput(display, { json });
      }
    });

  config
    .command('get <key>')
    .description('Get a configuration value')
    .option('--json', 'Output as JSON')
    .action((key: string, opts: { json?: boolean }) => {
      if (!(KNOWN_CONFIG_KEYS as readonly string[]).includes(key)) {
        printError(
          `Unknown config key: ${key}. Known keys: ${KNOWN_CONFIG_KEYS.join(', ')}`,
        );
        process.exitCode = EXIT_CODES.VALIDATION_ERROR;
        return;
      }

      const value = configService.get(key as ConfigKey);
      if (value === undefined) {
        printError(`Key '${key}' is not set`);
        process.exitCode = EXIT_CODES.NOT_FOUND;
        return;
      }

      const json = opts.json ?? !process.stdout.isTTY;

      if (json) {
        formatOutput({ [key]: value }, { json: true });
      } else {
        // Single value: print as plain text per D-04
        console.log(value);
      }
    });

  config
    .command('set <key> <value>')
    .description('Set a configuration value')
    .option('--json', 'Output as JSON')
    .action((key: string, value: string, opts: { json?: boolean }) => {
      if (!(KNOWN_CONFIG_KEYS as readonly string[]).includes(key)) {
        printError(
          `Unknown config key: ${key}. Known keys: ${KNOWN_CONFIG_KEYS.join(', ')}`,
        );
        process.exitCode = EXIT_CODES.VALIDATION_ERROR;
        return;
      }

      configService.set(key as ConfigKey, value);

      const json = opts.json ?? !process.stdout.isTTY;

      if (json) {
        formatOutput({ [key]: value }, { json: true });
      } else {
        printSuccess(`Set ${key}`);
      }
    });

  config
    .command('unset <key>')
    .description('Remove a configuration value')
    .option('--json', 'Output as JSON')
    .action((key: string, opts: { json?: boolean }) => {
      if (!(KNOWN_CONFIG_KEYS as readonly string[]).includes(key)) {
        printError(`Unknown config key: ${key}. Known keys: ${KNOWN_CONFIG_KEYS.join(', ')}`);
        process.exitCode = EXIT_CODES.VALIDATION_ERROR;
        return;
      }
      configService.delete(key as ConfigKey);
      const json = opts.json ?? !process.stdout.isTTY;
      formatOutput({ unset: key }, { json });
    });

  return config;
}
