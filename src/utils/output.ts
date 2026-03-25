import chalk from 'chalk';

export function formatOutput<T extends object>(data: T, opts: { json: boolean }): void {
  if (opts.json || !process.stdout.isTTY) {
    console.log(JSON.stringify(data));
  } else {
    for (const [key, value] of Object.entries(data)) {
      console.log(`${chalk.cyan(key + ':')}  ${value}`);
    }
  }
}

export function printError(message: string): void {
  console.error(chalk.red(message));
}

export function printSuccess(message: string): void {
  // Write to stderr so JSON stdout is clean (per D-08)
  console.error(chalk.green(message));
}
