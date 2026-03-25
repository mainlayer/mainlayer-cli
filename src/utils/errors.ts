export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL: 1,
  AUTH_ERROR: 2,
  NOT_FOUND: 3,
  VALIDATION_ERROR: 4,
  ALREADY_EXISTS: 5,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export class AppError extends Error {
  constructor(
    message: string,
    public readonly exitCode: ExitCode = EXIT_CODES.GENERAL,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
