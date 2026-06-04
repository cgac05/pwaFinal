// FIC: Complex Comparator API route - receives 2-4 strategy configurations and returns side-by-side comparison.
// FIC: Ruta API de Comparador Complejo - recibe 2-4 configuraciones de estrategia y retorna comparación lado a lado.

import { Router } from "express";
import { authContextMiddleware } from "../../../middleware/authContext";
import { createIronCondorEngine } from "../../../modules/strategies/complex/ironCondorEngine";
import { createIronButterflyEngine } from "../../../modules/strategies/complex/ironButterflyEngine";
import { createButterflySpreadEngine } from "../../../modules/strategies/complex/butterflySpreadEngine";
import { createCondorEngine } from "../../../modules/strategies/complex/condorEngine";
import { ComplexSimulationEngine, DEFAULT_SIMULATION_CONFIG } from "../../../modules/strategies/complex/complexSimulationEngine";
import { ComplexRiskEngine, type PortfolioContext } from "../../../modules/strategies/complex/complexRiskEngine";
import type { ComplexStrategyConfig, StrategyProfile } from "../../../modules/strategies/complex/complexStrategyContract";
import type { SimulationResult } from "../../../modules/strategies/complex/complexSimulationEngine";
import type { RiskAssessment } from "../../../modules/strategies/complex/complexRiskEngine";

export const complexComparatorRouter = Router();

const simulationEngine = new ComplexSimulationEngine();
const riskEngine = new ComplexRiskEngine();

// FIC: Supported strategy types and their engines / Tipos de estrategia soportados y sus motores
const STRATEGY_ENGINES: Record<string, () => { validateConfig(config: ComplexStrategyConfig): { valido: boolean; errores: string[]; advertencias: string[] }; calculateProfile(config: ComplexStrategyConfig): StrategyProfile }> = {
  "iron_condor": () => {
    const e = createIronCondorEngine();
    return { validateConfig: (c) => e.validateConfig(c), calculateProfile: (c) => e.calculateProfile(c) };
  },
  "iron_butterfly": () => {
    const e = createIronButterflyEngine();
    return { validateConfig: (c) => e.validateConfig(c), calculateProfile: (c) => e.calculateProfile(c) };
  },
  "butterfly_spread": () => {
    const e = createButterflySpreadEngine();
    return { validateConfig: (c) => e.validateConfig(c), calculateProfile: (c) => e.calculateProfile(c) };
  },
  "condor": () => {
    const e = createCondorEngine();
    return { validateConfig: (c) => e.validateConfig(c), calculateProfile: (c) => e.calculateProfile(c) };
  },
};

// FIC: Request body for the comparator / Cuerpo de solicitud para el comparador
interface CompareRequestBody {
  strategies: Array<{
    type: string;
    config: ComplexStrategyConfig;
  }>;
  portfolio?: PortfolioContext;
}

// FIC: Comparison result for a single strategy / Resultado de comparación para una estrategia individual
interface StrategyComparisonEntry {
  name: string;
  type: string;
  ticker: string;
  profile: {
    credito_neto: number;
    tipo_neto: "credito" | "debito";
    perdida_maxima: number;
    ganancia_maxima: number;
    ratio_riesgo_beneficio: number;
    probabilidad_ganancia: number | undefined;
    break_even_points: number[];
  };
  simulation: {
    probabilidad_exito: number;
    rendimiento_esperado: number;
    drawdown_maximo: number;
    ratio_sharpe: number;
  };
  risk: {
    puntaje_riesgo: number;
    riesgo_aceptable: boolean;
    eventos_criticos: number;
  };
}

// FIC: Full comparison result / Resultado completo de comparación
interface CompareResult {
  comparacion: StrategyComparisonEntry[];
  mejores_metricas: {
    mejor_ratio_riesgo: string | null;
    mejor_probabilidad_exito: string | null;
    mejor_sharpe: string | null;
    menor_riesgo: string | null;
    menor_perdida: string | null;
  };
  recomendacion: string;
}

complexComparatorRouter.post("/compare", authContextMiddleware, (req, res) => {
  try {
    const body = req.body as CompareRequestBody;
    const portfolio = (body.portfolio ?? {
      valor_portafolio_usd: 100000,
      poder_compra_usd: 50000,
      margen_actual_usd: 0,
      posiciones_actuales: 0,
    }) as PortfolioContext;

    // FIC: Validate input
    if (!body.strategies || body.strategies.length < 2 || body.strategies.length > 4) {
      res.status(400).json({
        error: "Se requieren entre 2 y 4 estrategias para comparar. Between 2 and 4 strategies required for comparison.",
      });
      return;
    }

    // FIC: Process each strategy
    const entries: StrategyComparisonEntry[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < body.strategies.length; i++) {
      const { type, config } = body.strategies[i];
      const engineFactory = STRATEGY_ENGINES[type];

      if (!engineFactory) {
        errors.push({ index: i, error: `Unsupported strategy type: ${type}` });
        continue;
      }

      try {
        const engine = engineFactory();
        const validation = engine.validateConfig(config);

        if (!validation.valido) {
          errors.push({
            index: i,
            error: `Validation failed for strategy ${i + 1}: ${validation.errores.join("; ")}`,
          });
          continue;
        }

        const profile = engine.calculateProfile(config);
        const simulation = simulationEngine.simulate(config, profile, DEFAULT_SIMULATION_CONFIG);
        const risk = riskEngine.evaluate(config, profile, simulation, portfolio);

        entries.push({
          name: config.etiqueta ?? `${type} #${i + 1}`,
          type,
          ticker: config.ticker,
          profile: {
            credito_neto: profile.credito_neto,
            tipo_neto: profile.tipo_neto,
            perdida_maxima: profile.perdida_maxima,
            ganancia_maxima: profile.ganancia_maxima,
            ratio_riesgo_beneficio: profile.ratio_riesgo_beneficio ?? 0,
            probabilidad_ganancia: profile.probabilidad_ganancia,
            break_even_points: profile.break_even_points,
          },
          simulation: {
            probabilidad_exito: simulation.probabilidad_exito,
            rendimiento_esperado: simulation.rendimiento_esperado,
            drawdown_maximo: simulation.drawdown_maximo,
            ratio_sharpe: simulation.ratio_sharpe,
          },
          risk: {
            puntaje_riesgo: risk.puntaje_riesgo,
            riesgo_aceptable: risk.riesgo_aceptable,
            eventos_criticos: risk.eventos.filter((e) => e.severidad === "critical" || e.severidad === "blocking").length,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push({ index: i, error: msg });
      }
    }

    if (entries.length === 0) {
      res.status(400).json({
        error: "No strategies could be processed",
        errors,
      });
      return;
    }

    // FIC: Calculate best metrics across all entries
    const mejoresMetricas = {
      mejor_ratio_riesgo: entries.reduce((best, e) =>
        !best || e.profile.ratio_riesgo_beneficio > best.value
          ? { name: e.name, value: e.profile.ratio_riesgo_beneficio }
          : best,
      null as { name: string; value: number } | null
      )?.name ?? null,

      mejor_probabilidad_exito: entries.reduce((best, e) =>
        !best || e.simulation.probabilidad_exito > best.value
          ? { name: e.name, value: e.simulation.probabilidad_exito }
          : best,
      null as { name: string; value: number } | null
      )?.name ?? null,

      mejor_sharpe: entries.reduce((best, e) =>
        !best || e.simulation.ratio_sharpe > best.value
          ? { name: e.name, value: e.simulation.ratio_sharpe }
          : best,
      null as { name: string; value: number } | null
      )?.name ?? null,

      menor_riesgo: entries.reduce((best, e) =>
        !best || e.risk.puntaje_riesgo < best.value
          ? { name: e.name, value: e.risk.puntaje_riesgo }
          : best,
      null as { name: string; value: number } | null
      )?.name ?? null,

      menor_perdida: entries.reduce((best, e) =>
        !best || e.profile.perdida_maxima < best.value
          ? { name: e.name, value: e.profile.perdida_maxima }
          : best,
      null as { name: string; value: number } | null
      )?.name ?? null,
    };

    // FIC: Generate recommendation
    const recomendacion = generateRecommendation(entries);

    const result: CompareResult = {
      comparacion: entries,
      mejores_metricas: mejoresMetricas,
      recomendacion,
    };

    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: "Internal server error", detalle: message });
  }
});

function generateRecommendation(entries: StrategyComparisonEntry[]): string {
  if (entries.length === 0) return "No hay estrategias para comparar. No strategies to compare.";

  const withValidRisk = entries.filter((e) => e.risk.riesgo_aceptable);

  if (withValidRisk.length === 0) {
    return "Ninguna estrategia pasa los controles de riesgo. Revisar parámetros. " +
           "No strategy passes risk checks. Review parameters.";
  }

  // FIC: Score each strategy: higher Sharpe + higher prob + lower risk = better
  const scored = withValidRisk.map((e) => {
    const sharpeScore = Math.max(0, e.simulation.ratio_sharpe) * 30;
    const probScore = e.simulation.probabilidad_exito * 0.3;
    const riskPenalty = (100 - e.risk.puntaje_riesgo) * 0.4;
    const totalScore = sharpeScore + probScore + riskPenalty;
    return { name: e.name, score: Math.round(totalScore * 100) / 100 };
  });

  const best = scored.reduce((a, b) => (a.score > b.score ? a : b));
  const worst = scored.reduce((a, b) => (a.score < b.score ? a : b));

  if (best.name === worst.name) {
    return `La estrategia "${best.name}" es la mejor opcion con un puntaje de ${best.score}. ` +
           `"${best.name}" is the best option with a score of ${best.score}.`;
  }

  return `Recomendacion: "${best.name}" (puntaje ${best.score}) es preferible sobre "${worst.name}" (${worst.score}). ` +
         `Recommendation: "${best.name}" (score ${best.score}) is preferable over "${worst.name}" (${worst.score}).`;
}
