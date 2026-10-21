import clsx from 'clsx';
import { Fragment } from 'react';

const KEYWORDS =
  /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|JOIN|LEFT|INNER|ON|GROUP|BY|ORDER|DESC|ASC|TOP|COUNT|SUM|MIN|MAX|AS|INSERT|INTO|VALUES|UPDATE|DELETE|SET|EXEC|EXECUTE|OUTPUT|DISTINCT|CASE|WHEN|THEN|ELSE|END|LIKE|IS|NULL|WITH|ALTER|SECURITY|POLICY|STATE)\b/gi;

function highlight(sql: string) {
  const parts: (string | JSX.Element)[] = [];
  const re = new RegExp(`(N?'(?:[^']|'')*')|${KEYWORDS.source}|(tenant_id)|(@?\\b\\d+\\b)`, 'gi');
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(sql))) {
    if (m.index > last) parts.push(sql.slice(last, m.index));
    const [tok] = m;
    const cls = m[1]
      ? 'text-amber-300'
      : m[3]
        ? 'text-pink-300 font-semibold'
        : /^@?\d+$/.test(tok)
          ? 'text-cyan-300'
          : 'text-indigo-300 font-semibold';
    parts.push(<span key={i++} className={cls}>{tok}</span>);
    last = m.index + tok.length;
  }
  parts.push(sql.slice(last));
  return parts;
}

export function SqlBlock({ sql, className, label }: { sql: string; className?: string; label?: string }) {
  return (
    <div className={clsx('overflow-hidden rounded-lg border border-ink-700 bg-ink-950', className)}>
      {label && <div className="border-b border-ink-700 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>}
      <pre className="whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-slate-300">
        {highlight(sql).map((p, i) => <Fragment key={i}>{p}</Fragment>)}
      </pre>
    </div>
  );
}
