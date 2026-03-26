import ky, { HTTPError } from 'ky';
import { configService } from './config-service.js';
import { AppError, EXIT_CODES } from '../utils/errors.js';
import type { ApiErrorResponse } from '../types/api.js';

export class ApiClient {
  private apiKeyOverride?: string;

  setApiKeyOverride(key: string): void {
    this.apiKeyOverride = key;
  }

  private createHttp() {
    return ky.extend({
      prefixUrl: configService.getApiUrl(),
      hooks: {
        beforeRequest: [
          (request) => {
            // Priority: explicit override (--api-key flag) > env var > config JWT (per INFRA-06)
            const apiKey = this.apiKeyOverride ?? process.env['MAINLAYER_API_KEY'];
            const jwt = configService.get('jwt');
            if (apiKey) {
              request.headers.set('Authorization', `Bearer ${apiKey}`);
            } else if (jwt) {
              request.headers.set('Authorization', `Bearer ${jwt}`);
            }
          },
        ],
      },
    });
  }

  private async handleError(err: unknown): Promise<never> {
    if (err instanceof HTTPError) {
      const body = await err.response
        .json()
        .catch(() => ({ error: 'Unknown error' })) as ApiErrorResponse;
      const detail = body.detail;
      let msg: string;
      if (body.message) {
        msg = body.message;
      } else if (body.error) {
        msg = body.error;
      } else if (Array.isArray(detail)) {
        msg = detail.map((d: { msg: string }) => d.msg).join('; ');
      } else {
        msg = `HTTP ${err.response.status}`;
      }
      const status = err.response.status;
      if (status === 401) throw new AppError(msg, EXIT_CODES.AUTH_ERROR, { type: 'auth_error', hint: 'Run: mainlayer auth login' });
      if (status === 404) throw new AppError(msg, EXIT_CODES.NOT_FOUND, { type: 'not_found' });
      if (status === 409) throw new AppError(msg, EXIT_CODES.ALREADY_EXISTS, { type: 'already_exists' });
      if (status === 422) throw new AppError(msg, EXIT_CODES.VALIDATION_ERROR, { type: 'validation_error' });
      throw new AppError(msg, EXIT_CODES.GENERAL, { type: 'api_error' });
    }
    throw err;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    try {
      return await this.createHttp().post(path, { json: body }).json<T>();
    } catch (err) {
      return this.handleError(err);
    }
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    try {
      return await this.createHttp().put(path, { json: body }).json<T>();
    } catch (err) {
      return this.handleError(err);
    }
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    try {
      return await this.createHttp().patch(path, { json: body }).json<T>();
    } catch (err) {
      return this.handleError(err);
    }
  }

  async get<T>(path: string, searchParams?: Record<string, string>): Promise<T> {
    try {
      return await this.createHttp().get(path, searchParams ? { searchParams } : undefined).json<T>();
    } catch (err) {
      return this.handleError(err);
    }
  }

  async delete<T>(path: string): Promise<T> {
    try {
      return await this.createHttp().delete(path).json<T>();
    } catch (err) {
      return this.handleError(err);
    }
  }
}

export const apiClient = new ApiClient();
