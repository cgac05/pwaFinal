// FIC: Persistencia best-effort de simulation_runs (T088, FR-008) — auditoria sin bloquear respuesta.
// FIC: Best-effort persistence of simulation_runs (FR-008) — auditing without blocking the response.

import type { SimulationRunResult } from "./runner";

let cachedClient: any = null;
let lookupTried = false;

function tryGetClient(): any {
  if (lookupTried) return cachedClient;
  lookupTried = true;
  if (process.env.NODE_ENV === "test" || !process.env.SUPABASE_URL) {
    cachedClient = null;
    return null;
  }
  try {
    // FIC: Carga perezosa para no requerir env en tests / ambientes locales sin Supabase.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("../../database/supabase/client");
    cachedClient = mod.supabaseClient ?? null;
  } catch {
    cachedClient = null;
  }
  return cachedClient;
}

export async function persistSimulationRun(
  result: SimulationRunResult,
  userId?: string
): Promise<void> {
  const client = tryGetClient();
  if (!client) return;
  try {
    await client.from("simulation_runs").insert([
      {
        ticket: result.inputs_echo.ticket,
        timeframe: result.inputs_echo.temporalidad,
        runtime_mode: result.inputs_echo.runtimeMode,
        estrategia: result.inputs_echo.estrategia,
        tolerancia_riesgo: result.inputs_echo.toleranciaRiesgo,
        inputs_echo: result.inputs_echo,
        verdict: result.verdict,
        rows: result.table,
        source_input_hash: result.verdict.source_input_hash,
        algorithm_version: result.algorithm_version,
        user_id: userId,
        computed_at: result.computed_at
      }
    ]);
  } catch {
    // FIC: Best-effort — el auditing nunca bloquea la respuesta del usuario.
  }
}
