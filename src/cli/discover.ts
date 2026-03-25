import { Command } from 'commander';
import ora from 'ora';
import { apiClient } from '../services/api-client.js';
import type { DiscoverResult } from '../types/api.js';
import { printTable, truncate, printSuccess } from '../utils/output.js';
import { parsePrice, formatPrice } from '../utils/price.js';

export function discoverCommand(): Command {
  return new Command('discover')
    .description('Search discoverable resources on Mainlayer')
    .option('--json', 'Output as JSON')
    .option('--query <text>', 'Text search on slug and description')
    .option('--fee-model <model>', 'Filter by fee model (one_time, subscription, pay_per_call, hybrid)')
    .option('--max-price <usdc>', 'Maximum price in USDC (decimal or micro-units)')
    .option('--type <type>', 'Filter by resource type (api, file, endpoint, page)')
    .option('--limit <n>', 'Number of results (default: 20, max: 100)', '20')
    .action(async (opts) => {
      const json = opts.json ?? !process.stdout.isTTY;

      const params: Record<string, string> = {};
      const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 20, 1), 100);
      params['limit'] = String(limit);
      if (opts.query) params['q'] = opts.query;
      if (opts.feeModel) params['fee_model'] = opts.feeModel;
      if (opts.maxPrice) params['max_price'] = String(parsePrice(opts.maxPrice));
      if (opts.type) params['type'] = opts.type;

      const spinner = ora({ text: 'Searching resources...', stream: process.stderr }).start();
      let items: DiscoverResult[];
      try {
        items = await apiClient.get<DiscoverResult[]>('resources/discover', params);
      } finally {
        spinner.stop();
      }

      if (json) {
        console.log(JSON.stringify(items));
        return;
      }

      if (items.length === 0) {
        printSuccess('No resources found.');
        return;
      }

      // Per D-05: columns are ID, SLUG, TYPE, PRICE, FEE MODEL
      printTable(
        ['ID', 'SLUG', 'TYPE', 'PRICE', 'FEE MODEL'],
        items.map((r) => [
          truncate(r.id, 12),
          truncate(r.slug, 24),
          r.type,
          formatPrice(r.price_usdc),
          r.fee_model,
        ]),
      );
    });
}
