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
  detail?: Array<{ loc: (string | number)[]; msg: string; type: string }>;
}

export interface ResourceResponse {
  id: string;
  slug: string;
  type: 'api' | 'file' | 'endpoint' | 'page';
  price_usdc: number;
  fee_model: 'one_time' | 'subscription' | 'pay_per_call' | 'hybrid';
  vendor_wallet: string;
  description?: string | null;
  discoverable: boolean;
  credits_per_payment?: number | null;
  duration_seconds?: number | null;
  quota_calls?: number | null;
  overage_price_usdc?: number | null;
  callback_url?: string | null;
  active: boolean;
  created_at: string;
  next_step?: Record<string, unknown> | null;
}

export interface ResourceCreate {
  slug: string;
  type: 'api' | 'file' | 'endpoint' | 'page';
  price_usdc: number;
  fee_model: 'one_time' | 'subscription' | 'pay_per_call' | 'hybrid';
  vendor_wallet: string;
  description?: string;
  discoverable?: boolean;
  credits_per_payment?: number;
  duration_seconds?: number;
  quota_calls?: number;
  overage_price_usdc?: number;
  callback_url?: string;
  metadata?: Record<string, unknown>;
}

export interface PlanCreate {
  name: string;
  price_usdc: number;
  fee_model: 'pay_per_call' | 'subscription' | 'one_time';
  credits_per_payment?: number;
  duration_seconds?: number;
  max_calls_per_day?: number;
}

export interface PlanResponse {
  id: string;
  name: string;
  price_usdc: number;
  fee_model: string;
  credits_per_payment?: number | null;
  duration_seconds?: number | null;
  max_calls_per_day?: number | null;
}

export interface CouponCreate {
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  max_uses?: number;
  expires_at?: string;
}

export interface CouponResponse {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  max_uses?: number | null;
  uses_count: number;
  expires_at?: string | null;
  active: boolean;
}

export interface QuotaResponse {
  resource_id: string;
  max_purchases_per_wallet?: number | null;
  max_calls_per_day_per_wallet?: number | null;
}

export interface WebhookLog {
  id: string;
  payment_id: string;
  status: string;
  attempts: number;
  http_status?: number | null;
  last_error?: string | null;
  callback_url: string;
}

export interface EarningsResponse {
  resource_id?: string | null;
  from: string;
  to: string;
  total_calls: number;
  total_revenue_usdc: number;
  unique_buyers: number;
  daily: Array<{ date: string; calls: number; revenue_usdc: number }>;
}

export interface MetricsResponse {
  resource_id: string;
  total_calls: number;
  total_revenue_usdc: number;
  unique_buyers: number;
  quota_calls?: number;
  buyers_over_quota?: number;
}
