import { Command } from 'commander';
import * as clack from '@clack/prompts';
import ora from 'ora';
import { walletService } from '../services/wallet-service.js';
import { getPassphrase } from '../utils/prompt.js';
import { formatOutput, printError } from '../utils/output.js';
import { AppError, EXIT_CODES } from '../utils/errors.js';

export function walletCommand(): Command {
  const wallet = new Command('wallet').description('Manage your Solana wallet');

  // wallet create
  wallet
    .command('create')
    .description('Generate a new Solana keypair and store it encrypted')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const passphrase = await getPassphrase({ confirm: true });
        const address = await walletService.create(passphrase);
        formatOutput({ address }, { json: opts.json ?? !process.stdout.isTTY });
        if (process.stdout.isTTY && !opts.json) {
          clack.outro('Wallet created');
        }
      } catch (err) {
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          printError(String(err));
          process.exitCode = EXIT_CODES.GENERAL;
        }
      }
    });

  // wallet import
  wallet
    .command('import')
    .description('Import an existing Solana keypair (base58 or mnemonic)')
    .option('--base58 <key>', 'Import from base58-encoded private key')
    .option('--mnemonic <words>', 'Import from BIP39 mnemonic phrase')
    .option('--json', 'Output as JSON')
    .action(async (opts: { base58?: string; mnemonic?: string; json?: boolean }) => {
      // Exactly one of --base58 or --mnemonic required
      if ((!opts.base58 && !opts.mnemonic) || (opts.base58 && opts.mnemonic)) {
        printError('Provide exactly one of --base58 <key> or --mnemonic <words>');
        process.exitCode = EXIT_CODES.VALIDATION_ERROR;
        return;
      }

      try {
        const passphrase = await getPassphrase({ confirm: true });
        let address: string;

        if (opts.base58) {
          address = await walletService.importFromBase58(opts.base58, passphrase);
        } else {
          address = await walletService.importFromMnemonic(opts.mnemonic!, passphrase);
        }

        formatOutput({ address }, { json: opts.json ?? !process.stdout.isTTY });
        if (process.stdout.isTTY && !opts.json) {
          clack.outro('Wallet imported');
        }
      } catch (err) {
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          printError(String(err));
          process.exitCode = EXIT_CODES.GENERAL;
        }
      }
    });

  // wallet address
  wallet
    .command('address')
    .description('Print the wallet public key (no passphrase required)')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const address = await walletService.getAddress();
        // Single value: plain text per D-04
        if (opts.json || !process.stdout.isTTY) {
          formatOutput({ address }, { json: true });
        } else {
          console.log(address);
        }
      } catch (err) {
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          printError(String(err));
          process.exitCode = EXIT_CODES.GENERAL;
        }
      }
    });

  // wallet balance
  wallet
    .command('balance')
    .description('Show SOL and USDC balances')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      // Show ora spinner on stderr in TTY only (Pitfall 7)
      const spinner = process.stderr.isTTY ? ora({ text: 'Checking balance...', stream: process.stderr }).start() : null;

      try {
        const { sol, usdc } = await walletService.getBalance();
        spinner?.succeed('Balance loaded');
        formatOutput({ sol, usdc }, { json: opts.json ?? !process.stdout.isTTY });
      } catch (err) {
        spinner?.fail('Failed to fetch balance');
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          printError(String(err));
          process.exitCode = EXIT_CODES.GENERAL;
        }
      }
    });

  // wallet export
  wallet
    .command('export')
    .description('Export the private key (always requires interactive passphrase entry)')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      // Per D-15: always re-prompt interactively; never use env var
      if (!process.stdin.isTTY) {
        printError('wallet export requires interactive passphrase entry');
        process.exitCode = EXIT_CODES.AUTH_ERROR;
        return;
      }

      try {
        // Use @clack/prompts password() directly — NOT getPassphrase (per D-15)
        const passphrase = await clack.password({
          message: 'Enter wallet passphrase to export private key',
        });

        if (clack.isCancel(passphrase)) {
          clack.cancel('Cancelled.');
          process.exitCode = EXIT_CODES.GENERAL;
          return;
        }

        const privateKey = await walletService.exportPrivateKey(passphrase as string);
        // Single value: plain text per D-04
        if (opts.json || !process.stdout.isTTY) {
          formatOutput({ privateKey }, { json: true });
        } else {
          console.log(privateKey);
        }
      } catch (err) {
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          printError(String(err));
          process.exitCode = EXIT_CODES.GENERAL;
        }
      }
    });

  return wallet;
}
