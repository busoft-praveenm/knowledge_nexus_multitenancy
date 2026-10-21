import { useQuery } from '@tanstack/react-query';
import { Lock, LockOpen } from 'lucide-react';
import { api } from '../api/client';

export function useRlsState() {
  return useQuery({
    queryKey: ['rls'],
    queryFn: async () => (await api.get<{ enabled: boolean }>('/admin/rls')).data.enabled,
    refetchInterval: 4000,
  });
}

export function RlsPill() {
  const { data: enabled } = useRlsState();
  if (enabled === undefined) return null;
  return enabled ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/40">
      <Lock size={13} /> RLS POLICY ON
    </span>
  ) : (
    <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-300 ring-1 ring-rose-500/50">
      <LockOpen size={13} /> RLS POLICY OFF
    </span>
  );
}
