// FIC: Wheel eligibility API client -- consumes the backend coverage screening endpoint. (EN)
// FIC: Cliente API de elegibilidad Wheel -- consume el endpoint backend de cobertura. (ES)

import { getAuthHeaders } from "../signals/signalApi";

export type WheelEligibilityCriterionStatus = "pass" | "fail" | "unavailable";
export type WheelEligibilityStatus = "eligible" | "not_eligible" | "partial";

export interface WheelEligibilityCriterion {
  id: string;
  label: string;
  status: WheelEligibilityCriterionStatus;
  value?: number | string;
  threshold?: number | string;
  details: string;
}

export interface WheelEligibilityResult {
  ticker: string;
  eligible: boolean;
  status: WheelEligibilityStatus;
  evaluatedAt: string;
  criteria: WheelEligibilityCriterion[];
  summary: {
    passed: number;
    failed: number;
    unavailable: number;
    total: number;
  };
}

const cache = new Map<string, Promise<WheelEligibilityResult>>();

export function fetchWheelEligibility(symbol: string): Promise<WheelEligibilityResult> {
  const normalized = symbol.trim().toUpperCase();
  const cached = cache.get(normalized);
  if (cached) return cached;

  const request = fetch(
    `/api/coverage/wheel/eligibility?symbol=${encodeURIComponent(normalized)}`,
    { headers: getAuthHeaders() }
  ).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { code?: string; message?: string };
      throw new Error(body.message ?? body.code ?? `WHEEL_ELIGIBILITY_${res.status}`);
    }
    return (await res.json()) as WheelEligibilityResult;
  });

  cache.set(normalized, request);
  return request;
}
