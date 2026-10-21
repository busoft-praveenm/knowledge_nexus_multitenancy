/**
 * Layer 1 of defence: an application-level guard on SQL the agent writes.
 *
 * It is deliberately simple — and that is the point of the talk:
 * guards like this are useful (they stop obvious abuse and give nice
 * errors) but they are NOT a security boundary. Regex can be evaded;
 * the database policy cannot. RLS is the boundary, this is a seatbelt.
 */
export interface GuardVerdict {
  allowed: boolean;
  reason?: string;
}

const FORBIDDEN = [
  'insert', 'update', 'delete', 'merge', 'drop', 'alter', 'create', 'truncate',
  'exec', 'execute', 'grant', 'revoke', 'deny', 'backup', 'restore', 'dbcc',
  'openrowset', 'openquery', 'opendatasource', 'bulk', 'waitfor', 'shutdown',
  'sp_set_session_context', 'xp_cmdshell',
];

export function stripSqlComments(sqlText: string): string {
  return sqlText.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');
}

export function checkSql(sqlText: string): GuardVerdict {
  const cleaned = stripSqlComments(sqlText).trim().replace(/;\s*$/, '');
  if (!cleaned) return { allowed: false, reason: 'Empty query' };
  if (cleaned.includes(';')) return { allowed: false, reason: 'Only a single statement is allowed' };
  if (!/^(select|with)\b/i.test(cleaned)) return { allowed: false, reason: 'Only SELECT queries are allowed' };
  // ignore string literals when scanning for keywords
  const noStrings = cleaned.replace(/N?'(?:[^']|'')*'/g, "''").toLowerCase();
  const hit = FORBIDDEN.find((kw) => new RegExp(`\\b${kw}\\b`).test(noStrings));
  if (hit) return { allowed: false, reason: `Keyword "${hit.toUpperCase()}" is not allowed` };
  if (/\bplatform\./.test(noStrings)) return { allowed: false, reason: 'The platform schema is off-limits' };
  return { allowed: true };
}
