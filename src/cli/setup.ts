import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { configurePlatforms, PLATFORMS } from '../postinstall/platforms.js';
import { generateSkillsMd, SKILLS_FILENAME } from '../postinstall/skills-template.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { formatOutput, printSuccess, printError } from '../utils/output.js';

export function setupCommand(): Command {
  return new Command('setup')
    .description('Detect AI platforms and configure Mainlayer MCP server')
    .option('--force', 'Re-write MCP entries even if already configured')
    .option('--json', 'Output machine-readable JSON')
    .action(async (opts) => {
      const json = (opts.json as boolean | undefined) ?? !process.stdout.isTTY;

      let spinner: ReturnType<typeof ora> | undefined;
      if (!json) {
        spinner = ora({ text: 'Detecting AI platforms...', stream: process.stderr }).start();
      }

      let results;
      try {
        results = await configurePlatforms({ force: (opts.force as boolean | undefined) ?? false });
      } catch (err) {
        if (spinner) spinner.fail('Platform detection failed');
        printError(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
        return;
      }

      // Drop skills.md for each configured platform using the dedicated template
      for (const result of results) {
        if (!result.configured) continue;
        const desc = PLATFORMS.find((p) => p.name === result.name);
        if (!desc) continue;
        try {
          const dir = desc.skillsDir(homedir());
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, SKILLS_FILENAME), generateSkillsMd(), 'utf8');
          result.skillsDropped = true;
        } catch {
          // Skills drop failure is non-fatal
        }
      }

      if (!json) {
        if (spinner) spinner.stop();

        for (const r of results) {
          if (r.configured) {
            process.stderr.write(chalk.green(`  \u2714 ${r.name}\n`));
          } else if (r.skipped) {
            process.stderr.write(chalk.yellow(`  \u2139 ${r.name}: ${r.error ?? 'skipped'}\n`));
          } else if (r.error) {
            process.stderr.write(chalk.red(`  \u2718 ${r.name}: ${r.error}\n`));
          } else {
            process.stderr.write(chalk.gray(`  \u2013 ${r.name} (not detected)\n`));
          }
        }

        const configuredNames = results.filter((r) => r.configured).map((r) => r.name);
        if (configuredNames.length > 0) {
          printSuccess(`Configured MCP for: ${configuredNames.join(', ')}`);
        } else {
          process.stderr.write('No AI platforms detected\n');
        }
      } else {
        formatOutput(
          {
            platforms: results.map((r) => ({
              name: r.name,
              configured: r.configured,
              skills_dropped: r.skillsDropped,
              skipped: r.skipped,
              error: r.error ?? null,
            })),
          },
          { json: true },
        );
      }
    });
}
