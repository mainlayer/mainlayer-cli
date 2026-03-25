import { Command } from 'commander';
import ora from 'ora';
import { apiClient } from '../services/api-client.js';
import type { RefundResponse } from '../types/api.js';
import { formatOutput } from '../utils/output.js';
import { parsePrice } from '../utils/price.js';

function requestSubcommand(): Command {
  return new Command('request')
    .description('Request a refund for a payment (requires ownership of the associated resource)')
    .option('--json', 'Output as JSON')
    .requiredOption('--payment-id <id>', 'Payment ID to refund')
    .requiredOption('--reason <text>', 'Reason for refund')
    .option('--amount <usdc>', 'Refund amount in USDC (defaults to full payment amount)')
    .action(async (opts) => {
      const json = opts.json ?? !process.stdout.isTTY;

      const body: Record<string, unknown> = {
        payment_id: opts.paymentId,
        reason: opts.reason,
      };
      if (opts.amount) {
        body['amount_usdc'] = parsePrice(opts.amount);
      }

      const spinner = ora({ text: 'Submitting refund request...', stream: process.stderr }).start();
      let result: RefundResponse;
      try {
        result = await apiClient.post<RefundResponse>('refunds', body);
      } finally {
        spinner.stop();
      }

      formatOutput(
        {
          id: result.id,
          payment_id: result.payment_id,
          status: result.status,
        },
        { json },
      );
    });
}

export function refundCommand(): Command {
  return new Command('refund')
    .description('Manage refunds')
    .addCommand(requestSubcommand());
}
