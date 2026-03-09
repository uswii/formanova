// pipeline-api.ts — Client for the temporal-agentic-pipeline backend

import { getStoredToken } from './auth-api';

const BASE_URL = import.meta.env.VITE_PIPELINE_API_URL ?? "";
const ADMIN_SECRET = import.meta.env.VITE_PIPELINE_ADMIN_SECRET ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  external_id: string;
  tenant_id: string;
  balance: number;
  reserved_balance: number;
  created_at: string | null;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminTenant {
  id: string;
  name: string;
  tier: string;
  created_at: string | null;
  user_count: number;
  workflow_count: number;
  total_revenue: number;
}

export interface AdminWorkflow {
  id: string;
  tenant_id: string;
  user_id: string;
  workflow_name: string;
  status: string;
  actual_cost: number;
  total_provider_cost: number;
  margin: number;
  projected_cost: number;
  created_at: string | null;
  finished_at: string | null;
}

export interface AdminWorkflowsResponse {
  workflows: AdminWorkflow[];
  total: number;
  page: number;
  page_size: number;
}

export interface TenantFinancials {
  tenant_id: string;
  total_revenue: number;
  total_provider_cost: number;
  net_margin: number;
  workflow_count: number;
  [key: string]: unknown;
}

export interface UserBalance {
  balance: number;
  reserved_balance: number;
  external_id: string;
  [key: string]: unknown;
}

export interface WorkflowAuditItem {
  tool_name: string;
  cost: number;
  is_success: boolean;
  is_retry: boolean;
  is_cached: boolean;
  created_at: string | null;
  [key: string]: unknown;
}

export interface UserWorkflow {
  id: string;
  workflow_name: string;
  status: string;
  actual_cost: number;
  created_at: string | null;
  finished_at: string | null;
  [key: string]: unknown;
}

// ─── Core fetch helper ────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  { useAdminSecret = false, method = "GET", body }: {
    useAdminSecret?: boolean;
    method?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (useAdminSecret) {
    headers["X-Admin-Secret"] = ADMIN_SECRET;
  } else {
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Pipeline API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Admin API (X-Admin-Secret) ───────────────────────────────────────────────

export const adminApi = {
  getUsers(page = 1, pageSize = 50, search?: string): Promise<AdminUsersResponse> {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (search) params.set("search", search);
    return apiFetch<AdminUsersResponse>(`/admin/users?${params}`, { useAdminSecret: true });
  },

  getTenants(): Promise<AdminTenant[]> {
    return apiFetch<AdminTenant[]>("/admin/tenants", { useAdminSecret: true });
  },

  getWorkflows(
    page = 1,
    pageSize = 50,
    filters: { status?: string; tenant_id?: string; workflow_name?: string } = {}
  ): Promise<AdminWorkflowsResponse> {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (filters.status) params.set("status", filters.status);
    if (filters.tenant_id) params.set("tenant_id", filters.tenant_id);
    if (filters.workflow_name) params.set("workflow_name", filters.workflow_name);
    return apiFetch<AdminWorkflowsResponse>(`/admin/workflows?${params}`, { useAdminSecret: true });
  },
};

// ─── Tenant API (X-API-Key) ───────────────────────────────────────────────────

export const tenantApi = {
  getFinancials(): Promise<TenantFinancials> {
    return apiFetch<TenantFinancials>("/analytics/tenant/financials");
  },

  getUserBalance(externalId: string): Promise<UserBalance> {
    return apiFetch<UserBalance>(`/credits/balance/external/${encodeURIComponent(externalId)}`);
  },

  topUpUser(externalId: string, amount: number): Promise<unknown> {
    return apiFetch("/credits/topup", {
      method: "POST",
      body: { external_id: externalId, amount },
    });
  },

  getWorkflowAudit(workflowId: string): Promise<WorkflowAuditItem[]> {
    return apiFetch<WorkflowAuditItem[]>(`/credits/audit/${encodeURIComponent(workflowId)}`);
  },

  getUserWorkflows(externalId: string): Promise<UserWorkflow[]> {
    return apiFetch<UserWorkflow[]>(`/history/workflows/external/${encodeURIComponent(externalId)}`);
  },
};
