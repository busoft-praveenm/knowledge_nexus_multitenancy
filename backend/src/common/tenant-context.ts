/**
 * Who is making this request. Derived ONLY from the verified JWT —
 * never from the request body, the prompt, or anything the LLM says.
 */
export interface TenantContext {
  userId: number;
  tenantId: number | null; // null for platform staff
  role: 'tenant_admin' | 'agent_user' | 'platform_admin';
  email: string;
  displayName: string;
  tenantName: string | null;
}
