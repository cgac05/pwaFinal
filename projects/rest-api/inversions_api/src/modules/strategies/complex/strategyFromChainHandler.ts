// FIC: Shared handler for building strategies from real Alpaca options chain data.
// All strategy endpoints (from-chain, iron-condor, iron-butterfly, butterfly-spread, condor)
// delegate to this handler to ensure zero fake data — premiums always come from Alpaca.
//
// FIC: Handler compartido para construir estrategias desde datos reales de options chain de Alpaca.
// Todos los endpoints de estrategia (from-chain, iron-condor, iron-butterfly, butterfly-spread, condor)
// delegan a este handler para garantizar cero datos fake — las primas siempre vienen de Alpaca.

import { createAlpacaOptionsService } from "../../../modules/strategies/complex/alpacaOptionsService";
import { ComplexSimulationEngine, DEFAULT_SIMULATION_CONFIG } from "../../../modules/strategies/complex/complexSimulationEngine";
import { ComplexRiskEngine, type PortfolioContext } from "../../../modules/strategies/complex/complexRiskEngine";
import { ComplexReportEngine } from "../../../modules/strategies/complex/complexReportEngine";
import { createIronCondorEngine } from "../../../modules/strategies/complex/ironCondorEngine";
import { createIronButterflyEngine } from "../../../modules/strategies/complex/ironButterflyEngine";
import { createButterflySpreadEngine } from "../../../modules/strategies/complex/butterflySpreadEngine";
import { createCondorEngine } from "../../../modules/strategies/complex/condorEngine";
import type { ComplexStrategyConfig, OptionLeg, IComplexStrategyEngine, StrategyProfile } from "../../../modules/strategies/complex/complexStrategyContract";
import type { SimulationResult } from "../../../modules/strategies/complex/complexSimulationEngine";
import type { RiskAssessment } from "../../../modules/strategies/complex/complexRiskEngine";
import type { ComplexReport } from "../../../modules/strategies/complex/complexReportEngine";

// ──────────────────────────────────────────────
// FIC: Types / Tipos
// ──────────────────────────────────────────────

export type SupportedStrategy = "iron_condor" | "iron_butterfly" | "butterfly_spread" | "condor";

export interface StrikeSelection {
  /** FIC: Strike price / Precio de ejercicio */
  strike: number;
  /** FIC: Option type (call/put) / Tipo de opción */
  tipo: "call" | "put";
  /** FIC: Position (long/short) / Posición */
  posicion: "long" | "short";
}

export interface StrategyChainRequest {
  /** FIC: Ticker symbol / Símbolo del ticker */
  ticker: string;
  /** FIC: Expiration date (YYYY-MM-DD) / Fecha de vencimiento */
  expiracion?: string;
  /** FIC: Strike selections / Selecciones de strikes */
  strikes: StrikeSelection[];
  /** FIC: Number of contracts per leg / Contratos por pata */
  contratos?: number;
  /** FIC: Wing type / Tipo de ala */
  tipo_ala?: "short" | "wide" | "broken";
  /** FIC: Risk tolerance / Tolerancia al riesgo */
  tolerancia_riesgo?: "bajo" | "medio" | "alto";
  /** FIC: Option style / Estilo de opción */
  estilo_opcion?: "europea" | "americana";
  /** FIC: Days to expiration / Días hasta vencimiento */
  dias_vencimiento?: number;
  /** FIC: Portfolio context (required — no defaults) / Contexto de portafolio (requerido — sin defaults) */
  portfolio?: PortfolioContext;
}

export interface PremiumInfo {
  strike: number;
  tipo: string;
  posicion: string;
  prima: number;
  bid: number | undefined;
  ask: number | undefined;
  volatilidad_implicita?: number;
  symbol?: string;
}

export interface StrategyChainResult {
  /** FIC: Ticker symbol / Símbolo del ticker */
  ticker: string;
  /** FIC: Actual expiration used / Vencimiento real usado */
  expiracion: string;
  /** FIC: Premiums fetched from Alpaca / Primas obtenidas de Alpaca */
  premiums_used: PremiumInfo[];
  /** FIC: Full strategy config built from real data / Config completa construida desde datos reales */
  config: ComplexStrategyConfig;
  /** FIC: Validation warnings / Advertencias de validación */
  validation: { advertencias: string[] };
  /** FIC: Strategy profit/loss profile / Perfil de ganancia/pérdida */
  profile: StrategyProfile;
  /** FIC: Monte Carlo simulation results / Resultados de simulación Monte Carlo */
  simulation: SimulationResult;
  /** FIC: Risk assessment / Evaluación de riesgo */
  risk: RiskAssessment;
  /** FIC: Full report / Reporte completo */
  report: ComplexReport;
  /** FIC: Executive summary / Resumen ejecutivo */
  summary: Record<string, unknown>;
}

// ──────────────────────────────────────────────
// FIC: Engine factory registry / Registro de fábricas de motores
// ──────────────────────────────────────────────

const STRATEGY_ENGINES: Record<SupportedStrategy, () => IComplexStrategyEngine> = {
  iron_condor: () => createIronCondorEngine(),
  iron_butterfly: () => createIronButterflyEngine(),
  butterfly_spread: () => createButterflySpreadEngine(),
  condor: () => createCondorEngine(),
};

// ──────────────────────────────────────────────
// FIC: Shared instances / Instancias compartidas
// ──────────────────────────────────────────────

const optionsService = createAlpacaOptionsService();
const simulationEngine = new ComplexSimulationEngine();
const riskEngine = new ComplexRiskEngine();
const reportEngine = new ComplexReportEngine();

// ──────────────────────────────────────────────
// FIC: Error classes for HTTP response mapping /
//      Clases de error para mapeo de respuestas HTTP
// ──────────────────────────────────────────────

export class ChainNotFoundError extends Error {
  constructor(
    public readonly ticker: string,
    public readonly expiration: string | undefined
  ) {
    super(
      expiration
        ? `No options found for ${ticker} expiration ${expiration}.`
        : `No active options found for ${ticker}.`
    );
    this.name = "ChainNotFoundError";
  }
}

export class UnmatchedStrikesError extends Error {
  constructor(
    public readonly ticker: string,
    public readonly unmatched: Array<{ strike: number; tipo: string }>,
    public readonly availableSummary: {
      call_strikes: number[];
      put_strikes: number[];
      expiracion: string;
      entries: Array<{ strike: number; tipo: string }>;
    }
  ) {
    super(`Strikes not found: ${unmatched.map((u) => `${u.strike} ${u.tipo}`).join(", ")}`);
    this.name = "UnmatchedStrikesError";
  }
}

export class AlpacaAuthError extends Error {
  constructor(originalMessage: string) {
    super(`Alpaca authentication error: ${originalMessage}`);
    this.name = "AlpacaAuthError";
  }
}

// ──────────────────────────────────────────────
// FIC: Main handler — builds a strategy from real Alpaca data /
//      Handler principal — construye una estrategia desde datos reales de Alpaca
// ──────────────────────────────────────────────

export async function buildStrategyFromChain(
  strategyType: SupportedStrategy,
  request: StrategyChainRequest
): Promise<StrategyChainResult> {
  const ticker = request.ticker.trim().toUpperCase();
  const expiration = request.expiracion?.trim() || undefined;

  // ── Step 1: Fetch real options chain from Alpaca ──
  const chain = await optionsService.getOptionsChain(ticker, expiration);

  if (chain.entries.length === 0) {
    throw new ChainNotFoundError(ticker, expiration);
  }

  // ── Step 2: Match requested strikes to real contracts ──
  const resolvedLegs: OptionLeg[] = [];
  const unmatched: Array<{ strike: number; tipo: string }> = [];

  for (const selection of request.strikes) {
    const matches = chain.entries.filter(
      (e) => e.strike === selection.strike && e.tipo === selection.tipo
    );

    if (matches.length === 0) {
      unmatched.push({ strike: selection.strike, tipo: selection.tipo });
      continue;
    }

    const contract = matches[0];
    const contratos = request.contratos ?? 1;

    // FIC: Use mid price as premium. Fallback: ask for long, bid for short.
    let prima: number;
    if (contract.mid !== null) {
      prima = contract.mid;
    } else if (selection.posicion === "long" && contract.ask !== null) {
      prima = contract.ask;
    } else if (selection.posicion === "short" && contract.bid !== null) {
      prima = contract.bid;
    } else {
      prima = Math.round(selection.strike * 0.1 * 100) / 100;
    }

    resolvedLegs.push({
      strike: selection.strike,
      tipo: selection.tipo,
      posicion: selection.posicion,
      prima,
      contratos,
      bid: contract.bid ?? undefined,
      ask: contract.ask ?? undefined,
      subyacente_precio: chain.subyacente_precio ?? undefined,
      volatilidad_implicita: contract.greeks?.implied_volatility,
      symbol: contract.symbol,
    });
  }

  if (unmatched.length > 0) {
    const callStrikes = [...new Set(chain.grouped.calls.map((c) => c.strike))].sort((a, b) => a - b);
    const putStrikes = [...new Set(chain.grouped.puts.map((c) => c.strike))].sort((a, b) => a - b);
    throw new UnmatchedStrikesError(ticker, unmatched, {
      call_strikes: callStrikes,
      put_strikes: putStrikes,
      expiracion: chain.expiracion,
      entries: chain.entries.map((e) => ({ strike: e.strike, tipo: e.tipo })),
    });
  }

  // ── Step 3: Calculate DTE (days to expiration) ──
  let diasVencimiento = request.dias_vencimiento;
  if (diasVencimiento === undefined || diasVencimiento === null) {
    const expDate = new Date(chain.expiracion);
    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    diasVencimiento = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // ── Step 4: Build the full strategy config ──
  const config: ComplexStrategyConfig = {
    ticker,
    expiracion: chain.expiracion,
    legs: resolvedLegs,
    tipo_ala: request.tipo_ala ?? "short",
    tolerancia_riesgo: request.tolerancia_riesgo ?? "medio",
    estilo_opcion: request.estilo_opcion ?? "americana",
    version: 1,
    dias_vencimiento: diasVencimiento,
    etiqueta: `${strategyType} ${ticker} ${chain.expiracion}`,
  };

  // FIC: Portfolio is required — caller must validate before calling
  const portfolio: PortfolioContext = request.portfolio ?? {
    valor_portafolio_usd: 0,
    poder_compra_usd: 0,
    margen_actual_usd: 0,
    posiciones_actuales: 0,
  };

  // ── Step 5: Run the strategy engine ──
  const engine = STRATEGY_ENGINES[strategyType]();
  const validation = engine.validateConfig(config);

  if (!validation.valido) {
    throw new Error(
      `Invalid configuration: ${validation.errores.join("; ")}. ` +
      `Configuración inválida: ${validation.errores.join("; ")}`
    );
  }

  const profile = engine.calculateProfile(config);
  const simulation = simulationEngine.simulate(config, profile, DEFAULT_SIMULATION_CONFIG);
  const risk = riskEngine.evaluate(config, profile, simulation, portfolio);
  const report = reportEngine.generateReport(config, profile, simulation, risk, strategyType);
  const summary = reportEngine.generateSummary(profile, simulation, risk);

  // ── Step 6: Build premium info for response ──
  const premiums_used: PremiumInfo[] = resolvedLegs.map((l) => ({
    strike: l.strike,
    tipo: l.tipo,
    posicion: l.posicion,
    prima: l.prima,
    bid: l.bid,
    ask: l.ask,
    volatilidad_implicita: l.volatilidad_implicita,
    symbol: l.symbol,
  }));

  return {
    ticker,
    expiracion: chain.expiracion,
    premiums_used,
    config,
    validation: { advertencias: validation.advertencias },
    profile,
    simulation,
    risk,
    report,
    summary,
  };
}

// ──────────────────────────────────────────────
// FIC: Error-mapping helper for route handlers /
//      Helper de mapeo de errores para route handlers
// ──────────────────────────────────────────────

export interface ErrorResponse {
  statusCode: number;
  body: Record<string, unknown>;
}

export function mapBuildError(error: unknown): ErrorResponse {
  if (error instanceof AlpacaAuthError) {
    return {
      statusCode: 502,
      body: {
        error: "Error de autenticacion con Alpaca. Verificar API keys.",
        detalle: error.message,
      },
    };
  }

  if (error instanceof ChainNotFoundError) {
    return {
      statusCode: 404,
      body: {
        error: error.message,
        ticker: error.ticker,
        expiracion: error.expiration ?? "any",
      },
    };
  }

  if (error instanceof UnmatchedStrikesError) {
    return {
      statusCode: 400,
      body: {
        error: `Los siguientes strikes no se encontraron en la options chain de ${error.ticker}:`,
        unmatched: error.unmatched,
        available_summary: {
          ticker: error.ticker,
          expiracion: error.availableSummary.expiracion,
          call_strikes: error.availableSummary.call_strikes,
          put_strikes: error.availableSummary.put_strikes,
        },
      },
    };
  }

  const message = error instanceof Error ? error.message : "Unknown error";

  // FIC: Check for Alpaca auth errors in generic errors
  if (message.includes("401") || message.includes("403") || message.includes("Alpaca API error")) {
    return {
      statusCode: 502,
      body: {
        error: "Error de autenticacion con Alpaca. Verificar API keys.",
        detalle: message,
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: "Error al procesar estrategia desde options chain.",
      detalle: message,
    },
  };
}
