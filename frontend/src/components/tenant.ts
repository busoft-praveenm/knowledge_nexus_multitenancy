// Tenant colours — shared with the slide deck (coral / teal / violet).
export const TENANTS: Record<number, { name: string; color: string; bg: string; text: string; ring: string }> = {
  1: { name: 'Acme Corp', color: '#E8604C', bg: 'bg-[#E8604C]/15', text: 'text-[#F5998B]', ring: 'ring-[#E8604C]/40' },
  2: { name: 'Globex Energy', color: '#0891B2', bg: 'bg-[#0891B2]/20', text: 'text-[#5FD3EA]', ring: 'ring-[#0891B2]/50' },
  3: { name: 'Initech', color: '#7C3AED', bg: 'bg-[#7C3AED]/20', text: 'text-[#B9A0F8]', ring: 'ring-[#7C3AED]/50' },
};

export function tenantStyle(id: number | null | undefined) {
  return (id && TENANTS[id]) || { name: 'Platform', color: '#D97706', bg: 'bg-[#D97706]/15', text: 'text-[#F5B85A]', ring: 'ring-[#D97706]/40' };
}
