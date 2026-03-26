import { describe, it, expect } from 'vitest';
import { EXIT_CODES, AppError, type AppErrorMeta } from '../../src/utils/errors.js';

describe('EXIT_CODES', () => {
  it('SUCCESS is 0', () => {
    expect(EXIT_CODES.SUCCESS).toBe(0);
  });

  it('GENERAL is 1', () => {
    expect(EXIT_CODES.GENERAL).toBe(1);
  });

  it('AUTH_ERROR is 2', () => {
    expect(EXIT_CODES.AUTH_ERROR).toBe(2);
  });

  it('NOT_FOUND is 3', () => {
    expect(EXIT_CODES.NOT_FOUND).toBe(3);
  });

  it('VALIDATION_ERROR is 4', () => {
    expect(EXIT_CODES.VALIDATION_ERROR).toBe(4);
  });

  it('ALREADY_EXISTS is 5', () => {
    expect(EXIT_CODES.ALREADY_EXISTS).toBe(5);
  });
});

describe('AppError', () => {
  it('stores message', () => {
    const err = new AppError('something went wrong');
    expect(err.message).toBe('something went wrong');
  });

  it('stores exitCode', () => {
    const err = new AppError('auth failed', EXIT_CODES.AUTH_ERROR);
    expect(err.exitCode).toBe(2);
  });

  it('defaults exitCode to GENERAL (1)', () => {
    const err = new AppError('oops');
    expect(err.exitCode).toBe(EXIT_CODES.GENERAL);
  });

  it('is an instance of Error', () => {
    const err = new AppError('test');
    expect(err).toBeInstanceOf(Error);
  });

  it('has name AppError', () => {
    const err = new AppError('test');
    expect(err.name).toBe('AppError');
  });

  it('stores meta field with type, hint, and code', () => {
    const meta: AppErrorMeta = { type: 'auth_error', hint: 'Run: mainlayer auth login', code: 'AUTH_001' };
    const err = new AppError('unauthorized', EXIT_CODES.AUTH_ERROR, meta);
    expect(err.meta).toEqual(meta);
    expect(err.meta?.type).toBe('auth_error');
    expect(err.meta?.hint).toBe('Run: mainlayer auth login');
    expect(err.meta?.code).toBe('AUTH_001');
  });

  it('meta is undefined when not provided (backward compatible)', () => {
    const err = new AppError('no meta');
    expect(err.meta).toBeUndefined();
  });

  it('meta is optional in constructor', () => {
    const err = new AppError('with exit code only', EXIT_CODES.NOT_FOUND);
    expect(err.exitCode).toBe(EXIT_CODES.NOT_FOUND);
    expect(err.meta).toBeUndefined();
  });
});
