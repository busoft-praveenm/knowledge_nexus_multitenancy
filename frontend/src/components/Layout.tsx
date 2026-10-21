import clsx from 'clsx';
import { Bot, Database, FlaskConical, LogOut, Network, ShieldCheck } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { RlsPill } from './RlsPill';
import { initials } from './initials';
import { tenantStyle } from './tenant';

const NAV = [
  { to: '/data', label: 'Data Explorer', icon: Database },
  { to: '/agent', label: 'AI Agent', icon: Bot },
  { to: '/attacks', label: 'Attack Lab', icon: FlaskConical },
  { to: '/admin', label: 'Platform Admin', icon: ShieldCheck, adminOnly: true },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const t = tenantStyle(user?.tenantId);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-900/70 px-3 py-5">
        <div className="mb-7 flex items-center gap-2.5 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/30">
            <Network size={20} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-tight text-white">Knowledge Nexus</div>
            <div className="text-[11px] text-slate-500">Multi-tenant AI Helpdesk</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.filter((n) => !n.adminOnly || user?.role === 'platform_admin').map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-500/30' : 'text-slate-400 hover:bg-ink-800 hover:text-slate-200',
                )
              }
            >
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-ink-700 bg-ink-950/60 p-3 text-[11px] leading-relaxed text-slate-500">
          Isolation is enforced by <span className="font-semibold text-slate-300">SQL Server Row-Level Security</span>, not by the app or the AI.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-ink-800 bg-ink-950/85 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="h-9 w-1.5 rounded-full" style={{ background: t.color }} />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Signed in to</div>
              <div className="text-base font-bold text-white">{user?.tenantName}</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 font-mono text-[11.5px] text-slate-400 md:flex">
            <span className="text-slate-500">SESSION_CONTEXT</span>
            <span className="text-pink-300">tenant_id</span>=<span className="text-cyan-300">{user?.tenantId ?? 'NULL'}</span>
            <span className="text-pink-300">role</span>=<span className="text-amber-300">'{user?.role}'</span>
            <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">READ-ONLY</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <RlsPill />
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white" style={{ background: user?.avatarColor }}>
                {initials(user?.displayName ?? '')}
              </div>
              <div className="hidden text-right lg:block">
                <div className="text-sm font-semibold text-slate-200">{user?.displayName}</div>
                <div className="text-[11px] text-slate-500">{user?.email}</div>
              </div>
            </div>
            <button
              className="btn-ghost"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              title="Switch persona"
            >
              <LogOut size={15} /> Switch
            </button>
          </div>
        </header>
        <main className="flex-1 px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
