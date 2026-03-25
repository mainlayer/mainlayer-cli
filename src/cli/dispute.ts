import { Command } from 'commander';
import ora from 'ora';
import { apiClient } from '../services/api-client.js';
import { walletService } from '../services/wallet-service.js';
import type { DisputeResponse } from '../types/api.js';
import { formatOutput, printTable, truncate, printSuccess } from '../utils/output.js';

function createSubcommand(): Command {
  return new Command('create')
    .description('Create a dispute for a payment')
    .option('--json', 'Output as JSON')
    .requiredOption('--payment-id <id>', 'Payment ID to dispute')
    .requiredOption('--reason <text>', 'Reason for dispute')
    .action(async (opts) => {
      const json = opts.json ?? !process.stdout.isTTY;
      const walletAddr = await walletService.getAddress();

      const spinner = ora({ text: 'Creating dispute...', stream: process.stderr }).start();
      let result: DisputeResponse;
      try {
        result = await apiClient.post<DisputeResponse>('disputes', {
          payment_id: opts.paymentId,
          reason: opts.reason,
          payer_wallet: walletAddr,
        });
      } finally {
        spinner.stop();
      }

      formatOutput(
        {
          dispute_id: result.dispute_id,
          payment_id: result.payment_id,
          status: result.status,
          reason: result.reason,
        },
        { json },
      );
    });
}

function listSubcommand(): Command {
  return new Command('list')
    .description('List disputes (for resources you own)')
    .option('--json', 'Output as JSON')
    .option('--limit <n>', 'Number of results (default: 20)', '20')
    .action(async (opts) => {
      const json = opts.json ?? !process.stdout.isTTY;
      const params: Record<string, string> = { limit: opts.limit };

      const spinner = ora({ text: 'Fetching disputes...', stream: process.stderr }).start();
      let items: DisputeResponse[];
      try {
        items = await apiClient.get<DisputeResponse[]>('disputes', params);
      } finally {
        spinner.stop();
      }

      if (json) {
        console.log(JSON.stringify(items));
        return;
      }

      if (items.length === 0) {
        printSuccess('No disputes found.');
        return;
      }

      printTable(
        ['DISPUTE ID', 'PAYMENT ID', 'STATUS', 'REASON'],
        items.map((d) => [
          truncate(d.dispute_id, 12),
          truncate(d.payment_id, 12),
          d.status,
          truncate(d.reason, 30),
        ]),
      );
    });
}

export function disputeCommand(): Command {
  return new Command('dispute')
    .description('Manage disputes')
    .addCommand(createSubcommand())
    .addCommand(listSubcommand());
}
