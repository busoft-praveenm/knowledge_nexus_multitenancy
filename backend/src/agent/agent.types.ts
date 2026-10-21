import { SqlRunResult } from './tools/run-sql.tool';

export type AgentMode = 'llm' | 'scripted';

/**
 * Which tools the agent gets:
 *   sql      — one generic run_sql tool; the model writes the SQL (analytics / "ask your data" style)
 *   curated  — typed service methods with fixed, parameterised SQL; the model only picks a tool and fills arguments
 */
export type Toolset = 'sql' | 'curated';

export interface AgentStep {
  kind: 'tool' | 'thought';
  tool?: string;
  args?: Record<string, unknown>;
  result?: SqlRunResult;
  text?: string;
}

export interface AgentReply {
  mode: AgentMode;
  toolset: Toolset;
  model: string;
  answer: string;
  steps: AgentStep[];
  rlsEnabled: boolean;
  durationMs: number;
}
