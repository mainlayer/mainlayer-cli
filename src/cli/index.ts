#!/usr/bin/env node
import { Command } from 'commander';
import { configCommand } from './config.js';
import { authCommand } from './auth.js';
import { walletCommand } from './wallet.js';

const program = new Command();

program
  .name('mainlayer')
  .description('Command-line interface to the Mainlayer payment infrastructure')
  .version('0.1.0')
  .option('--json', 'Output as JSON');

program.addCommand(configCommand());
program.addCommand(authCommand());
program.addCommand(walletCommand());

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exitCode = 1;
});
