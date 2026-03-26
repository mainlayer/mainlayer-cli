export interface MainlayerConfig {
  apiUrl?: string;
  jwt?: string;
  jwtExpiresAt?: string;
  userId?: string;
  email?: string;
  lastUpdateCheck?: string;
  activeProfile?: string;
}

// Known config keys for config get/set (per D-11)
export const KNOWN_CONFIG_KEYS = ['apiUrl', 'jwt', 'jwtExpiresAt', 'userId', 'email', 'lastUpdateCheck', 'activeProfile'] as const;
export type ConfigKey = (typeof KNOWN_CONFIG_KEYS)[number];
