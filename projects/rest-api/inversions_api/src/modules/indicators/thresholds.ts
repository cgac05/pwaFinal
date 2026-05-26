// FIC: Umbrales centralizados Phase 6 (T139, T140) — fuente unica para verdict y ADX.
// FIC: Centralized thresholds Phase 6 — single source of truth for verdict and ADX (FR-004, FR-006).

import type { ConfluenceVerdictLabel } from "./types";

// FIC: Spec FR-006 — alcista > 0.2, bajista < -0.2, neutral en [-0.2, 0.2] inclusivo en ambos extremos.
export const VERDICT_THRESHOLDS = {
  alcista: 0.2,
  bajista: -0.2
} as const;

// FIC: Spec FR-004 — ADX <20 sin_tendencia, [20,25) debil, [25,50) fuerte, >=50 muy_fuerte.
export const ADX_THRESHOLDS = {
  sin_tendencia: 20,
  debil: 25,
  fuerte: 50
} as const;

export function verdictFromScore(score: number): ConfluenceVerdictLabel {
  if (score > VERDICT_THRESHOLDS.alcista) return "alcista";
  if (score < VERDICT_THRESHOLDS.bajista) return "bajista";
  return "neutral";
}
