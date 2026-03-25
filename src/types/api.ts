export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  expiresAt: string;
}

export interface ApiKeyResponse {
  id: string;
  label: string;
  key?: string; // only present on create response
  createdAt: string;
}

export interface ApiErrorResponse {
  error: string;
  message?: string;
  statusCode?: number;
}
