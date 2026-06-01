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
  // 1. Mapear e insertar en mockDb.results para el Chat Copilot (desarrollo local/best-effort)
  try {
    const aiRow = result.table.find((r) => r.core === "A_IA");
    if (aiRow) {
      const decision = (aiRow.tipoSenal === "CALL" || aiRow.tipoSenal === "PUT") ? "SÍ" : "NO";
      
      // Construir string de scores de confluencia para los demás cores
      const scoreParts: string[] = [];
      result.table.forEach((r) => {
        if (r.core !== "A_IA") {
          const coreName = r.core === "A_INDICADORES" ? "Indicadores" : r.core === "A_TECNICO" ? "Técnico" : r.core === "A_INSTITUCIONAL" ? "Institucional" : r.core;
          const scoreVal = Math.round(Math.abs(r.score) * 100);
          scoreParts.push(`Score ${coreName}: ${scoreVal}/100`);
        }
      });
      
      const scoresStr = scoreParts.length > 0 ? scoreParts.join("\n") : "Score Volatilidad: 70/100";
      
      const newMockResult = {
        id: `res_sim_${Date.now()}`,
        ticker: result.inputs_echo.ticket.toUpperCase(),
        decision: decision as "SÍ" | "NO",
        justification: aiRow.observacion?.explicacion || "Sin justificación estructurada.",
        date: result.computed_at || new Date().toISOString(),
        scores: scoresStr,
        chatHistory: [],
        analysisSummary: aiRow.observacion?.explicacion || "Análisis completado.",
        recommendedStrategy: result.inputs_echo.estrategia,
        riskLevel: (result.inputs_echo.toleranciaRiesgo === "ALTO" ? "HIGH" : result.inputs_echo.toleranciaRiesgo === "MEDIO" ? "MEDIUM" : "LOW") as any,
        popEstimate: 80,
        confidence: Math.abs(aiRow.score || 0.85),
        warnings: [] as string[],
        scoreSnapshot: {
          financial: 70,
          technical: 65,
          news: 55,
          options: 75,
          weighted: 67,
          completeness: 100
        },
        analysisSource: "gemini" as const
      };
      
      mockDb.results.unshift(newMockResult);
      console.log(`[PERSISTENCE] Simulacion de confluencia guardada localmente en mockDb para ticker ${newMockResult.ticker} con decision ${newMockResult.decision}`);
    }
  } catch (err: any) {
    console.error("[PERSISTENCE] Error al guardar simulacion localmente en mockDb:", err.message || err);
  }

  // 2. Persistir en Supabase si está disponible
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
