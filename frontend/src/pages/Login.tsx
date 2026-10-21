import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Bot, Building2, Database, Network, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { Persona } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { initials } from '../components/initials';
import { tenantStyle } from '../components/tenant';

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: personas = [], isLoading, error: loadError } = useQuery({
    queryKey: ['personas'],
    queryFn: async () => (await api.get<Persona[]>('/auth/personas')).data,
  });

  if (user) return <Navigate to={user.role === 'platform_admin' ? '/admin' : '/data'} replace />;

  const groups = personas.reduce<Record<string, Persona[]>>((acc, p) => {
    (acc[p.tenantName] ??= []).push(p);
    return acc;
  }, {});

  async function pick(p: Persona) {
    setBusy(p.email);
    setError(null);
    try {
      await login(p.email);
      navigate(p.role === 'platform_admin' ? '/admin' : '/data');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-6 py-14">
        <div className="mb-12 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/40">
            <Network size={24} className="text-white" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-white">Knowledge Nexus</div>
            <div className="text-xs text-slate-400">Multi-tenant AI Helpdesk · demo</div>
          </div>
        </div>

        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
          Multi-Tenancy in the Age of <span className="bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">AI Agents</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-400">
          Three companies share one database. An AI agent writes its own SQL. Row-Level Security makes sure nobody — not even a
          jail-broken agent — can see another tenant's data.
        </p>

        <div className="mt-8 flex flex-wrap gap-3 text-xs">
          {[
            { icon: Building2, t: '3 tenants · 1 shared schema' },
            { icon: Bot, t: 'Local LLM agent (free)' },
            { icon: Database, t: 'SQL Server Row-Level Security' },
            { icon: ShieldCheck, t: 'Read-only session context' },
          ].map(({ icon: I, t }) => (
            <span key={t} className="inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/70 px-3 py-1.5 font-medium text-slate-300">
              <I size={14} className="text-indigo-300" /> {t}
            </span>
          ))}
        </div>

        <h2 className="mb-4 mt-14 text-sm font-bold uppercase tracking-wider text-slate-500">Choose a persona to sign in</h2>
        {isLoading && <div className="text-slate-500">Loading personas…</div>}
        {loadError && <div className="card border-rose-500/40 p-4 text-rose-300">API not reachable: {errorMessage(loadError)}. Is the backend running on :3000?</div>}
        {error && <div className="mb-4 text-sm text-rose-300">{error}</div>}

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {Object.entries(groups).map(([tenant, people]) => {
            const s = tenantStyle(people[0].tenantId);
            return (
              <div key={tenant} className="card overflow-hidden">
                <div className="h-1.5" style={{ background: s.color }} />
                <div className="p-4">
                  <div className="text-base font-bold text-white">{tenant}</div>
                  <div className="text-xs text-slate-500">
                    {people[0].industry} · {people[0].plan} {people[0].tenantId ? `· tenant_id ${people[0].tenantId}` : ''}
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    {people.map((p) => (
                      <button
                        key={p.email}
                        onClick={() => pick(p)}
                        disabled={!!busy}
                        className="group flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-950/50 p-2.5 text-left transition hover:border-indigo-400/60 hover:bg-ink-800"
                      >
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: p.avatarColor }}>
                          {initials(p.displayName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-100">{p.displayName}</div>
                          <div className="truncate text-[11px] text-slate-500">{p.email} · {p.role.replace('_', ' ')}</div>
                        </div>
                        <ArrowRight size={16} className="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-indigo-300" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
