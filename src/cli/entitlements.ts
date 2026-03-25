import { Command } from 'commander';
import ora from 'ora';
import { apiClient } from '../services/api-client.js';
import type { Entitlement } from '../types/api.js';
import { printTable, truncate, printSuccess } from '../utils/output.js';

export function entitlementsCommand(): Command {
  return new Command('entitlements')
    .description('List your active entitlements (access rights)')
    .option('--json', 'Output as JSON')
    .option('--resource-id <id>', 'Filter by resource ID')
    .option('--limit <n>', 'Number of results (default: 20)', '20')
    .action(async (opts) => {
      const json = opts.json ?? !process.stdout.isTTY;

      const params: Record<string, string> = { limit: opts.limit };
      const spinner = ora({ text: 'Fetching entitlements...', stream: process.stderr }).start();
      let items: Entitlement[];
      try {
        items = await apiClient.get<Entitlement[]>('entitlements/my', params);
      } finally {
        spinner.stop();
      }

      // Optional client-side filter by resource-id
      if (opts.resourceId) {
        items = items.filter((e) => e.resource_id === opts.resourceId);
      }

      if (json) {
        console.log(JSON.stringify(items));
        return;
      }

      if (items.length === 0) {
        printSuccess('No entitlements found.');
        return;
      }

      printTable(
        ['RESOURCE ID', 'SLUG', 'STATUS', 'EXPIRES', 'CREDITS'],
        items.map((e) => [
          truncate(e.resource_id, 12),
          truncate(e.resource_slug, 24),
          e.status,
          e.expires_at ?? 'never',
          e.remaining_credits !== null ? String(e.remaining_credits) : 'unlimited',
        ]),
      );
    });
}
