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

// --- Buyer types (Phase 3) ---

export interface DiscoverResult {
  id: string;
  slug: string;
  description: string;
  price_usdc: number;
  fee_model: string;
  type: string;
  credits_per_payment: number | null;
  duration_seconds: number | null;
  plans: Array<{
    name: string;
    price_usdc: number;
    fee_model: string;
    duration_seconds: number | null;
  }>;
}

export interface PrepareResponse {
  unsigned_transaction: string;
  amount_usdc: number;
  original_price_usdc: number;
  discount_usdc: number;
  fee_usdc: number;
  net_vendor_usdc: number;
  expires_in_seconds: number | null;
}

export interface PayResponse {
  tx_hash: string;
  entitlement_id: string;
  resource_id: string;
  amount_usdc: number;
  status: string;
}

export interface Entitlement {
  resource_id: string;
  resource_slug: string;
  status: string;
  expires_at: string | null;
  remaining_credits: number | null;
}

export interface SubscriptionApproval {
  approval_id: string;
  resource_id: string;
  plan_name: string | null;
  max_renewals: number;
  renewals_used: number;
  chain: string;
  status: string;
  created_at: string;
}

export interface InvoiceResponse {
  id: string;
  resource_id: string;
  resource_slug?: string;
  amount_usdc: number;
  status: string;
  created_at: string;
}

export interface RefundResponse {
  id: string;
  payment_id: string;
  amount_usdc: number;
  reason?: string;
  status: string;
  created_at: string;
}

export interface DisputeResponse {
  dispute_id: string;
  payment_id: string;
  reason: string;
  status: string;
  payer_wallet?: string;
  created_at?: string;
}
