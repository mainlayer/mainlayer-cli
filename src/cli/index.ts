#!/usr/bin/env node
import { Command } from 'commander';
import { configCommand } from './config.js';

const program = new Command();

program
  .name('mainlayer')
  .description('Command-line interface to the Mainlayer payment infrastructure')
  .version('0.1.0')
  .option('--json', 'Output as JSON');

program.addCommand(configCommand());

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exitCode = 1;
});
