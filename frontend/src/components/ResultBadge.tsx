import { ShieldAlert, ShieldCheck, ShieldX, TriangleAlert } from 'lucide-react';
import { SqlRunResult } from '../api/types';

export function ResultBadge({ r, me }: { r: SqlRunResult; me: number | null }) {
  const foreign = r.tenantsInResult.filter((t) => t !== me);
  if (r.blockedBy === 'guard')
    return <Pill tone="amber" icon={<ShieldAlert size={13} />}>Blocked by app guard</Pill>;
  if (r.blockedBy === 'database')
    return <Pill tone="emerald" icon={<ShieldCheck size={13} />}>Blocked by database · error {r.error?.number}</Pill>;
  if (!r.ok) return <Pill tone="slate" icon={<TriangleAlert size={13} />}>SQL error {r.error?.number ?? ''}</Pill>;
  if (foreign.length && me != null)
    return <Pill tone="rose" icon={<ShieldX size={13} />}>LEAK · {r.rowCount} rows incl. tenant {foreign.join(', ')}</Pill>;
  return <Pill tone="sky" icon={<ShieldCheck size={13} />}>OK · {r.rowCount} row{r.rowCount === 1 ? '' : 's'} · {r.ms} ms</Pill>;
}

const TONES = {
  amber: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
  emerald: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40',
  rose: 'bg-rose-500/15 text-rose-300 ring-rose-500/40',
  sky: 'bg-sky-500/15 text-sky-300 ring-sky-500/40',
  slate: 'bg-slate-500/15 text-slate-300 ring-slate-500/40',
};

export function Pill({ tone, icon, children }: { tone: keyof typeof TONES; icon?: JSX.Element; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${TONES[tone]}`}>
      {icon}
      {children}
    </span>
  );
}
