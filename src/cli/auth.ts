import { Command } from 'commander';
import ora from 'ora';
import * as clack from '@clack/prompts';
import { apiClient } from '../services/api-client.js';
import { configService } from '../services/config-service.js';
import { getCredentials } from '../utils/prompt.js';
import { formatOutput, printError } from '../utils/output.js';
import { AppError, EXIT_CODES } from '../utils/errors.js';
import type { AuthResponse, ApiKeyResponse } from '../types/api.js';

export function authCommand(): Command {
  const auth = new Command('auth').description('Authentication commands');

  // auth register
  auth
    .command('register')
    .description('Create a new Mainlayer account')
    .option('--email <email>', 'Email address')
    .option('--password <password>', 'Password')
    .option('--json', 'Output as JSON')
    .action(async (opts: { email?: string; password?: string; json?: boolean }) => {
      try {
        const { email, password } = await getCredentials(opts);

        const spinner = ora({ text: 'Creating account...', stream: process.stderr }).start();

        let response: AuthResponse;
        try {
          response = await apiClient.post<AuthResponse>('auth/register', { email, password });
        } finally {
          spinner.stop();
        }

        configService.set('jwt', response.token);
        configService.set('jwtExpiresAt', response.expiresAt);
        configService.set('userId', response.userId);
        configService.set('email', response.email);

        const json = opts.json ?? false;
        formatOutput({ email: response.email, userId: response.userId }, { json });

        if (process.stdout.isTTY && !json) {
          clack.outro('Account created');
        }
      } catch (err) {
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          throw err;
        }
      }
    });

  // auth login
  auth
    .command('login')
    .description('Log in to your Mainlayer account')
    .option('--email <email>', 'Email address')
    .option('--password <password>', 'Password')
    .option('--json', 'Output as JSON')
    .action(async (opts: { email?: string; password?: string; json?: boolean }) => {
      try {
        const { email, password } = await getCredentials(opts);

        const spinner = ora({ text: 'Logging in...', stream: process.stderr }).start();

        let response: AuthResponse;
        try {
          response = await apiClient.post<AuthResponse>('auth/login', { email, password });
        } finally {
          spinner.stop();
        }

        configService.set('jwt', response.token);
        configService.set('jwtExpiresAt', response.expiresAt);
        configService.set('userId', response.userId);
        configService.set('email', response.email);

        const json = opts.json ?? false;
        formatOutput({ email: response.email, authenticated: true }, { json });

        if (process.stdout.isTTY && !json) {
          clack.outro('Logged in');
        }
      } catch (err) {
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          throw err;
        }
      }
    });

  // auth logout
  auth
    .command('logout')
    .description('Log out of your Mainlayer account')
    .option('--json', 'Output as JSON')
    .action((opts: { json?: boolean }) => {
      configService.delete('jwt');
      configService.delete('jwtExpiresAt');
      configService.delete('userId');
      configService.delete('email');

      const json = opts.json ?? false;
      formatOutput({ loggedOut: true }, { json });

      if (process.stdout.isTTY && !json) {
        clack.outro('Logged out');
      }
    });

  // auth status
  auth
    .command('status')
    .description('Show current authentication status')
    .option('--json', 'Output as JSON')
    .action((opts: { json?: boolean }) => {
      const email = configService.get('email');
      const jwt = configService.get('jwt');
      const jwtExpiresAt = configService.get('jwtExpiresAt');

      const authenticated = !!jwt;
      const expired = jwtExpiresAt ? new Date(jwtExpiresAt) < new Date() : false;

      const json = opts.json ?? false;
      formatOutput({ email: email ?? '', authenticated, expired }, { json });
    });

  // auth api-key subcommand group
  const apiKey = new Command('api-key').description('Manage API keys');

  // auth api-key create
  apiKey
    .command('create')
    .description('Create a new API key')
    .option('--label <label>', 'Label for the API key')
    .option('--json', 'Output as JSON')
    .action(async (opts: { label?: string; json?: boolean }) => {
      if (!opts.label) {
        printError('--label is required');
        process.exitCode = EXIT_CODES.VALIDATION_ERROR;
        return;
      }

      try {
        const response = await apiClient.post<ApiKeyResponse>('auth/api-keys', {
          label: opts.label,
        });

        const json = opts.json ?? false;

        if (!json && process.stdout.isTTY) {
          printError('This is the only time the API key value will be shown. Save it now.');
        }

        formatOutput(
          { id: response.id, label: response.label, key: response.key ?? '' },
          { json },
        );
      } catch (err) {
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          throw err;
        }
      }
    });

  // auth api-key list
  apiKey
    .command('list')
    .description('List all active API keys')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const keys = await apiClient.get<ApiKeyResponse[]>('auth/api-keys');

        const json = opts.json ?? false;

        if (json || !process.stdout.isTTY) {
          console.log(JSON.stringify(keys));
        } else {
          for (const k of keys) {
            console.log(`id: ${k.id}  label: ${k.label}  created: ${k.createdAt}`);
          }
        }
      } catch (err) {
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          throw err;
        }
      }
    });

  // auth api-key revoke
  apiKey
    .command('revoke <id>')
    .description('Revoke an API key by ID')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts: { json?: boolean }) => {
      try {
        await apiClient.delete(`auth/api-keys/${id}`);

        const json = opts.json ?? false;
        formatOutput({ revoked: true, id }, { json });

        if (process.stdout.isTTY && !json) {
          clack.outro('API key revoked');
        }
      } catch (err) {
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          throw err;
        }
      }
    });

  auth.addCommand(apiKey);

  return auth;
}
