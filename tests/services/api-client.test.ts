import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EXIT_CODES } from '../../src/utils/errors.js';

// Mock ky module
vi.mock('ky', () => {
  const mockJsonFn = vi.fn();
  const mockRequest = {
    headers: {
      set: vi.fn(),
    },
  };

  const mockKyInstance = {
    post: vi.fn(() => ({ json: mockJsonFn })),
    get: vi.fn(() => ({ json: mockJsonFn })),
    delete: vi.fn(() => ({ json: mockJsonFn })),
  };

  const mockKy = {
    extend: vi.fn(() => mockKyInstance),
    default: undefined as unknown,
  };
  mockKy.default = mockKy;

  return {
    default: mockKy,
    HTTPError: class HTTPError extends Error {
      response: { status: number; json: () => Promise<unknown> };
      constructor(status: number, body: unknown) {
        super(`HTTP ${status}`);
        this.response = {
          status,
          json: () => Promise.resolve(body),
        };
      }
    },
    __mockKyInstance: mockKyInstance,
    __mockJsonFn: mockJsonFn,
    __mockRequest: mockRequest,
  };
});

// Mock config-service
vi.mock('../../src/services/config-service.js', () => ({
  configService: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => ({})),
    getApiUrl: vi.fn(() => 'https://api.mainlayer.io'),
    clear: vi.fn(),
  },
}));

describe('ApiClient', () => {
  let ApiClient: typeof import('../../src/services/api-client.js').ApiClient;
  let apiClientInstance: InstanceType<typeof ApiClient>;
  let mockKy: typeof import('ky');
  let configServiceMock: typeof import('../../src/services/config-service.js').configService;

  beforeEach(async () => {
    vi.resetModules();
    const kyModule = await import('ky');
    const configModule = await import('../../src/services/config-service.js');
    const apiModule = await import('../../src/services/api-client.js');

    mockKy = kyModule.default as unknown as typeof import('ky');
    configServiceMock = configModule.configService;
    ApiClient = apiModule.ApiClient;
    apiClientInstance = new ApiClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env['MAINLAYER_API_KEY'];
  });

  describe('auth header injection', () => {
    it('should use apiKeyOverride as Bearer token when set', async () => {
      // Capture the beforeRequest hook
      let capturedHook: ((req: { headers: { set: (k: string, v: string) => void } }) => void) | undefined;
      const extendMock = vi.fn((opts: { hooks: { beforeRequest: ((req: unknown) => void)[] } }) => {
        capturedHook = opts.hooks.beforeRequest[0] as (req: { headers: { set: (k: string, v: string) => void } }) => void;
        return {
          post: vi.fn(() => ({ json: vi.fn().mockResolvedValue({ token: 'jwt', userId: '1', email: 'e@e.com', expiresAt: '' }) })),
          get: vi.fn(() => ({ json: vi.fn().mockResolvedValue([]) })),
          delete: vi.fn(() => ({ json: vi.fn().mockResolvedValue({}) })),
        };
      });
      vi.mocked(mockKy.extend).mockImplementation(extendMock as unknown as typeof mockKy.extend);

      apiClientInstance.setApiKeyOverride('my-api-key');
      await apiClientInstance.get('some/path');

      const fakeRequest = { headers: { set: vi.fn() } };
      capturedHook!(fakeRequest);
      expect(fakeRequest.headers.set).toHaveBeenCalledWith('Authorization', 'Bearer my-api-key');
    });

    it('should use MAINLAYER_API_KEY env var when no override is set', async () => {
      process.env['MAINLAYER_API_KEY'] = 'env-api-key';
      vi.mocked(configServiceMock.get).mockReturnValue(undefined);

      let capturedHook: ((req: { headers: { set: (k: string, v: string) => void } }) => void) | undefined;
      vi.mocked(mockKy.extend).mockImplementation(vi.fn((opts: { hooks: { beforeRequest: ((req: unknown) => void)[] } }) => {
        capturedHook = opts.hooks.beforeRequest[0] as (req: { headers: { set: (k: string, v: string) => void } }) => void;
        return {
          post: vi.fn(() => ({ json: vi.fn().mockResolvedValue({}) })),
          get: vi.fn(() => ({ json: vi.fn().mockResolvedValue([]) })),
          delete: vi.fn(() => ({ json: vi.fn().mockResolvedValue({}) })),
        };
      }) as unknown as typeof mockKy.extend);

      await apiClientInstance.get('some/path');

      const fakeRequest = { headers: { set: vi.fn() } };
      capturedHook!(fakeRequest);
      expect(fakeRequest.headers.set).toHaveBeenCalledWith('Authorization', 'Bearer env-api-key');
    });

    it('should use JWT from config when no override or env var is set', async () => {
      vi.mocked(configServiceMock.get).mockReturnValue('config-jwt-token');

      let capturedHook: ((req: { headers: { set: (k: string, v: string) => void } }) => void) | undefined;
      vi.mocked(mockKy.extend).mockImplementation(vi.fn((opts: { hooks: { beforeRequest: ((req: unknown) => void)[] } }) => {
        capturedHook = opts.hooks.beforeRequest[0] as (req: { headers: { set: (k: string, v: string) => void } }) => void;
        return {
          get: vi.fn(() => ({ json: vi.fn().mockResolvedValue([]) })),
          post: vi.fn(() => ({ json: vi.fn().mockResolvedValue({}) })),
          delete: vi.fn(() => ({ json: vi.fn().mockResolvedValue({}) })),
        };
      }) as unknown as typeof mockKy.extend);

      await apiClientInstance.get('some/path');

      const fakeRequest = { headers: { set: vi.fn() } };
      capturedHook!(fakeRequest);
      expect(fakeRequest.headers.set).toHaveBeenCalledWith('Authorization', 'Bearer config-jwt-token');
    });

    it('should prioritize apiKeyOverride over env var and config JWT', async () => {
      process.env['MAINLAYER_API_KEY'] = 'env-api-key';
      vi.mocked(configServiceMock.get).mockReturnValue('config-jwt-token');

      let capturedHook: ((req: { headers: { set: (k: string, v: string) => void } }) => void) | undefined;
      vi.mocked(mockKy.extend).mockImplementation(vi.fn((opts: { hooks: { beforeRequest: ((req: unknown) => void)[] } }) => {
        capturedHook = opts.hooks.beforeRequest[0] as (req: { headers: { set: (k: string, v: string) => void } }) => void;
        return {
          get: vi.fn(() => ({ json: vi.fn().mockResolvedValue([]) })),
          post: vi.fn(() => ({ json: vi.fn().mockResolvedValue({}) })),
          delete: vi.fn(() => ({ json: vi.fn().mockResolvedValue({}) })),
        };
      }) as unknown as typeof mockKy.extend);

      apiClientInstance.setApiKeyOverride('override-key');
      await apiClientInstance.get('some/path');

      const fakeRequest = { headers: { set: vi.fn() } };
      capturedHook!(fakeRequest);
      expect(fakeRequest.headers.set).toHaveBeenCalledWith('Authorization', 'Bearer override-key');
    });
  });

  describe('HTTP error mapping', () => {
    it('should throw AppError with AUTH_ERROR on HTTP 401', async () => {
      const kyMod = await import('ky');
      const { HTTPError: KyHTTPError } = kyMod;
      // Create a real-ish error with the right shape
      const httpError = Object.assign(new Error('HTTP 401'), {
        response: { status: 401, json: () => Promise.resolve({ error: 'Unauthorized' }) },
      });
      // Make it pass instanceof check by making it an instance of the mocked HTTPError
      Object.setPrototypeOf(httpError, KyHTTPError.prototype);

      vi.mocked(mockKy.extend).mockReturnValue({
        get: vi.fn(() => ({ json: vi.fn().mockRejectedValue(httpError) })),
        post: vi.fn(() => ({ json: vi.fn().mockRejectedValue(httpError) })),
        delete: vi.fn(() => ({ json: vi.fn().mockRejectedValue(httpError) })),
      } as unknown as ReturnType<typeof mockKy.extend>);

      await expect(apiClientInstance.get('protected/path')).rejects.toMatchObject({
        name: 'AppError',
        exitCode: EXIT_CODES.AUTH_ERROR,
      });
    });

    it('should throw AppError with NOT_FOUND on HTTP 404', async () => {
      const kyMod = await import('ky');
      const { HTTPError: KyHTTPError } = kyMod;
      const httpError = Object.assign(new Error('HTTP 404'), {
        response: { status: 404, json: () => Promise.resolve({ error: 'Not found' }) },
      });
      Object.setPrototypeOf(httpError, KyHTTPError.prototype);

      vi.mocked(mockKy.extend).mockReturnValue({
        get: vi.fn(() => ({ json: vi.fn().mockRejectedValue(httpError) })),
        post: vi.fn(() => ({ json: vi.fn().mockRejectedValue(httpError) })),
        delete: vi.fn(() => ({ json: vi.fn().mockRejectedValue(httpError) })),
      } as unknown as ReturnType<typeof mockKy.extend>);

      await expect(apiClientInstance.get('missing/resource')).rejects.toMatchObject({
        name: 'AppError',
        exitCode: EXIT_CODES.NOT_FOUND,
      });
    });

    it('should throw AppError with ALREADY_EXISTS on HTTP 409', async () => {
      const kyMod = await import('ky');
      const { HTTPError: KyHTTPError } = kyMod;
      const httpError = Object.assign(new Error('HTTP 409'), {
        response: { status: 409, json: () => Promise.resolve({ error: 'Conflict' }) },
      });
      Object.setPrototypeOf(httpError, KyHTTPError.prototype);

      vi.mocked(mockKy.extend).mockReturnValue({
        post: vi.fn(() => ({ json: vi.fn().mockRejectedValue(httpError) })),
        get: vi.fn(() => ({ json: vi.fn().mockRejectedValue(httpError) })),
        delete: vi.fn(() => ({ json: vi.fn().mockRejectedValue(httpError) })),
      } as unknown as ReturnType<typeof mockKy.extend>);

      await expect(apiClientInstance.post('auth/register', { email: 'a@b.com' })).rejects.toMatchObject({
        name: 'AppError',
        exitCode: EXIT_CODES.ALREADY_EXISTS,
      });
    });
  });
});
