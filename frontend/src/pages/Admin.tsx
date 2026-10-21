import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Lock, LockOpen, RefreshCw } from 'lucide-react';
import { api, errorMessage } from '../api/client';
import { PageHeader } from '../components/Layout';
import { Pill } from '../components/ResultBadge';
import { useRlsState } from '../components/RlsPill';
import { SqlBlock } from '../components/SqlBlock';
import { TenantChip } from '../components/TenantChip';

interface AuditRow {
  audit_id: number;
  at_utc: string;
  tenant_id: number | null;
  email: string | null;
  source: string;
  prompt: string | null;
  sql_text: string;
  row_count: number | null;
  outcome: string;
  error_message: string | null;
  rls_enabled: boolean;
  duration_ms: number | null;
}

interface PolicyRow {
  policy: string;
  is_enabled: boolean;
  target_table: string;
  predicate_type_desc: string;
  operation_desc: string | null;
  predicate_definition: string;
}

const OUTCOME_TONE: Record<string, 'emerald' | 'amber' | 'sky' | 'slate'> = {
  ok: 'sky',
  'blocked-guard': 'amber',
  'blocked-database': 'emerald',
  error: 'slate',
};

export function Admin() {
  const qc = useQueryClient();
  const rls = useRlsState();
  const audit = useQuery({
    queryKey: ['audit'],
    queryFn: async () => (await api.get<AuditRow[]>('/admin/audit?limit=150')).data,
    refetchInterval: 4000,
  });
  const policy = useQuery({
    queryKey: ['policy'],
    queryFn: async () => (await api.get<PolicyRow[]>('/admin/policy')).data,
  });
  const toggle = useMutation({
    mutationFn: async (enabled: boolean) => (await api.post<{ enabled: boolean }>('/admin/rls', { enabled })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rls'] });
      qc.invalidateQueries({ queryKey: ['policy'] });
    },
  });

  const enabled = rls.data;

  return (
    <div>
      <PageHeader
        title="Platform Admin"
        subtitle="Platform staff control the security policy and see an audit trail of every statement an AI agent executed — across all tenants."
      />

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className={clsx('card p-5', enabled ? 'border-emerald-500/40' : 'border-rose-500/50')}>
            <div className="label">Security policy</div>
            <div className="mt-1 font-mono text-sm text-slate-200">security.TenantIsolation</div>
            <div className="mt-5 flex items-center gap-4">
              <button
                onClick={() => toggle.mutate(!enabled)}
                disabled={toggle.isPending || enabled === undefined}
                className={clsx('relative h-10 w-20 rounded-full transition', enabled ? 'bg-emerald-500' : 'bg-rose-600')}
              >
                <span className={clsx('absolute top-1 grid h-8 w-8 place-items-center rounded-full bg-white shadow transition-all', enabled ? 'left-11' : 'left-1')}>
                  {enabled ? <Lock size={15} className="text-emerald-600" /> : <LockOpen size={15} className="text-rose-600" />}
                </span>
              </button>
              <div>
                <div className={clsx('text-lg font-extrabold', enabled ? 'text-emerald-300' : 'text-rose-300')}>{enabled ? 'ENFORCED' : 'DISABLED'}</div>
                <div className="text-xs text-slate-500">{enabled ? 'Tenants are isolated by the database.' : 'Every tenant can see every row!'}</div>
              </div>
            </div>
            <SqlBlock className="mt-5" sql={`ALTER SECURITY POLICY security.TenantIsolation\n  WITH (STATE = ${enabled ? 'OFF' : 'ON'});`} label="Clicking the switch runs (as nexus_admin)" />
            {toggle.error && <div className="mt-2 text-xs text-rose-300">{errorMessage(toggle.error)}</div>}
          </div>

          <div className="card p-5">
            <div className="label mb-3">Predicates bound by the policy</div>
            <div className="space-y-1.5">
              {policy.data?.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-ink-950/60 px-3 py-1.5 text-xs">
                  <span className="font-mono text-slate-300">{p.target_table}</span>
                  <span className="flex gap-1.5">
                    <Pill tone={p.predicate_type_desc === 'FILTER' ? 'sky' : 'amber'}>{p.predicate_type_desc}</Pill>
                    {p.operation_desc && <Pill tone="slate">{p.operation_desc.replace('_', ' ')}</Pill>}
                  </span>
                </div>
              ))}
            </div>
            {policy.data?.[0] && <SqlBlock className="mt-4" sql={`security.fn_tenant_predicate(tenant_id)\n-- ${policy.data[0].predicate_definition}`} />}
          </div>
        </div>

        <div className="card min-w-0 p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="text-sm font-bold text-white">Agent audit log</div>
            <span className="text-xs text-slate-500">platform.agent_audit_log · newest first</span>
            <button className="btn-ghost ml-auto" onClick={() => audit.refetch()}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          <div className="max-h-[calc(100vh-260px)] overflow-auto rounded-lg border border-ink-700">
            <table className="min-w-full divide-y divide-ink-700">
              <thead className="sticky top-0 bg-ink-800">
                <tr>
                  {['time', 'tenant', 'user', 'source', 'sql', 'rows', 'outcome', 'rls'].map((h) => <th key={h} className="th">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {audit.data?.map((a) => (
                  <tr key={a.audit_id} className="align-top">
                    <td className="td font-mono text-[11px] text-slate-500">{a.at_utc.slice(11, 19)}</td>
                    <td className="td"><TenantChip id={a.tenant_id} label={String(a.tenant_id ?? '–')} /></td>
                    <td className="td text-xs text-slate-400">{a.email}</td>
                    <td className="td text-xs">{a.source}</td>
                    <td className="max-w-[300px] px-3 py-2">
                      <div className="truncate font-mono text-[11px] text-slate-300" title={a.sql_text}>{a.sql_text}</div>
                      {a.error_message && <div className="truncate text-[11px] text-slate-500" title={a.error_message}>{a.error_message}</div>}
                    </td>
                    <td className="td text-xs">{a.row_count ?? '–'}</td>
                    <td className="td"><Pill tone={OUTCOME_TONE[a.outcome] ?? 'slate'}>{a.outcome}</Pill></td>
                    <td className="td">{a.rls_enabled ? <Lock size={13} className="text-emerald-400" /> : <LockOpen size={13} className="text-rose-400" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!audit.data?.length && <div className="p-6 text-center text-sm text-slate-500">No agent activity yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
