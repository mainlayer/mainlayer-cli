import { Command } from 'commander';
import ora from 'ora';
import { apiClient } from '../services/api-client.js';
import { formatOutput, printError } from '../utils/output.js';
import { AppError, EXIT_CODES } from '../utils/errors.js';
import type { QuotaResponse } from '../types/api.js';

export function buildQuotaCommand(): Command {
  const quota = new Command('quota').description('Manage per-wallet quota limits');

  // resource quota set
  quota
    .command('set')
    .description('Set per-wallet quota limits for a resource')
    .option('--resource-id <id>', 'Resource ID (required)')
    .option('--max-purchases <n>', 'Max purchases per wallet')
    .option('--max-calls-per-day <n>', 'Max calls per day per wallet')
    .option('--json', 'Output as JSON')
    .action(
      async (opts: {
        resourceId?: string;
        maxPurchases?: string;
        maxCallsPerDay?: string;
        json?: boolean;
      }) => {
        try {
          const json = opts.json ?? false;
          if (!opts.resourceId) {
            printError('Missing required flag: --resource-id');
            process.exitCode = EXIT_CODES.VALIDATION_ERROR;
            return;
          }
          if (!opts.maxPurchases && !opts.maxCallsPerDay) {
            printError('At least one of --max-purchases or --max-calls-per-day must be provided');
            process.exitCode = EXIT_CODES.VALIDATION_ERROR;
            return;
          }
          const resourceId = opts.resourceId;

          const body = {
            ...(opts.maxPurchases !== undefined && {
              max_purchases_per_wallet: Number(opts.maxPurchases),
            }),
            ...(opts.maxCallsPerDay !== undefined && {
              max_calls_per_day_per_wallet: Number(opts.maxCallsPerDay),
            }),
          };

          const spinner = ora({ text: 'Setting quota...', stream: process.stderr }).start();
          let response: QuotaResponse;
          try {
            response = await apiClient.put<QuotaResponse>(`resources/${resourceId}/quota`, body);
          } finally {
            spinner.stop();
          }

          formatOutput(
            {
              resource_id: response.resource_id,
              max_purchases_per_wallet: response.max_purchases_per_wallet ?? 'unlimited',
              max_calls_per_day_per_wallet: response.max_calls_per_day_per_wallet ?? 'unlimited',
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
      },
    );

  // resource quota get
  quota
    .command('get')
    .description('Get quota limits for a resource')
    .option('--resource-id <id>', 'Resource ID (required)')
    .option('--json', 'Output as JSON')
    .action(async (opts: { resourceId?: string; json?: boolean }) => {
      try {
        const json = opts.json ?? false;
        if (!opts.resourceId) {
          printError('Missing required flag: --resource-id');
          process.exitCode = EXIT_CODES.VALIDATION_ERROR;
          return;
        }
        const resourceId = opts.resourceId;

        const spinner = ora({ text: 'Loading quota...', stream: process.stderr }).start();
        let response: QuotaResponse;
        try {
          response = await apiClient.get<QuotaResponse>(`resources/${resourceId}/quota`);
        } finally {
          spinner.stop();
        }

        formatOutput(
          {
            resource_id: response.resource_id,
            max_purchases_per_wallet: response.max_purchases_per_wallet ?? 'unlimited',
            max_calls_per_day_per_wallet: response.max_calls_per_day_per_wallet ?? 'unlimited',
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

  // resource quota delete
  quota
    .command('delete')
    .description('Remove quota limits for a resource')
    .option('--resource-id <id>', 'Resource ID (required)')
    .option('--json', 'Output as JSON')
    .action(async (opts: { resourceId?: string; json?: boolean }) => {
      try {
        const json = opts.json ?? false;
        if (!opts.resourceId) {
          printError('Missing required flag: --resource-id');
          process.exitCode = EXIT_CODES.VALIDATION_ERROR;
          return;
        }
        const resourceId = opts.resourceId;

        const spinner = ora({ text: 'Removing quota...', stream: process.stderr }).start();
        try {
          await apiClient.delete<{ message: string }>(`resources/${resourceId}/quota`);
        } finally {
          spinner.stop();
        }

        formatOutput({ removed: true, resource_id: resourceId }, { json });
      } catch (err) {
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          throw err;
        }
      }
    });

  return quota;
}
