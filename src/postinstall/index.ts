import { configurePlatforms, PLATFORMS } from './platforms.js';
import { generateSkillsMd, SKILLS_FILENAME } from './skills-template.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

async function main(): Promise<void> {
  try {
    const results = await configurePlatforms({ force: false });

    const configured = results.filter((r) => r.configured).map((r) => r.name);
    const skipped = results.filter((r) => r.skipped);

    // Print skip messages for platforms that need manual setup
    for (const s of skipped) {
      if (s.error) {
        process.stderr.write(`${s.name}: ${s.error}\n`);
      }
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
      } catch {
        // D-12: skills drop failure is non-fatal
      }
    }

    // D-12: summary to stderr
    const summary =
      configured.length > 0
        ? `Configured MCP for: ${configured.join(', ')}`
        : 'No AI platforms detected';
    process.stderr.write(summary + '\n');
  } catch {
    // D-12: outer catch — never throw from postinstall
    process.stderr.write('No AI platforms detected\n');
  }
  // D-12: always exit 0 — let main() return naturally, no process.exit()
}

main();
