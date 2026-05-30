// formatCurrency(13_689_562_430) → "$13.69B"
// formatCurrency(450_000_000)    → "$450.00M"
// formatCurrency(1_234_000_000_000) → "$1.23t"
// formatCurrency(2_500)          → "$2.50K"
// formatCurrency(-6_864)         → "-$6.86K"
export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}t`;
  if (abs >= 1_000_000_000)     return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000)         return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)             return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}
