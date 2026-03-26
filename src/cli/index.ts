#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { authCommand } from './auth.js';
import { walletCommand } from './wallet.js';
import { configCommand } from './config.js';
import { webhookCommand } from './webhook.js';
import { resourceCommand } from './resource.js';
import { couponCommand } from './coupon.js';
import { earningsCommand } from './earnings.js';
import { metricsCommand } from './metrics.js';
import { discoverCommand } from './discover.js';
import { buyCommand } from './buy.js';
import { entitlementsCommand } from './entitlements.js';
import { subscribeCommand } from './subscribe.js';
import { invoicesCommand } from './invoices.js';
import { refundCommand } from './refund.js';
import { disputeCommand } from './dispute.js';
import { setupCommand } from './setup.js';
import { apiClient } from '../services/api-client.js';
import { configService } from '../services/config-service.js';
import { checkForUpdates } from '../utils/update-check.js';
import { printError } from '../utils/output.js';
import { AppError } from '../utils/errors.js';

const program = new Command('mainlayer')
  .description('Mainlayer CLI — AI-native payment infrastructure')
  .showSuggestionAfterError(true)
  .version('0.1.0', '-v, --version')
  .option('--json', 'Output machine-readable JSON')
  .option('--api-key <key>', 'API key override (also: MAINLAYER_API_KEY env)', process.env['MAINLAYER_API_KEY'])
  .option('--profile <name>', 'Use named profile for config/auth isolation', process.env['MAINLAYER_PROFILE'])
  .addCommand(authCommand())
  .addCommand(walletCommand())
  .addCommand(configCommand())
  .addCommand(webhookCommand())
  .addCommand(resourceCommand())
  .addCommand(couponCommand())
  .addCommand(earningsCommand())
  .addCommand(metricsCommand())
  .addCommand(discoverCommand())
  .addCommand(buyCommand())
  .addCommand(entitlementsCommand())
  .addCommand(subscribeCommand())
  .addCommand(invoicesCommand())
  .addCommand(refundCommand())
  .addCommand(disputeCommand())
  .addCommand(setupCommand());

// Global hook: propagate --api-key and --profile to services before any subcommand action
program.hook('preAction', () => {
  const opts = program.opts<{ json?: boolean; apiKey?: string; profile?: string }>();
  if (opts.apiKey) {
    apiClient.setApiKeyOverride(opts.apiKey);
  }
  const profile = opts.profile ?? configService.getActiveProfile();
  if (profile !== 'default') {
    configService.setProfile(profile);
  }
  checkForUpdates().catch(() => {});
});

// Prevent Commander from calling process.exit directly for --help / --version
program.exitOverride();

(async () => {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof AppError) {
      const useJson = process.argv.includes('--json') || !process.stdout.isTTY;
      if (useJson) {
        console.log(JSON.stringify({
          error: true,
          message: err.message,
          code: err.exitCode,
          type: err.meta?.type ?? 'error',
          hint: err.meta?.hint ?? null,
        }));
      } else {
        printError(err.message);
        if (err.meta?.hint) {
          process.stderr.write(chalk.yellow(err.meta.hint) + '\n');
        }
      }
      process.exitCode = err.exitCode;
    } else if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).name === 'CommanderError'
    ) {
      // Commander handles --help, --version, and usage errors internally.
      // exitCode is already set by Commander; nothing more to do.
    } else {
      printError(String(err));
      process.exitCode = 1;
    }
  }
})();
