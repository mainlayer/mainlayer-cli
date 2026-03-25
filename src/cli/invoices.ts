import { Command } from 'commander';
import ora from 'ora';
import { apiClient } from '../services/api-client.js';
import type { InvoiceResponse } from '../types/api.js';
import { formatOutput, printTable, truncate, printSuccess } from '../utils/output.js';
import { formatPrice } from '../utils/price.js';

function listSubcommand(): Command {
  return new Command('list')
    .description('List invoices for resources you own')
    .option('--json', 'Output as JSON')
    .option('--limit <n>', 'Number of results (default: 20)', '20')
    .action(async (opts) => {
      const json = opts.json ?? !process.stdout.isTTY;
      const params: Record<string, string> = { limit: opts.limit };

      const spinner = ora({ text: 'Fetching invoices...', stream: process.stderr }).start();
      let items: InvoiceResponse[];
      try {
        items = await apiClient.get<InvoiceResponse[]>('invoices', params);
      } finally {
        spinner.stop();
      }

      if (json) {
        console.log(JSON.stringify(items));
        return;
      }

      if (items.length === 0) {
        printSuccess('No invoices found.');
        return;
      }

      // Per D-12: compact table ID, RESOURCE, AMOUNT, STATUS, DATE
      printTable(
        ['ID', 'RESOURCE', 'AMOUNT', 'STATUS', 'DATE'],
        items.map((inv) => [
          truncate(inv.id, 12),
          truncate(inv.resource_id, 12),
          formatPrice(inv.amount_usdc),
          inv.status,
          inv.created_at.split('T')[0] ?? inv.created_at,
        ]),
      );
    });
}

function getSubcommand(): Command {
  return new Command('get')
    .description('Get details of a single invoice')
    .argument('<invoice-id>', 'Invoice ID')
    .option('--json', 'Output as JSON')
    .action(async (invoiceId: string, opts) => {
      const json = opts.json ?? !process.stdout.isTTY;

      const spinner = ora({ text: 'Fetching invoice...', stream: process.stderr }).start();
      let invoice: InvoiceResponse;
      try {
        invoice = await apiClient.get<InvoiceResponse>(`invoices/${invoiceId}`);
      } finally {
        spinner.stop();
      }

      formatOutput(
        {
          id: invoice.id,
          resource_id: invoice.resource_id,
          amount: formatPrice(invoice.amount_usdc),
          status: invoice.status,
          created_at: invoice.created_at,
        },
        { json },
      );
    });
}

export function invoicesCommand(): Command {
  return new Command('invoices')
    .description('View invoices for resources you own')
    .addCommand(listSubcommand())
    .addCommand(getSubcommand());
}
