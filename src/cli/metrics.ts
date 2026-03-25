import { Command } from 'commander';
import ora from 'ora';
import { apiClient } from '../services/api-client.js';
import { formatOutput, printError } from '../utils/output.js';
import { formatPrice } from '../utils/price.js';
import { AppError, EXIT_CODES } from '../utils/errors.js';
import type { MetricsResponse } from '../types/api.js';

export function metricsCommand(): Command {
  const metrics = new Command('metrics')
    .description('View resource metrics')
    .option('--resource-id <id>', 'Resource ID (required)')
    .option('--json', 'Output as JSON')
    .action(async (opts: { resourceId?: string; json?: boolean }) => {
      if (!opts.resourceId) {
        printError('--resource-id is required');
        process.exitCode = EXIT_CODES.VALIDATION_ERROR;
        return;
      }

      const spinner = ora({ text: 'Loading metrics...', stream: process.stderr }).start();

      let data: MetricsResponse;
      try {
        data = await apiClient.get<MetricsResponse>('vendor/metrics', {
          resource_id: opts.resourceId,
        });
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

      formatOutput(
        {
          resource_id: data.resource_id,
          total_calls: data.total_calls,
          total_revenue: formatPrice(data.total_revenue_usdc),
          unique_buyers: data.unique_buyers,
          quota_calls: data.quota_calls ?? 'unlimited',
          buyers_over_quota: data.buyers_over_quota ?? 0,
        },
        { json: false },
      );
    });

  return metrics;
}
