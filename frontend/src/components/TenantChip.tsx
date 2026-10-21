import clsx from 'clsx';
import { tenantStyle } from './tenant';

export function TenantChip({ id, label, className }: { id: number | null | undefined; label?: string; className?: string }) {
  const s = tenantStyle(id);
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ring-1', s.bg, s.text, s.ring, className)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {label ?? (id ? `${id} · ${s.name}` : s.name)}
    </span>
  );
}
