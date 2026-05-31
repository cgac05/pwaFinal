// FIC: Persistencia best-effort de simulation_runs (T088, FR-008) — auditoria sin bloquear respuesta.
// FIC: Best-effort persistence of simulation_runs (FR-008) — auditing without blocking the response.

import type { SimulationRunResult } from "./runner";
import { mockDb } from "../volatility/mockDb";

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
  try {
    const aiRow = result.table.find((row) => row.core === "A_IA");
    if (aiRow) {
      const decisionText = aiRow.tipoSenal === "CALL" ? "SÍ" : "NO";
      const justification = aiRow.observacion?.explicacion || "Sin justificación.";
      const analysisSummary = aiRow.observacion?.explicacion || "Sin análisis.";

      const newResult: any = {
        id: `res_sim_${Date.now()}`,
        ticker: (result.inputs_echo.ticket || "UNKNOWN").toUpperCase(),
        decision: decisionText,
        justification,
        date: new Date().toISOString(),
        scores: `Score Financiero: N/A\nScore Técnico: N/A\nScore Noticias: N/A\nScore Opciones: N/A (Origen: Simulación Core IA - ${aiRow.tipoSenal})`,
        chatHistory: [],
        analysisSummary,
        analysisSource: "gemini",
      };

      mockDb.results.unshift(newResult);
    }
  } catch (err) {
    console.error("Error intercepting A_IA persistence in mockDb:", err);
  }

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
