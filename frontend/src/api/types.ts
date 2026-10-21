export type Role = 'tenant_admin' | 'agent_user' | 'platform_admin';

export interface Persona {
  userId: number;
  tenantId: number | null;
  email: string;
  displayName: string;
  role: Role;
  avatarColor: string;
  tenantName: string;
  industry: string;
  plan: string;
}

export interface SqlRunResult {
  sql: string;
  identity: 'app' | 'agent' | 'admin';
  guard: { allowed: boolean; reason?: string };
  ok: boolean;
  blockedBy: 'guard' | 'database' | null;
  rowCount: number;
  rows: Record<string, unknown>[];
  truncated: boolean;
  tenantsInResult: number[];
  ms: number;
  error?: { number?: number; message: string };
  params?: Record<string, unknown>;
}

export type Toolset = 'sql' | 'curated';

export interface AgentStep {
  kind: 'tool' | 'thought';
  tool?: string;
  args?: Record<string, unknown> & { query?: string; injected?: boolean };
  result?: SqlRunResult;
  text?: string;
}

export interface AgentReply {
  mode: 'llm' | 'scripted';
  toolset: Toolset;
  model: string;
  answer: string;
  steps: AgentStep[];
  rlsEnabled: boolean;
  durationMs: number;
}

export interface AttackScenario {
  id: string;
  title: string;
  category: string;
  owasp: string;
  attackerInput: string;
  description: string;
  steps: { title: string; identity: 'app' | 'agent' | 'admin'; sql: string; note?: string }[];
  defendedBy: string[];
}

export interface ModeOutcome {
  rlsEnabled: boolean;
  steps: (SqlRunResult & { title: string; note?: string })[];
  leakedRows: number;
  leakedTenants: number[];
  verdict: 'defended' | 'breached';
}

export interface AttackRun {
  scenario: AttackScenario;
  results: Partial<Record<'on' | 'off', ModeOutcome>>;
}
