/** "Priya (Platform Ops)" -> "PP", "Alice Johnson" -> "AJ" */
export const initials = (name: string) =>
  name.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
