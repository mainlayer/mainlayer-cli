import { Command } from 'commander';
import ora from 'ora';
import { apiClient } from '../services/api-client.js';
import { formatOutput, printTable, printError } from '../utils/output.js';
import { AppError, EXIT_CODES } from '../utils/errors.js';
import type { CouponCreate, CouponResponse } from '../types/api.js';

export function couponCommand(): Command {
  const coupon = new Command('coupon').description('Manage discount coupons for a resource');

  // coupon create
  coupon
    .command('create')
    .description('Create a discount coupon for a resource')
    .option('--resource-id <id>', 'Resource ID (required)')
    .option('--code <code>', 'Coupon code (required, auto-uppercased)')
    .option('--discount-type <type>', 'Discount type: percent | fixed (required)')
    .option('--discount-value <n>', 'Discount amount (required)')
    .option('--max-uses <n>', 'Maximum number of uses')
    .option('--expires-at <iso-date>', 'Expiry date (ISO 8601)')
    .option('--json', 'Output as JSON')
    .action(
      async (opts: {
        resourceId?: string;
        code?: string;
        discountType?: string;
        discountValue?: string;
        maxUses?: string;
        expiresAt?: string;
        json?: boolean;
      }) => {
        try {
          const json = opts.json ?? false;
          const missing: string[] = [];
          if (!opts.resourceId) missing.push('--resource-id');
          if (!opts.code) missing.push('--code');
          if (!opts.discountType) missing.push('--discount-type');
          if (!opts.discountValue) missing.push('--discount-value');
          if (missing.length > 0) {
            printError(`Missing required flags: ${missing.join(', ')}`);
            process.exitCode = EXIT_CODES.VALIDATION_ERROR;
            return;
          }

          const resourceId = opts.resourceId!;
          // Uppercase code client-side (Pitfall 7)
          const code = opts.code!.toUpperCase();

          const body: CouponCreate = {
            code,
            discount_type: opts.discountType! as 'percent' | 'fixed',
            discount_value: Number(opts.discountValue!),
            ...(opts.maxUses !== undefined && { max_uses: Number(opts.maxUses) }),
            ...(opts.expiresAt !== undefined && { expires_at: opts.expiresAt }),
          };

          const spinner = ora({ text: 'Creating coupon...', stream: process.stderr }).start();
          let response: CouponResponse;
          try {
            response = await apiClient.post<CouponResponse>(
              `resources/${resourceId}/coupons`,
              body,
            );
          } finally {
            spinner.stop();
          }

          formatOutput(
            {
              id: response.id,
              code: response.code,
              discount_type: response.discount_type,
              discount_value: response.discount_value,
              active: response.active,
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

  // coupon list
  coupon
    .command('list')
    .description('List coupons for a resource')
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

        const spinner = ora({ text: 'Loading coupons...', stream: process.stderr }).start();
        let coupons: CouponResponse[];
        try {
          coupons = await apiClient.get<CouponResponse[]>(`resources/${resourceId}/coupons`);
        } finally {
          spinner.stop();
        }

        if (json || !process.stdout.isTTY) {
          console.log(JSON.stringify(coupons));
          return;
        }

        if (coupons.length === 0) {
          console.log(
            'No coupons for this resource. Run `mainlayer coupon create` to add one.',
          );
          return;
        }

        printTable(
          ['CODE', 'TYPE', 'VALUE', 'USES', 'MAX', 'EXPIRES'],
          coupons.map((c) => [
            c.code,
            c.discount_type,
            String(c.discount_value),
            String(c.uses_count),
            String(c.max_uses ?? 'unlimited'),
            c.expires_at ?? '-',
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

  // coupon delete <code>
  coupon
    .command('delete <code>')
    .description('Delete a coupon by code')
    .option('--resource-id <id>', 'Resource ID (required)')
    .option('--force', 'Confirm deletion without prompt')
    .option('--json', 'Output as JSON')
    .action(
      async (rawCode: string, opts: { resourceId?: string; force?: boolean; json?: boolean }) => {
        try {
          const json = opts.json ?? false;
          if (!opts.resourceId) {
            printError('Missing required flag: --resource-id');
            process.exitCode = EXIT_CODES.VALIDATION_ERROR;
            return;
          }
          const resourceId = opts.resourceId;
          // Uppercase code client-side (Pitfall 7)
          const code = rawCode.toUpperCase();

          if (!opts.force) {
            printError(
              `Error: This will delete coupon '${code}'. Run with --force to confirm.`,
            );
            process.exitCode = EXIT_CODES.GENERAL;
            return;
          }

          const spinner = ora({ text: 'Deleting coupon...', stream: process.stderr }).start();
          try {
            await apiClient.delete<{ message: string }>(
              `resources/${resourceId}/coupons/${code}`,
            );
          } finally {
            spinner.stop();
          }

          formatOutput({ deleted: true, code }, { json });
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

  return coupon;
}
