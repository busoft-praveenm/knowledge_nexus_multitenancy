import clsx from 'clsx';
import { TenantChip } from './TenantChip';

function format(value: unknown, key: string) {
  if (value === null || value === undefined) return <span className="text-slate-600">—</span>;
  if (key === 'tenant_id' && typeof value === 'number') return <TenantChip id={value} label={String(value)} />;
  if (typeof value === 'number' && /amount|total|revenue|outstanding/.test(key))
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  const s = String(value);
  return s.length > 90 ? `${s.slice(0, 90)}…` : s;
}

export function DataTable({
  rows,
  hide = [],
  highlightTenant,
  maxHeight = 'max-h-[460px]',
}: {
  rows: Record<string, unknown>[];
  hide?: string[];
  highlightTenant?: number | null;
  maxHeight?: string;
}) {
  if (!rows.length)
    return <div className="rounded-lg border border-dashed border-ink-600 p-6 text-center text-sm text-slate-500">0 rows returned</div>;
  const cols = Object.keys(rows[0]).filter((c) => !hide.includes(c));
  return (
    <div className={clsx('overflow-auto rounded-lg border border-ink-700', maxHeight)}>
      <table className="min-w-full divide-y divide-ink-700">
        <thead className="sticky top-0 bg-ink-800">
          <tr>{cols.map((c) => <th key={c} className="th">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-ink-800">
          {rows.map((r, i) => {
            const foreign = highlightTenant != null && typeof r.tenant_id === 'number' && r.tenant_id !== highlightTenant;
            return (
              <tr key={i} className={clsx(foreign ? 'bg-rose-500/10' : i % 2 ? 'bg-ink-900' : 'bg-ink-900/40')}>
                {cols.map((c) => <td key={c} className="td">{format(r[c], c)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
