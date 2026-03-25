import { Command } from 'commander';
import ora from 'ora';
import * as clack from '@clack/prompts';
import { apiClient } from '../services/api-client.js';
import { walletService } from '../services/wallet-service.js';
import type { PrepareResponse, PayResponse } from '../types/api.js';
import { formatOutput, printError } from '../utils/output.js';
import { formatPrice } from '../utils/price.js';
import { getPassphrase } from '../utils/prompt.js';
import { AppError, EXIT_CODES } from '../utils/errors.js';

export function buyCommand(): Command {
  return new Command('buy')
    .description('Purchase a resource via X402 Solana USDC payment')
    .argument('<resource-id>', 'Resource ID to purchase')
    .option('--json', 'Output as JSON')
    .option('--plan <name>', 'Select pricing plan')
    .option('--coupon <code>', 'Apply discount coupon code')
    .option('--chain <chain>', 'Blockchain to use (solana, base, polygon)', 'solana')
    .action(async (resourceId: string, opts) => {
      try {
        const json = opts.json ?? !process.stdout.isTTY;

        // 1. Resolve passphrase (env var > TTY prompt; error if headless without env)
        const passphrase = await getPassphrase();

        // 2. Get wallet address
        const walletAddr = await walletService.getAddress();

        // 3. STEP 1 — POST /pay/prepare
        const spinner = ora({ text: 'Preparing transaction...', stream: process.stderr }).start();
        let prepare: PrepareResponse;
        try {
          prepare = await apiClient.post<PrepareResponse>('pay/prepare', {
            resource_id: resourceId,
            payer_wallet: walletAddr,
            chain: opts.chain,
            plan: opts.plan,
            coupon_code: opts.coupon,
          });
        } catch (err) {
          spinner.stop();
          // Surface plan_required error with helpful message (Pitfall 6)
          if (err instanceof AppError && err.message.includes('plan_required')) {
            throw new AppError(
              'This resource requires a pricing plan. Re-run with --plan <name>. Use "mainlayer discover" to see available plans.',
              EXIT_CODES.VALIDATION_ERROR,
            );
          }
          throw err;
        }
        spinner.stop();

        // 4. TTY confirmation (per D-02): show resource, price, plan before signing
        if (process.stdout.isTTY && !json) {
          const confirmed = await clack.confirm({
            message: `Pay ${formatPrice(prepare.amount_usdc)} for resource ${resourceId}${opts.plan ? ` (plan: ${opts.plan})` : ''}?`,
          });
          if (!confirmed || clack.isCancel(confirmed)) {
            process.exitCode = EXIT_CODES.GENERAL;
            return;
          }
        }

        // 5. STEP 2 — Sign transaction locally
        const signSpinner = ora({ text: 'Signing transaction...', stream: process.stderr }).start();
        const signedTxB64 = await walletService.signTransaction(passphrase, prepare.unsigned_transaction);
        signSpinner.stop();

        // 6. STEP 3 — POST /pay with signed transaction
        const submitSpinner = ora({ text: 'Submitting payment...', stream: process.stderr }).start();
        let result: PayResponse;
        try {
          result = await apiClient.post<PayResponse>('pay', {
            resource_id: resourceId,
            payer_wallet: walletAddr,
            signed_transaction: signedTxB64,
            chain: opts.chain,
            plan: opts.plan,
            coupon_code: opts.coupon,
          });
        } catch (err) {
          submitSpinner.stop();
          // Surface tx_expired with retry hint (Pitfall 7)
          if (err instanceof AppError && err.message.includes('tx_expired')) {
            throw new AppError(
              'Transaction expired (blockhash too old). Please try again.',
              EXIT_CODES.GENERAL,
            );
          }
          throw err;
        }
        submitSpinner.stop();

        // 7. Output (per D-04): key-value block in human mode, full JSON in --json
        formatOutput(
          {
            resource: result.resource_id,
            amount: formatPrice(result.amount_usdc),
            tx_hash: result.tx_hash,
            entitlement_id: result.entitlement_id,
          },
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
}
