import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatOutput, printError, printSuccess } from '../../src/utils/output.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('formatOutput', () => {
  it('writes JSON string to stdout when json:true', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    formatOutput({ foo: 'bar' }, { json: true });
    expect(spy).toHaveBeenCalledWith('{"foo":"bar"}');
  });

  it('writes JSON string to stdout when not a TTY', () => {
    const originalIsTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    formatOutput({ key: 'value' }, { json: false });
    expect(spy).toHaveBeenCalledWith('{"key":"value"}');
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
  });

  it('writes key-value pairs when json:false and isTTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    formatOutput({ email: 'a@b.com' }, { json: false });
    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0][0] as string;
    // Should include the key and value
    expect(call).toContain('email');
    expect(call).toContain('a@b.com');
  });
});

describe('printError', () => {
  it('writes to stderr', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    printError('something went wrong');
    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0][0] as string;
    expect(call).toContain('something went wrong');
  });
});

describe('printSuccess', () => {
  it('writes to stderr (keeps stdout clean for JSON)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    printSuccess('done');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
