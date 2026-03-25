import { Command } from 'commander';
import ora from 'ora';
import * as clack from '@clack/prompts';
import { apiClient } from '../services/api-client.js';
import { walletService } from '../services/wallet-service.js';
import { formatOutput, printTable, truncate, printError } from '../utils/output.js';
import { parsePrice, formatPrice } from '../utils/price.js';
import { AppError, EXIT_CODES } from '../utils/errors.js';
import type { ResourceResponse, ResourceCreate } from '../types/api.js';

type ResourceType = 'api' | 'file' | 'endpoint' | 'page';
type FeeModel = 'one_time' | 'subscription' | 'pay_per_call' | 'hybrid';

const VALID_TYPES: ResourceType[] = ['api', 'file', 'endpoint', 'page'];
const VALID_FEE_MODELS: FeeModel[] = ['one_time', 'subscription', 'pay_per_call', 'hybrid'];

async function resolveVendorWallet(
  vendorWallet: string | undefined,
  json: boolean,
): Promise<string | undefined> {
  if (vendorWallet) return vendorWallet;
  try {
    const addr = await walletService.getAddress();
    if (process.stdout.isTTY && !json) {
      process.stderr.write(`Using wallet: ${addr}\n`);
    }
    return addr;
  } catch {
    return undefined;
  }
}

async function fetchResourceById(id: string): Promise<ResourceResponse> {
  const resources = await apiClient.get<ResourceResponse[]>('resources');
  const resource = resources.find((r) => r.id === id);
  if (!resource) {
    throw new AppError('Resource not found', EXIT_CODES.NOT_FOUND);
  }
  return resource;
}

function formatResourceDetail(r: ResourceResponse): Record<string, unknown> {
  return {
    id: r.id,
    slug: r.slug,
    type: r.type,
    price: formatPrice(r.price_usdc),
    fee_model: r.fee_model,
    vendor_wallet: r.vendor_wallet,
    description: r.description ?? '',
    discoverable: r.discoverable,
    active: r.active,
    created_at: r.created_at,
  };
}

export function resourceCommand(): Command {
  const resource = new Command('resource').description('Manage vendor resources');

  // resource create
  resource
    .command('create')
    .description('Create a new resource')
    .option('--slug <slug>', 'Resource slug (URL-friendly identifier)')
    .option('--type <type>', 'Resource type: api | file | endpoint | page')
    .option('--price <price>', 'Price in USDC (e.g. 1.00) or micro-units (e.g. 1000000)')
    .option('--fee-model <model>', 'Fee model: one_time | subscription | pay_per_call | hybrid')
    .option('--vendor-wallet <address>', 'Vendor wallet address (auto-fills from local wallet)')
    .option('--description <text>', 'Resource description')
    .option('--discoverable', 'Make resource discoverable in marketplace')
    .option('--callback-url <url>', 'Webhook callback URL')
    .option('--json', 'Output as JSON')
    .action(
      async (opts: {
        slug?: string;
        type?: string;
        price?: string;
        feeModel?: string;
        vendorWallet?: string;
        description?: string;
        discoverable?: boolean;
        callbackUrl?: string;
        json?: boolean;
      }) => {
        try {
          const json = opts.json ?? false;

          let slug = opts.slug;
          let type = opts.type;
          let price = opts.price;
          let feeModel = opts.feeModel;

          const isTTY = process.stdin.isTTY;

          if ((!slug || !type || !price || !feeModel) && isTTY && !json) {
            // Interactive prompts for missing fields
            clack.intro('Create resource');
            if (!slug) {
              const result = await clack.text({ message: 'Slug', placeholder: 'my-api' });
              if (clack.isCancel(result)) { process.exitCode = EXIT_CODES.GENERAL; return; }
              slug = result as string;
            }
            if (!type) {
              const result = await clack.select({
                message: 'Type',
                options: VALID_TYPES.map((t) => ({ value: t, label: t })),
              });
              if (clack.isCancel(result)) { process.exitCode = EXIT_CODES.GENERAL; return; }
              type = result as string;
            }
            if (!price) {
              const result = await clack.text({ message: 'Price (USDC)', placeholder: '1.00' });
              if (clack.isCancel(result)) { process.exitCode = EXIT_CODES.GENERAL; return; }
              price = result as string;
            }
            if (!feeModel) {
              const result = await clack.select({
                message: 'Fee model',
                options: VALID_FEE_MODELS.map((m) => ({ value: m, label: m })),
              });
              if (clack.isCancel(result)) { process.exitCode = EXIT_CODES.GENERAL; return; }
              feeModel = result as string;
            }
          } else {
            const missing: string[] = [];
            if (!slug) missing.push('--slug');
            if (!type) missing.push('--type');
            if (!price) missing.push('--price');
            if (!feeModel) missing.push('--fee-model');
            if (missing.length > 0) {
              printError(`Missing required flags: ${missing.join(', ')}`);
              process.exitCode = EXIT_CODES.VALIDATION_ERROR;
              return;
            }
          }

          const parsedPrice = parsePrice(price!);
          const vendorWallet = await resolveVendorWallet(opts.vendorWallet, json);

          const body: ResourceCreate = {
            slug: slug!,
            type: type! as ResourceType,
            price_usdc: parsedPrice,
            fee_model: feeModel! as FeeModel,
            vendor_wallet: vendorWallet ?? '',
            ...(opts.description !== undefined && { description: opts.description }),
            ...(opts.discoverable !== undefined && { discoverable: opts.discoverable }),
            ...(opts.callbackUrl !== undefined && { callback_url: opts.callbackUrl }),
          };

          const spinner = ora({ text: 'Creating resource...', stream: process.stderr }).start();
          let response: ResourceResponse;
          try {
            response = await apiClient.post<ResourceResponse>('resources', body);
          } finally {
            spinner.stop();
          }

          formatOutput(
            {
              id: response.id,
              slug: response.slug,
              type: response.type,
              price: formatPrice(response.price_usdc),
              fee_model: response.fee_model,
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

  // resource list
  resource
    .command('list')
    .description('List all your resources')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const json = opts.json ?? false;
        const spinner = ora({ text: 'Loading resources...', stream: process.stderr }).start();
        let resources: ResourceResponse[];
        try {
          resources = await apiClient.get<ResourceResponse[]>('resources');
        } finally {
          spinner.stop();
        }

        if (json || !process.stdout.isTTY) {
          console.log(JSON.stringify(resources));
          return;
        }

        if (resources.length === 0) {
          console.log(
            'No resources yet. Run `mainlayer resource create` to register your first one.',
          );
          return;
        }

        printTable(
          ['ID', 'SLUG', 'TYPE', 'PRICE', 'FEE MODEL', 'ACTIVE'],
          resources.map((r) => [
            truncate(r.id, 12),
            truncate(r.slug, 20),
            r.type,
            formatPrice(r.price_usdc),
            r.fee_model,
            r.active ? 'yes' : 'no',
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

  // resource get <id>
  resource
    .command('get <id>')
    .description('Get details of a resource by ID')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts: { json?: boolean }) => {
      try {
        const json = opts.json ?? false;
        const spinner = ora({ text: 'Loading resource...', stream: process.stderr }).start();
        let res: ResourceResponse;
        try {
          res = await fetchResourceById(id);
        } finally {
          spinner.stop();
        }
        formatOutput(formatResourceDetail(res), { json });
      } catch (err) {
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          throw err;
        }
      }
    });

  // resource update <id>
  resource
    .command('update <id>')
    .description('Update a resource')
    .option('--slug <slug>', 'New slug')
    .option('--type <type>', 'New type: api | file | endpoint | page')
    .option('--price <price>', 'New price in USDC or micro-units')
    .option('--fee-model <model>', 'New fee model')
    .option('--vendor-wallet <address>', 'New vendor wallet address')
    .option('--description <text>', 'New description')
    .option('--discoverable', 'Set discoverable to true')
    .option('--no-discoverable', 'Set discoverable to false')
    .option('--callback-url <url>', 'New callback URL')
    .option('--json', 'Output as JSON')
    .action(
      async (
        id: string,
        opts: {
          slug?: string;
          type?: string;
          price?: string;
          feeModel?: string;
          vendorWallet?: string;
          description?: string;
          discoverable?: boolean;
          callbackUrl?: string;
          json?: boolean;
        },
      ) => {
        try {
          const json = opts.json ?? false;
          const spinner = ora({ text: 'Loading resource...', stream: process.stderr }).start();
          let existing: ResourceResponse;
          try {
            existing = await fetchResourceById(id);
          } finally {
            spinner.stop();
          }

          const parsedPrice =
            opts.price !== undefined ? parsePrice(opts.price) : existing.price_usdc;

          const body: ResourceCreate = {
            slug: opts.slug ?? existing.slug,
            type: (opts.type ?? existing.type) as ResourceType,
            price_usdc: parsedPrice,
            fee_model: (opts.feeModel ?? existing.fee_model) as FeeModel,
            vendor_wallet: opts.vendorWallet ?? existing.vendor_wallet,
            description: opts.description ?? existing.description ?? undefined,
            discoverable: opts.discoverable ?? existing.discoverable,
            callback_url: opts.callbackUrl ?? existing.callback_url ?? undefined,
          };

          const updateSpinner = ora({
            text: 'Updating resource...',
            stream: process.stderr,
          }).start();
          let updated: ResourceResponse;
          try {
            updated = await apiClient.put<ResourceResponse>(`resources/${id}`, body);
          } finally {
            updateSpinner.stop();
          }

          formatOutput(formatResourceDetail(updated), { json });
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

  // resource delete <id>
  resource
    .command('delete <id>')
    .description('Delete a resource')
    .option('--force', 'Confirm deletion without prompt')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts: { force?: boolean; json?: boolean }) => {
      try {
        const json = opts.json ?? false;

        if (!opts.force) {
          const spinner = ora({ text: 'Loading resource...', stream: process.stderr }).start();
          let res: ResourceResponse;
          try {
            res = await fetchResourceById(id);
          } finally {
            spinner.stop();
          }
          printError(
            `Error: This will permanently delete resource '${res.slug}'. Run with --force to confirm.`,
          );
          process.exitCode = EXIT_CODES.GENERAL;
          return;
        }

        const spinner = ora({ text: 'Deleting resource...', stream: process.stderr }).start();
        try {
          await apiClient.delete<{ message: string }>(`resources/${id}`);
        } finally {
          spinner.stop();
        }

        formatOutput({ deleted: true, id }, { json });
      } catch (err) {
        if (err instanceof AppError) {
          printError(err.message);
          process.exitCode = err.exitCode;
        } else {
          throw err;
        }
      }
    });

  return resource;
}
