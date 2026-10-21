import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Loader2, Lock, LockOpen, Play, ShieldCheck, ShieldX, Skull } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '../api/client';
import { AttackRun, AttackScenario, ModeOutcome } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/Layout';
import { Pill, ResultBadge } from '../components/ResultBadge';
import { SqlBlock } from '../components/SqlBlock';

export function AttackLab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>('direct-injection');
  const [runs, setRuns] = useState<Record<string, AttackRun>>({});

  const catalog = useQuery({
    queryKey: ['attacks', user?.email],
    queryFn: async () => (await api.get<AttackScenario[]>('/attacks')).data,
  });

  const run = useMutation({
    mutationFn: async (vars: { id: string; modes: ('on' | 'off')[] }) =>
      (await api.post<AttackRun>(`/attacks/${vars.id}/run`, { modes: vars.modes })).data,
    onSuccess: (data, vars) => {
      setRuns((r) => ({ ...r, [vars.id]: { scenario: data.scenario, results: { ...r[vars.id]?.results, ...data.results } } }));
      qc.invalidateQueries({ queryKey: ['rls'] });
    },
  });

  const scenario = catalog.data?.find((s) => s.id === selectedId);
  const result = runs[selectedId]?.results;

  if (user?.role === 'platform_admin')
    return <div className="card p-6 text-slate-300">Sign in as a tenant user (e.g. Alice @ Acme) to run attacks against other tenants.</div>;

  return (
    <div>
      <PageHeader
        title="Attack Lab"
        subtitle={
          <>
            Each scenario sends the SQL a <b className="text-slate-200">compromised agent</b> (or buggy app) would send — with the app's SQL guard{' '}
            <b className="text-amber-300">bypassed</b> — and runs it twice: with the RLS policy <b className="text-emerald-300">ON</b> and{' '}
            <b className="text-rose-300">OFF</b>.
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          {catalog.data?.map((s, i) => {
            const r = runs[s.id]?.results;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={clsx('card p-3 text-left transition hover:border-indigo-400/50', selectedId === s.id && 'border-indigo-400/70 ring-1 ring-indigo-400/40')}
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-ink-700 text-[11px] font-bold text-slate-300">{String.fromCharCode(65 + i)}</span>
                  <span className="text-sm font-semibold text-slate-100">{s.title}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-8 text-[11px] text-slate-500">
                  {s.category}
                  {r?.on && <VerdictDot o={r.on} label="ON" />}
                  {r?.off && <VerdictDot o={r.off} label="OFF" />}
                </div>
              </button>
            );
          })}
        </div>

        {scenario && (
          <div className="min-w-0 space-y-5">
            <div className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="text-xs font-semibold uppercase tracking-wider text-indigo-300">{scenario.owasp}</div>
                  <h2 className="mt-1 text-xl font-extrabold text-white">{scenario.title}</h2>
                  <p className="mt-2 text-sm text-slate-400">{scenario.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-success" disabled={run.isPending} onClick={() => run.mutate({ id: scenario.id, modes: ['on'] })}>
                    <Lock size={15} /> Run with RLS ON
                  </button>
                  <button className="btn-danger" disabled={run.isPending} onClick={() => run.mutate({ id: scenario.id, modes: ['off'] })}>
                    <LockOpen size={15} /> Run with RLS OFF
                  </button>
                  <button className="btn-primary" disabled={run.isPending} onClick={() => run.mutate({ id: scenario.id, modes: ['on', 'off'] })}>
                    {run.isPending ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Compare both
                  </button>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
                <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-300">
                  <Skull size={14} /> Attacker input
                </div>
                <div className="font-mono text-sm text-rose-100">“{scenario.attackerInput}”</div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                Defended by: {scenario.defendedBy.map((d) => <Pill key={d} tone="emerald">{d}</Pill>)}
              </div>
              {run.error && <div className="mt-3 text-sm text-rose-300">{errorMessage(run.error)}</div>}
            </div>

            <div className="grid gap-5 2xl:grid-cols-2">
              <OutcomeColumn mode="on" outcome={result?.on} scenario={scenario} me={user?.tenantId ?? null} />
              <OutcomeColumn mode="off" outcome={result?.off} scenario={scenario} me={user?.tenantId ?? null} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VerdictDot({ o, label }: { o: ModeOutcome; label: string }) {
  return (
    <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-bold', o.verdict === 'defended' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300')}>
      {label}: {o.verdict === 'defended' ? 'safe' : 'leak'}
    </span>
  );
}

function OutcomeColumn({ mode, outcome, scenario, me }: { mode: 'on' | 'off'; outcome?: ModeOutcome; scenario: AttackScenario; me: number | null }) {
  const on = mode === 'on';
  return (
    <div className={clsx('card overflow-hidden', on ? 'border-emerald-500/30' : 'border-rose-500/30')}>
      <div className={clsx('flex items-center gap-2 px-4 py-2.5 text-sm font-bold', on ? 'bg-emerald-500/10 text-emerald-200' : 'bg-rose-500/10 text-rose-200')}>
        {on ? <Lock size={15} /> : <LockOpen size={15} />} RLS policy {on ? 'ON' : 'OFF'}
        {outcome && (
          <span className="ml-auto">
            {outcome.verdict === 'defended' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-extrabold text-emerald-950">
                <ShieldCheck size={14} /> DEFENDED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-0.5 text-xs font-extrabold text-white">
                <ShieldX size={14} /> BREACHED{outcome.leakedRows ? ` · ${outcome.leakedRows} foreign rows` : ''}
              </span>
            )}
          </span>
        )}
      </div>
      <div className="space-y-3 p-4">
        {!outcome &&
          scenario.steps.map((s, i) => (
            <div key={i} className="opacity-60">
              <div className="mb-1 text-xs font-semibold text-slate-400">
                Step {i + 1}: {s.title} <span className="font-mono text-slate-500">as nexus_{s.identity}</span>
              </div>
              <SqlBlock sql={s.sql} />
            </div>
          ))}
        {outcome?.steps.map((s, i) => (
          <div key={i} className="rounded-xl border border-ink-700 bg-ink-950/40 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-200">Step {i + 1}: {s.title}</span>
              <span className="font-mono text-slate-500">as nexus_{s.identity}</span>
              <span className="ml-auto"><ResultBadge r={s} me={me} /></span>
            </div>
            <SqlBlock sql={s.sql} />
            {!s.guard.allowed && (
              <div className="mt-2 text-[11px] text-amber-300/90">⚠ App guard would have blocked this ("{s.guard.reason}") — bypassed on purpose to test the database.</div>
            )}
            {s.note && <div className="mt-1 text-[11px] text-slate-500">{s.note}</div>}
            {s.error && <div className="mt-2 rounded-md bg-ink-900 p-2 font-mono text-[11px] text-slate-300">Msg {s.error.number}: {s.error.message}</div>}
            {s.ok && s.rows.length > 0 && (
              <div className="mt-2">
                <DataTable rows={s.rows.slice(0, 6)} hide={['body']} highlightTenant={me} maxHeight="max-h-48" />
                {s.rowCount > 6 && <div className="mt-1 text-[11px] text-slate-500">…{s.rowCount - 6} more rows</div>}
              </div>
            )}
          </div>
        ))}
        {outcome && outcome.leakedTenants.length > 0 && (
          <div className="text-xs text-rose-300">Rows from tenant(s) {outcome.leakedTenants.join(', ')} reached the agent.</div>
        )}
      </div>
    </div>
  );
}
