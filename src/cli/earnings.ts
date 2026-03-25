import { Command } from 'commander';
import ora from 'ora';
import { apiClient } from '../services/api-client.js';
import { formatOutput, printTable, printError } from '../utils/output.js';
import { formatPrice } from '../utils/price.js';
import { AppError, EXIT_CODES } from '../utils/errors.js';
import type { EarningsResponse } from '../types/api.js';

function expandPeriod(period: '7d' | '30d' | '90d'): { from: string; to: string } {
  const to = new Date();
  const days = { '7d': 7, '30d': 30, '90d': 90 }[period];
  const from = new Date(to.getTime() - days * 86_400_000);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function earningsCommand(): Command {
  const earnings = new Command('earnings')
    .description('View earnings summary')
    .option('--period <period>', 'Time period (7d, 30d, 90d)')
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .option('--resource-id <id>', 'Filter by resource ID')
    .option('--json', 'Output as JSON')
    .action(
      async (opts: {
        period?: string;
        from?: string;
        to?: string;
        resourceId?: string;
        json?: boolean;
      }) => {
        let fromDate: string;
        let toDate: string;

        if (opts.period) {
          // --period takes precedence even if --from/--to also provided
          const validPeriods = ['7d', '30d', '90d'] as const;
          if (!validPeriods.includes(opts.period as (typeof validPeriods)[number])) {
            printError('--period must be one of: 7d, 30d, 90d');
            process.exitCode = EXIT_CODES.VALIDATION_ERROR;
            return;
          }
          const expanded = expandPeriod(opts.period as '7d' | '30d' | '90d');
          fromDate = expanded.from;
          toDate = expanded.to;
        } else if (opts.from || opts.to) {
          // If only one of --from/--to is provided, error
          if (!opts.from || !opts.to) {
            printError('Both --from and --to are required when using date range');
            process.exitCode = EXIT_CODES.VALIDATION_ERROR;
            return;
          }
          fromDate = opts.from;
          toDate = opts.to;
        } else {
          // Default to 30d
          const expanded = expandPeriod('30d');
          fromDate = expanded.from;
          toDate = expanded.to;
        }

        const params: Record<string, string> = { from: fromDate, to: toDate };
        if (opts.resourceId) {
          params['resource_id'] = opts.resourceId;
        }

        const spinner = ora({ text: 'Loading earnings...', stream: process.stderr }).start();

        let data: EarningsResponse;
        try {
          data = await apiClient.get<EarningsResponse>('vendor/earnings', params);
        } catch (err) {
          spinner.stop();
          if (err instanceof AppError) {
            printError(err.message);
            process.exitCode = err.exitCode;
          } else {
            throw err;
          }
          return;
        } finally {
          spinner.stop();
        }

        const json = opts.json ?? false;

        if (json || !process.stdout.isTTY) {
          console.log(JSON.stringify(data));
          return;
        }

        // Human mode: key-value summary block
        formatOutput(
          {
            period: `${fromDate} to ${toDate}`,
            total_calls: data.total_calls,
            total_revenue: formatPrice(data.total_revenue_usdc),
            unique_buyers: data.unique_buyers,
          },
          { json: false },
        );

        // Daily table if non-empty
        if (data.daily.length > 0) {
          console.log(''); // blank line separator
          printTable(
            ['DATE', 'CALLS', 'REVENUE'],
            data.daily.map((d) => [d.date, String(d.calls), formatPrice(d.revenue_usdc)]),
          );
        }
      },
    );

  return earnings;
}
