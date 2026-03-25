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

export function printTable(headers: string[], rows: string[][]): void {
  if (rows.length === 0) return;
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length))
  );
  const fmt = (cols: string[]) =>
    cols.map((c, i) => c.padEnd(widths[i]!)).join('  ');
  console.log(chalk.bold(fmt(headers)));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) {
    console.log(fmt(row));
  }
}

export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
}
