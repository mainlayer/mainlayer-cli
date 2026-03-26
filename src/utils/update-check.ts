import latestVersion from 'latest-version';
import { configService } from '../services/config-service.js';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function checkForUpdates(): Promise<void> {
  if (process.env['NO_UPDATE_NOTIFIER']) return;
  if (!process.stdout.isTTY) return;

  try {
    const lastCheck = configService.get('lastUpdateCheck');
    if (lastCheck && Date.now() - parseInt(lastCheck, 10) < CHECK_INTERVAL_MS) return;

    const current = process.env['npm_package_version'] ?? '0.0.0';
    const latest = await latestVersion('@mainlayer/cli');

    configService.set('lastUpdateCheck', String(Date.now()));

    if (latest !== current) {
      process.stderr.write(
        `\nUpdate available: ${current} -> ${latest}\nRun: npm i -g @mainlayer/cli\n\n`,
      );
    }
  } catch {
    // Silent — network may be unavailable
  }
}
