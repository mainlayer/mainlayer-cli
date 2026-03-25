import { Command } from 'commander';
import ora from 'ora';
import { apiClient } from '../services/api-client.js';
import { walletService } from '../services/wallet-service.js';
import type { SubscriptionApproval } from '../types/api.js';
import { formatOutput, printTable, truncate, printSuccess } from '../utils/output.js';
import { getPassphrase } from '../utils/prompt.js';
import { AppError, EXIT_CODES } from '../utils/errors.js';
import { findAssociatedTokenPda } from '@solana-program/token';
import { address } from '@solana/kit';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
// Default network for approve message. Override via MAINLAYER_SOLANA_NETWORK env var.
// Per RESEARCH.md Open Question #1: hardcode solana:mainnet, expose env var for devnet.
const DEFAULT_SOLANA_NETWORK = 'solana:mainnet';

function approveSubcommand(): Command {
  return new Command('approve')
    .description('Approve auto-renewal for a subscription resource')
    .option('--json', 'Output as JSON')
    .requiredOption('--resource-id <id>', 'Resource ID to subscribe to')
    .option('--max-renewals <n>', 'Max renewal cycles (1-12, default: 1)', '1')
    .option('--plan <name>', 'Select pricing plan')
    .option('--chain <chain>', 'Blockchain (solana, base, polygon)', 'solana')
    .option('--trial-days <n>', 'Trial period in days (0-365)')
    .action(async (opts) => {
      const json = opts.json ?? !process.stdout.isTTY;
      const maxRenewals = Math.min(Math.max(parseInt(opts.maxRenewals, 10) || 1, 1), 12);

      // 1. Resolve passphrase
      const passphrase = await getPassphrase();

      // 2. Get wallet address
      const walletAddr = await walletService.getAddress();

      // 3. Derive delegate_token_account (buyer's USDC ATA)
      // Per RESEARCH.md Pattern 4
      const [ata] = await findAssociatedTokenPda({
        owner: address(walletAddr),
        mint: address(USDC_MINT),
        tokenProgram: address(TOKEN_PROGRAM),
      });
      const delegateTokenAccount = ata.toString();

      // 4. Build signature message
      // Format: approve:{resource_id}:{max_renewals}:{delegate_token_account}:{signed_at}:{network}
      // Per RESEARCH.md Pattern 5
      const signedAt = new Date().toISOString(); // produces Z suffix, accepted by Python 3.11+
      const network = process.env['MAINLAYER_SOLANA_NETWORK'] ?? DEFAULT_SOLANA_NETWORK;
      const message = `approve:${opts.resourceId}:${maxRenewals}:${delegateTokenAccount}:${signedAt}:${network}`;

      // 5. Sign the message
      const spinner = ora({ text: 'Signing approval...', stream: process.stderr }).start();
      const signedApproval = await walletService.signMessage(passphrase, message);
      spinner.stop();

      // 6. POST /subscriptions/approve
      const submitSpinner = ora({ text: 'Submitting approval...', stream: process.stderr }).start();
      const body: Record<string, unknown> = {
        resource_id: opts.resourceId,
        payer_wallet: walletAddr,
        max_renewals: maxRenewals,
        chain: opts.chain,
        signed_approval: signedApproval,
        delegate_token_account: delegateTokenAccount,
        signed_at: signedAt,
      };
      if (opts.plan) body['plan'] = opts.plan;
      if (opts.trialDays !== undefined) body['trial_days'] = parseInt(opts.trialDays, 10);

      let result: SubscriptionApproval;
      try {
        result = await apiClient.post<SubscriptionApproval>('subscriptions/approve', body);
      } finally {
        submitSpinner.stop();
      }

      formatOutput(
        {
          approval_id: result.approval_id,
          status: result.status,
          max_renewals: result.max_renewals,
          renewals_used: result.renewals_used,
        },
        { json },
      );
    });
}

function pauseSubcommand(): Command {
  return new Command('pause')
    .description('Pause a subscription')
    .option('--json', 'Output as JSON')
    .requiredOption('--approval-id <id>', 'Subscription approval ID')
    .action(async (opts) => {
      const json = opts.json ?? !process.stdout.isTTY;
      const passphrase = await getPassphrase();
      const walletAddr = await walletService.getAddress();
      const message = `pause:${opts.approvalId}`;
      const signedMessage = await walletService.signMessage(passphrase, message);

      const spinner = ora({ text: 'Pausing subscription...', stream: process.stderr }).start();
      let result: { status: string };
      try {
        result = await apiClient.post<{ status: string }>(
          `subscriptions/${opts.approvalId}/pause`,
          {
            payer_wallet: walletAddr,
            signed_message: signedMessage,
          },
        );
      } finally {
        spinner.stop();
      }

      formatOutput({ approval_id: opts.approvalId, status: result.status }, { json });
    });
}

function resumeSubcommand(): Command {
  return new Command('resume')
    .description('Resume a paused subscription')
    .option('--json', 'Output as JSON')
    .requiredOption('--approval-id <id>', 'Subscription approval ID')
    .action(async (opts) => {
      const json = opts.json ?? !process.stdout.isTTY;
      const passphrase = await getPassphrase();
      const walletAddr = await walletService.getAddress();
      const message = `resume:${opts.approvalId}`;
      const signedMessage = await walletService.signMessage(passphrase, message);

      const spinner = ora({ text: 'Resuming subscription...', stream: process.stderr }).start();
      let result: { status: string };
      try {
        result = await apiClient.post<{ status: string }>(
          `subscriptions/${opts.approvalId}/resume`,
          {
            payer_wallet: walletAddr,
            signed_message: signedMessage,
          },
        );
      } finally {
        spinner.stop();
      }

      formatOutput({ approval_id: opts.approvalId, status: result.status }, { json });
    });
}

function cancelSubcommand(): Command {
  return new Command('cancel')
    .description('Cancel a subscription')
    .option('--json', 'Output as JSON')
    .requiredOption('--resource-id <id>', 'Resource ID to cancel subscription for')
    .action(async (opts) => {
      const json = opts.json ?? !process.stdout.isTTY;
      const passphrase = await getPassphrase();
      const walletAddr = await walletService.getAddress();
      const message = `cancel:${opts.resourceId}`;
      const signedMessage = await walletService.signMessage(passphrase, message);

      const spinner = ora({ text: 'Cancelling subscription...', stream: process.stderr }).start();
      let result: { status: string };
      try {
        result = await apiClient.post<{ status: string }>('subscriptions/cancel', {
          resource_id: opts.resourceId,
          payer_wallet: walletAddr,
          signed_message: signedMessage,
        });
      } finally {
        spinner.stop();
      }

      formatOutput({ resource_id: opts.resourceId, status: result.status }, { json });
    });
}

function listSubcommand(): Command {
  return new Command('list')
    .description('List your subscriptions (active only)')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const json = opts.json ?? !process.stdout.isTTY;
      const walletAddr = await walletService.getAddress();

      const spinner = ora({ text: 'Fetching subscriptions...', stream: process.stderr }).start();
      let items: SubscriptionApproval[];
      try {
        items = await apiClient.get<SubscriptionApproval[]>('subscriptions/my', {
          payer_wallet: walletAddr,
        });
      } finally {
        spinner.stop();
      }

      if (json) {
        console.log(JSON.stringify(items));
        return;
      }

      if (items.length === 0) {
        printSuccess('No active subscriptions found.');
        return;
      }

      printTable(
        ['APPROVAL ID', 'RESOURCE', 'PLAN', 'RENEWALS', 'STATUS'],
        items.map((s) => [
          truncate(s.approval_id, 12),
          truncate(s.resource_id, 12),
          s.plan_name ?? '-',
          `${s.renewals_used}/${s.max_renewals}`,
          s.status,
        ]),
      );
    });
}

function getSubcommand(): Command {
  return new Command('get')
    .description('Get details of a single subscription')
    .argument('<approval-id>', 'Subscription approval ID')
    .option('--json', 'Output as JSON')
    .action(async (approvalId: string, opts) => {
      const json = opts.json ?? !process.stdout.isTTY;
      const walletAddr = await walletService.getAddress();

      const spinner = ora({ text: 'Fetching subscription...', stream: process.stderr }).start();
      let items: SubscriptionApproval[];
      try {
        items = await apiClient.get<SubscriptionApproval[]>('subscriptions/my', {
          payer_wallet: walletAddr,
        });
      } finally {
        spinner.stop();
      }

      const sub = items.find((s) => s.approval_id === approvalId);
      if (!sub) {
        throw new AppError(`Subscription ${approvalId} not found`, EXIT_CODES.NOT_FOUND);
      }

      formatOutput(sub, { json });
    });
}

export function subscribeCommand(): Command {
  return new Command('subscribe')
    .description('Manage subscriptions')
    .addCommand(approveSubcommand())
    .addCommand(pauseSubcommand())
    .addCommand(resumeSubcommand())
    .addCommand(cancelSubcommand())
    .addCommand(listSubcommand())
    .addCommand(getSubcommand());
}
