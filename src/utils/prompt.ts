import * as clack from '@clack/prompts';
import { EXIT_CODES } from './errors.js';
import { printError } from './output.js';

export async function getCredentials(opts: {
  email?: string;
  password?: string;
}): Promise<{ email: string; password: string }> {
  // Priority: flags → env vars → interactive TTY (per D-01)
  const email =
    opts.email ?? process.env['MAINLAYER_EMAIL'];
  const password =
    opts.password ?? process.env['MAINLAYER_PASSWORD'];

  if (email && password) {
    return { email, password };
  }

  // Non-TTY without values: error immediately (per D-02, D-03)
  if (!process.stdin.isTTY) {
    printError(
      'Set MAINLAYER_EMAIL / MAINLAYER_PASSWORD or pass --email / --password flags',
    );
    process.exitCode = EXIT_CODES.VALIDATION_ERROR;
    process.exit();
  }

  // Interactive TTY fallback
  clack.intro('Mainlayer');

  const resolvedEmail =
    email ??
    (await clack.text({
      message: 'Email address',
      validate: (v) => (v.includes('@') ? undefined : 'Enter a valid email'),
    }));

  const resolvedPassword =
    password ??
    (await clack.password({
      message: 'Password',
    }));

  if (clack.isCancel(resolvedEmail) || clack.isCancel(resolvedPassword)) {
    clack.cancel('Cancelled.');
    process.exitCode = EXIT_CODES.GENERAL;
    process.exit();
  }

  return {
    email: resolvedEmail as string,
    password: resolvedPassword as string,
  };
}

export async function getPassphrase(opts?: { confirm?: boolean }): Promise<string> {
  // Priority: env var (skip confirmation per D-14) → interactive TTY
  const envPassphrase = process.env['MAINLAYER_WALLET_PASSPHRASE'];

  if (envPassphrase) {
    return envPassphrase;
  }

  // Non-TTY without env var: error (per Pitfall 4)
  if (!process.stdin.isTTY) {
    printError(
      'Set MAINLAYER_WALLET_PASSPHRASE env var or run in an interactive terminal',
    );
    process.exitCode = EXIT_CODES.AUTH_ERROR;
    process.exit();
  }

  // Interactive TTY: use @clack/prompts password() (per D-16, never echo to stdout)
  const passphrase = await clack.password({
    message: 'Enter wallet passphrase',
  });

  if (clack.isCancel(passphrase)) {
    clack.cancel('Cancelled.');
    process.exitCode = EXIT_CODES.GENERAL;
    process.exit();
  }

  if (opts?.confirm) {
    const confirmation = await clack.password({
      message: 'Confirm wallet passphrase',
    });

    if (clack.isCancel(confirmation)) {
      clack.cancel('Cancelled.');
      process.exitCode = EXIT_CODES.GENERAL;
      process.exit();
    }

    if (passphrase !== confirmation) {
      printError('Passphrases do not match');
      process.exitCode = EXIT_CODES.VALIDATION_ERROR;
      process.exit();
    }
  }

  return passphrase as string;
}
