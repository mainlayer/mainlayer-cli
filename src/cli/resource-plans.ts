import { Command } from 'commander';
import ora from 'ora';
import { apiClient } from '../services/api-client.js';
import { formatOutput, printTable, printError } from '../utils/output.js';
import { parsePrice, formatPrice } from '../utils/price.js';
import { AppError, EXIT_CODES } from '../utils/errors.js';
import type { PlanCreate, PlanResponse } from '../types/api.js';

export function buildPlanCommand(): Command {
  const plan = new Command('plan').description('Manage pricing plans for a resource');

  // resource plan create
  plan
    .command('create')
    .description('Create a pricing plan for a resource')
    .option('--resource-id <id>', 'Resource ID (required)')
    .option('--name <name>', 'Plan name (required)')
    .option('--price <price>', 'Price in USDC or micro-units (required)')
    .option('--fee-model <model>', 'Fee model: pay_per_call | subscription | one_time (required)')
    .option('--credits-per-payment <n>', 'Credits included per payment')
    .option('--duration-seconds <n>', 'Subscription duration in seconds')
    .option('--max-calls-per-day <n>', 'Max calls per day')
    .option('--json', 'Output as JSON')
    .action(
      async (opts: {
        resourceId?: string;
        name?: string;
        price?: string;
        feeModel?: string;
        creditsPerPayment?: string;
        durationSeconds?: string;
        maxCallsPerDay?: string;
        json?: boolean;
      }) => {
        try {
          const json = opts.json ?? false;
          const missing: string[] = [];
          if (!opts.resourceId) missing.push('--resource-id');
          if (!opts.name) missing.push('--name');
          if (!opts.price) missing.push('--price');
          if (!opts.feeModel) missing.push('--fee-model');
          if (missing.length > 0) {
            printError(`Missing required flags: ${missing.join(', ')}`);
            process.exitCode = EXIT_CODES.VALIDATION_ERROR;
            return;
          }

          const resourceId = opts.resourceId!;
          const parsedPrice = parsePrice(opts.price!);
          const body: PlanCreate = {
            name: opts.name!,
            price_usdc: parsedPrice,
            fee_model: opts.feeModel! as 'pay_per_call' | 'subscription' | 'one_time',
            ...(opts.creditsPerPayment !== undefined && {
              credits_per_payment: Number(opts.creditsPerPayment),
            }),
            ...(opts.durationSeconds !== undefined && {
              duration_seconds: Number(opts.durationSeconds),
            }),
            ...(opts.maxCallsPerDay !== undefined && {
              max_calls_per_day: Number(opts.maxCallsPerDay),
            }),
          };

          const spinner = ora({ text: 'Creating plan...', stream: process.stderr }).start();
          let response: PlanResponse;
          try {
            response = await apiClient.post<PlanResponse>(`resources/${resourceId}/plans`, body);
          } finally {
            spinner.stop();
          }

          formatOutput(
            {
              id: response.id,
              name: response.name,
              price: formatPrice(response.price_usdc),
              fee_model: response.fee_model,
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

  // resource plan list
  plan
    .command('list')
    .description('List pricing plans for a resource')
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

        const spinner = ora({ text: 'Loading plans...', stream: process.stderr }).start();
        let plans: PlanResponse[];
        try {
          plans = await apiClient.get<PlanResponse[]>(`resources/${resourceId}/plans`);
        } finally {
          spinner.stop();
        }

        if (json || !process.stdout.isTTY) {
          console.log(JSON.stringify(plans));
          return;
        }

        if (plans.length === 0) {
          console.log('No plans for this resource. Run `mainlayer resource plan create` to add one.');
          return;
        }

        printTable(
          ['NAME', 'PRICE', 'FEE MODEL', 'CREDITS', 'DURATION'],
          plans.map((p) => [
            p.name,
            formatPrice(p.price_usdc),
            p.fee_model,
            String(p.credits_per_payment ?? '-'),
            String(p.duration_seconds ?? '-'),
          ]),
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

  // resource plan update <plan-name>
  plan
    .command('update <plan-name>')
    .description('Update a pricing plan by name')
    .option('--resource-id <id>', 'Resource ID (required)')
    .option('--price <price>', 'New price in USDC or micro-units')
    .option('--fee-model <model>', 'New fee model: pay_per_call | subscription | one_time')
    .option('--credits-per-payment <n>', 'New credits per payment')
    .option('--duration-seconds <n>', 'New duration in seconds')
    .option('--max-calls-per-day <n>', 'New max calls per day')
    .option('--json', 'Output as JSON')
    .action(
      async (
        planName: string,
        opts: {
          resourceId?: string;
          price?: string;
          feeModel?: string;
          creditsPerPayment?: string;
          durationSeconds?: string;
          maxCallsPerDay?: string;
          json?: boolean;
        },
      ) => {
        try {
          const json = opts.json ?? false;
          if (!opts.resourceId) {
            printError('Missing required flag: --resource-id');
            process.exitCode = EXIT_CODES.VALIDATION_ERROR;
            return;
          }
          const resourceId = opts.resourceId;

          const body: Partial<PlanCreate> = {
            ...(opts.price !== undefined && { price_usdc: parsePrice(opts.price) }),
            ...(opts.feeModel !== undefined && {
              fee_model: opts.feeModel as 'pay_per_call' | 'subscription' | 'one_time',
            }),
            ...(opts.creditsPerPayment !== undefined && {
              credits_per_payment: Number(opts.creditsPerPayment),
            }),
            ...(opts.durationSeconds !== undefined && {
              duration_seconds: Number(opts.durationSeconds),
            }),
            ...(opts.maxCallsPerDay !== undefined && {
              max_calls_per_day: Number(opts.maxCallsPerDay),
            }),
          };

          const spinner = ora({ text: 'Updating plan...', stream: process.stderr }).start();
          let response: PlanResponse;
          try {
            response = await apiClient.put<PlanResponse>(
              `resources/${resourceId}/plans/${planName}`,
              body,
            );
          } finally {
            spinner.stop();
          }

          formatOutput(
            {
              id: response.id,
              name: response.name,
              price: formatPrice(response.price_usdc),
              fee_model: response.fee_model,
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

  // resource plan delete <plan-name>
  plan
    .command('delete <plan-name>')
    .description('Delete a pricing plan by name')
    .option('--resource-id <id>', 'Resource ID (required)')
    .option('--force', 'Confirm deletion without prompt')
    .option('--json', 'Output as JSON')
    .action(
      async (
        planName: string,
        opts: { resourceId?: string; force?: boolean; json?: boolean },
      ) => {
        try {
          const json = opts.json ?? false;
          if (!opts.resourceId) {
            printError('Missing required flag: --resource-id');
            process.exitCode = EXIT_CODES.VALIDATION_ERROR;
            return;
          }
          const resourceId = opts.resourceId;

          if (!opts.force) {
            printError(
              `Error: This will delete plan '${planName}'. Run with --force to confirm.`,
            );
            process.exitCode = EXIT_CODES.GENERAL;
            return;
          }

          const spinner = ora({ text: 'Deleting plan...', stream: process.stderr }).start();
          try {
            await apiClient.delete<{ message: string }>(
              `resources/${resourceId}/plans/${planName}`,
            );
          } finally {
            spinner.stop();
          }

          formatOutput({ deleted: true, plan_name: planName }, { json });
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

  return plan;
}
