import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Building2, FileText, PenLine, Receipt, Ticket, Users } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/Layout';
import { Pill } from '../components/ResultBadge';
import { SqlBlock } from '../components/SqlBlock';
import { TENANTS } from '../components/tenant';

type DataSet = 'tickets' | 'customers' | 'invoices';

interface Summary {
  customers: number;
  tickets: number;
  open_tickets: number;
  invoices: number;
  outstanding: number;
  tenants_visible: number;
  rlsEnabled: boolean;
}

export function DataExplorer() {
  const { user } = useAuth();
  const [set, setSet] = useState<DataSet>('tickets');

  const summary = useQuery({
    queryKey: ['summary', user?.email],
    queryFn: async () => (await api.get<Summary>('/data/summary')).data,
    refetchInterval: 5000,
  });
  const list = useQuery({
    queryKey: ['data', set, user?.email],
    queryFn: async () => (await api.get<{ sql: string; rows: Record<string, unknown>[]; rlsEnabled: boolean }>(`/data/${set}`)).data,
    refetchInterval: 5000,
  });

  const s = summary.data;
  const stats = [
    { label: 'Customers', value: s?.customers, icon: Users },
    { label: 'Tickets', value: s?.tickets, sub: `${s?.open_tickets ?? '–'} open`, icon: Ticket },
    { label: 'Invoices', value: s?.invoices, icon: Receipt },
    { label: 'Outstanding', value: s ? `$${Number(s.outstanding).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : undefined, icon: FileText },
    { label: 'Tenants visible', value: s?.tenants_visible, icon: Building2, warn: (s?.tenants_visible ?? 0) > 1 },
  ];

  return (
    <div>
      <PageHeader
        title="Data Explorer"
        subtitle={
          <>
            Every query on this page is written <b className="text-slate-200">without</b> a <code className="text-pink-300">WHERE tenant_id = …</code> clause.
            The database filters rows using the tenant pinned on the connection.
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map(({ label, value, sub, icon: Icon, warn }) => (
          <div key={label} className={clsx('card p-4', warn && user?.role !== 'platform_admin' && 'border-rose-500/50 bg-rose-500/10')}>
            <div className="flex items-center justify-between">
              <span className="label">{label}</span>
              <Icon size={16} className="text-slate-500" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-white">{value ?? '–'}</div>
            {sub && <div className="text-xs text-slate-500">{sub}</div>}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card p-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(['tickets', 'customers', 'invoices'] as DataSet[]).map((k) => (
              <button key={k} onClick={() => setSet(k)} className={clsx(set === k ? 'btn-primary' : 'btn-ghost', 'capitalize')}>
                {k}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
              {list.data && <Pill tone="sky">{list.data.rows.length} rows</Pill>}
              {list.data && (
                <Pill tone="slate">
                  tenant_id in result: {[...new Set(list.data.rows.map((r) => r.tenant_id))].join(', ') || '—'}
                </Pill>
              )}
            </div>
          </div>
          {list.data && <SqlBlock sql={list.data.sql.replace(/\s+/g, ' ').trim()} label="SQL sent by the API (no tenant filter!)" className="mb-4" />}
          {list.isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading…</div>
          ) : list.error ? (
            <div className="text-rose-300">{errorMessage(list.error)}</div>
          ) : (
            <DataTable rows={list.data?.rows ?? []} hide={['body']} highlightTenant={user?.role === 'platform_admin' ? null : user?.tenantId} />
          )}
        </div>

        <CrossTenantWrite />
      </div>
    </div>
  );
}

function CrossTenantWrite() {
  const { user } = useAuth();
  const [target, setTarget] = useState<number>(user?.tenantId ?? 1);
  const [subject, setSubject] = useState('Printer on floor 3 is jammed');
  const mutation = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ ok: boolean; sql: string; ticket?: { ticket_id: number; tenant_id: number }; error?: { number: number; message: string } }>(
          '/data/tickets',
          { subject, body: 'Created from the Data Explorer demo panel.', priority: 'Medium', targetTenantId: target },
        )
      ).data,
  });
  const r = mutation.data;

  return (
    <div className="card h-fit p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
        <PenLine size={16} className="text-indigo-300" /> Write test: create a ticket
      </div>
      <p className="mb-4 text-xs text-slate-400">
        Pick a target tenant. Writing to your own tenant succeeds; writing to another one is rejected by the RLS <b>BLOCK predicate</b>.
      </p>
      <label className="label">Subject</label>
      <input className="input mb-3 mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <label className="label">Target tenant_id</label>
      <div className="mb-4 mt-1 grid grid-cols-3 gap-2">
        {Object.entries(TENANTS).map(([id, t]) => (
          <button
            key={id}
            onClick={() => setTarget(Number(id))}
            className={clsx('rounded-lg border px-2 py-2 text-xs font-semibold transition', target === Number(id) ? 'border-indigo-400 bg-indigo-500/15 text-white' : 'border-ink-600 text-slate-400 hover:bg-ink-800')}
          >
            <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: t.color }} />
            {id} · {t.name.split(' ')[0]}
            {Number(id) === user?.tenantId && <span className="block text-[10px] text-slate-500">(yours)</span>}
          </button>
        ))}
      </div>
      <button className="btn-primary w-full justify-center" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Inserting…' : 'INSERT ticket'}
      </button>
      {r && (
        <div className="mt-4 space-y-2">
          {r.ok ? (
            <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-200">
              ✅ Inserted ticket #{r.ticket?.ticket_id} into tenant {r.ticket?.tenant_id}.
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              🛡️ <b>Blocked by the database</b> (error {r.error?.number}).
              <div className="mt-1 font-mono text-[11px] text-emerald-300/80">{r.error?.message}</div>
            </div>
          )}
        </div>
      )}
      {mutation.error && <div className="mt-3 text-xs text-rose-300">{errorMessage(mutation.error)}</div>}
    </div>
  );
}
