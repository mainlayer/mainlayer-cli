import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { apiClient } from '../services/api-client.js';
import { formatOutput, printTable, truncate, printError, printSuccess } from '../utils/output.js';
import { AppError, EXIT_CODES } from '../utils/errors.js';
import type { WebhookLog } from '../types/api.js';

export function webhookCommand(): Command {
  const webhook = new Command('webhook').description('Webhook management commands');

  // webhook update
  webhook
    .command('update')
    .description('Update the webhook callback URL for a resource')
    .requiredOption('--resource-id <id>', 'Resource ID')
    .requiredOption('--callback-url <url>', 'New callback URL')
    .option('--json', 'Output as JSON')
    .action(async (opts: { resourceId: string; callbackUrl: string; json?: boolean }) => {
      const resourceId = opts.resourceId;
      const callbackUrl = opts.callbackUrl;
      const json = opts.json ?? false;

      if (!resourceId || !callbackUrl) {
        printError('--resource-id and --callback-url are required');
        process.exitCode = EXIT_CODES.VALIDATION_ERROR;
        return;
      }

      const spinner = ora({ text: 'Updating webhook...', stream: process.stderr }).start();
      try {
        await apiClient.put<{ message: string }>('webhooks/' + resourceId, {
          callback_url: callbackUrl,
        });
        spinner.stop();
        formatOutput({ resource_id: resourceId, callback_url: callbackUrl, updated: true }, { json });
      } catch (err) {
        spinner.stop();
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          throw err;
        }
      }
    });

  // webhook logs
  webhook
    .command('logs')
    .description('View webhook delivery logs')
    .option('--status <status>', 'Filter by status')
    .option('--limit <n>', 'Max results to return', '20')
    .option('--json', 'Output as JSON')
    .action(async (opts: { status?: string; limit?: string; json?: boolean }) => {
      const json = opts.json ?? false;
      const params: Record<string, string> = {};
      if (opts.status) params['status'] = opts.status;
      if (opts.limit) params['limit'] = opts.limit;

      const spinner = ora({ text: 'Loading webhook logs...', stream: process.stderr }).start();
      try {
        const logs = await apiClient.get<WebhookLog[]>('webhooks/logs', params);
        spinner.stop();

        if (json) {
          console.log(JSON.stringify(logs));
          return;
        }

        if (logs.length === 0) {
          console.log('No webhook logs found.');
          return;
        }

        printTable(
          ['LOG_ID', 'PAYMENT_ID', 'STATUS', 'HTTP', 'ATTEMPTS'],
          logs.map((l) => [
            truncate(l.id, 12),
            truncate(l.payment_id, 12),
            l.status,
            String(l.http_status ?? '-'),
            String(l.attempts),
          ]),
        );
      } catch (err) {
        spinner.stop();
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          throw err;
        }
      }
    });

  // webhook retry <log-id>
  webhook
    .command('retry <log-id>')
    .description('Retry a failed webhook delivery')
    .option('--json', 'Output as JSON')
    .action(async (logId: string, opts: { json?: boolean }) => {
      const json = opts.json ?? false;

      const spinner = ora({ text: 'Retrying webhook delivery...', stream: process.stderr }).start();
      try {
        await apiClient.post<{ message: string }>('webhooks/logs/' + logId + '/retry');
        spinner.stop();
        formatOutput({ retried: true, log_id: logId }, { json });
      } catch (err) {
        spinner.stop();
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          throw err;
        }
      }
    });

  // webhook rotate-secret
  webhook
    .command('rotate-secret')
    .description('Rotate the webhook secret for a resource')
    .requiredOption('--resource-id <id>', 'Resource ID')
    .option('--force', 'Confirm secret rotation')
    .option('--json', 'Output as JSON')
    .action(async (opts: { resourceId: string; force?: boolean; json?: boolean }) => {
      const resourceId = opts.resourceId;
      const json = opts.json ?? false;

      if (!resourceId) {
        printError('--resource-id is required');
        process.exitCode = EXIT_CODES.VALIDATION_ERROR;
        return;
      }

      if (!opts.force) {
        printError(
          "Error: This will rotate the webhook secret for resource '" +
            resourceId +
            "'. The old secret remains valid for 24 hours. Run with --force to confirm.",
        );
        process.exitCode = EXIT_CODES.GENERAL;
        return;
      }

      const spinner = ora({ text: 'Rotating webhook secret...', stream: process.stderr }).start();
      try {
        const response = await apiClient.post<{ webhook_secret: string }>(
          'webhooks/' + resourceId + '/rotate-secret',
        );
        spinner.stop();

        if (json) {
          console.log(JSON.stringify(response));
          return;
        }

        printSuccess('New webhook secret:');
        console.log(response.webhook_secret);
        console.error(chalk.yellow('Save this secret now. It will not be shown again in this form.'));
      } catch (err) {
        spinner.stop();
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          throw err;
        }
      }
    });

  return webhook;
}
