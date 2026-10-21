import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RlsStateService } from '../admin/rls-state.service';
import { AuditService, outcomeOf } from '../audit/audit.service';
import { TenantContext } from '../common/tenant-context';
import { AgentReply, AgentStep, Toolset } from './agent.types';
import { ChatMessage, LlmClient, ToolCall } from './llm.client';
import { CuratedTools } from './tools/curated-tools';
import { RunSqlTool, SqlRunResult } from './tools/run-sql.tool';
import { SCHEMA_PROMPT } from './tools/schema-prompt';

/**
 * A real tool-calling agent loop running on a local LLM.
 *
 * Note what the system prompt does NOT say: it never tells the model to
 * "only query tenant X" or "always add WHERE tenant_id = …". We do not
 * rely on the model for isolation at all — it can be confused, jailbroken
 * or simply wrong. The database enforces the boundary.
 */
@Injectable()
export class AgentService {
  constructor(
    private readonly llm: LlmClient,
    private readonly runSql: RunSqlTool,
    private readonly curated: CuratedTools,
    private readonly audit: AuditService,
    private readonly rls: RlsStateService,
    private readonly config: ConfigService,
  ) {}

  systemPrompt(ctx: TenantContext, toolset: Toolset) {
    const intro = [
      `You are "Nexus Assistant", a helpful helpdesk & billing analytics agent.`,
      `You are talking to ${ctx.displayName}${ctx.tenantName ? ` from ${ctx.tenantName}` : ''}.`,
    ];
    if (toolset === 'curated') {
      return [
        ...intro,
        `Answer questions by calling the provided tools, then reply with a short, friendly answer based ONLY on what the tools return.`,
        `You cannot write SQL; use only the tools. Never invent data. Format money with 2 decimals.`,
      ].join('\n');
    }
    return [
      ...intro,
      `Answer questions by calling the run_sql tool, then reply with a short, friendly answer based ONLY on the rows returned.`,
      `Never invent data. If the tool returns an error, fix the query and call the tool again. Format money with 2 decimals.`,
      '',
      SCHEMA_PROMPT,
    ].join('\n');
  }

  async chat(
    ctx: TenantContext,
    message: string,
    history: { role: string; content: string }[] = [],
    toolset: Toolset = 'sql',
  ): Promise<AgentReply> {
    const started = Date.now();
    const rlsEnabled = await this.rls.isEnabled();
    const maxSteps = Number(this.config.get('AGENT_MAX_STEPS') ?? 5);
    const steps: AgentStep[] = [];

    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt(ctx, toolset) },
      ...history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-6)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: message },
    ];

    const tools = toolset === 'curated' ? CuratedTools.definitions : [RunSqlTool.definition];
    const toolNames = toolset === 'curated' ? CuratedTools.names : ['run_sql'];

    let answer = '';
    for (let i = 0; i < maxSteps; i++) {
      const reply = await this.llm.chat(messages, tools);
      const calls = reply.tool_calls?.length ? reply.tool_calls : parseInlineToolCall(reply.content, toolNames);

      if (!calls?.length) {
        // Small models sometimes "answer" with invented rows right after a failed query.
        // If the last tool call failed, send the model back instead of accepting the answer.
        const last = steps[steps.length - 1]?.result;
        if (last && !last.ok && i < maxSteps - 1) {
          steps.push({ kind: 'thought', text: 'Last query failed and returned no data — asking the model to fix it instead of answering.' });
          messages.push({ role: 'assistant', content: reply.content ?? '' });
          messages.push({
            role: 'user',
            content:
              `Your last ${toolset === 'curated' ? 'tool call' : 'run_sql query'} FAILED, so you received NO data. ` +
              `Do not answer from memory. ${toolset === 'curated' ? 'Call a tool again' : 'Fix the T-SQL (use TOP n, never LIMIT) and call run_sql again'}, ` +
              `or say that you could not retrieve the data.`,
          });
          continue;
        }
        answer = reply.content?.trim() ?? '';
        break;
      }

      messages.push({ role: 'assistant', content: reply.content ?? '', tool_calls: calls });
      for (const call of calls) {
        const args = parseArgs(call.function.arguments);
        let result: SqlRunResult;
        if (toolset === 'curated') {
          result = await this.curated.call(ctx, call.function.name, args);
          steps.push({ kind: 'tool', tool: call.function.name, args, result });
        } else {
          const query = String(args.query ?? args.sql ?? '');
          result = await this.runSql.run(ctx, query);
          steps.push({ kind: 'tool', tool: 'run_sql', args: { query }, result });
        }
        await this.audit.record(ctx, {
          source: 'agent-llm',
          prompt: toolset === 'curated' ? `[${call.function.name}] ${message}` : message,
          sqlText: result.sql || '(empty)',
          rowCount: result.rowCount,
          outcome: outcomeOf(result),
          errorMessage: result.error?.message,
          rlsEnabled,
          durationMs: result.ms,
        });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(
            result.ok
              ? { rowCount: result.rowCount, rows: result.rows.slice(0, 25), truncated: result.rowCount > 25 }
              : { error: result.error?.message },
          ),
        });
      }
    }

    if (!answer) answer = 'I could not finish within the step limit. Try rephrasing the question.';
    return { mode: 'llm', toolset, model: this.llm.model, answer, steps, rlsEnabled, durationMs: Date.now() - started };
  }
}

function parseArgs(args: string | Record<string, unknown>): Record<string, unknown> {
  try {
    const obj = typeof args === 'string' ? JSON.parse(args || '{}') : args;
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return typeof args === 'string' ? { query: args } : {};
  }
}

/**
 * Small models sometimes print the tool call as JSON text instead of using
 * the structured tool_calls field. Accept both.
 */
function parseInlineToolCall(content: string | undefined, toolNames: string[]): ToolCall[] | undefined {
  if (!content) return undefined;
  const match = content.match(/\{[\s\S]*"name"\s*:\s*"(\w+)"[\s\S]*\}/);
  if (!match || !toolNames.includes(match[1])) return undefined;
  try {
    const obj = JSON.parse(match[0]);
    const args = obj.parameters ?? obj.arguments ?? {};
    return [
      {
        id: `inline-${Date.now()}`,
        type: 'function',
        function: { name: obj.name, arguments: typeof args === 'string' ? args : JSON.stringify(args) },
      },
    ];
  } catch {
    return undefined;
  }
}
