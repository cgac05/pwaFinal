import type { DashboardOrchestratorResponse, DashboardSignalCard } from "../signals/signalApi";

export interface DashboardSignalHint {
  id?: string;
  signalId?: string;
  symbol?: string;
}

export interface DashboardChatReplyInput {
  question: string;
  ticker: string;
  currentPrice: number;
  dashboard: DashboardOrchestratorResponse;
  selectedSignal?: DashboardSignalHint | null;
}

type QuestionFocus = "risk" | "coverage" | "timing" | "signal" | "summary" | "general";

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatPrice(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return `$${value.toFixed(2)}`;
}

function extractFocus(question: string): QuestionFocus {
  const normalized = normalizeText(question);

  if (/\b(riesgo|risk|stop|stoploss|protecci[oó]n)\b/.test(normalized)) return "risk";
  if (/\b(cobert|hedg|opci[oó]n|options|put|call)\b/.test(normalized)) return "coverage";
  if (/\b(timing|entrada|entry|momento|horizonte|plazo)\b/.test(normalized)) return "timing";
  if (/\b(señal|senal|signal|buy|sell|hold|compra|venta)\b/.test(normalized)) return "signal";
  if (/\b(resumen|summary|overview|panorama|dashboard)\b/.test(normalized)) return "summary";

  return "general";
}

function countSignals(cards: DashboardSignalCard[]): Record<DashboardSignalCard["signal"], number> {
  return cards.reduce(
    (accumulator, card) => {
      accumulator[card.signal] += 1;
      return accumulator;
    },
    { BUY: 0, SELL: 0, HOLD: 0 }
  );
}

function selectRelevantCard(
  cards: DashboardSignalCard[],
  ticker: string,
  selectedSignal?: DashboardSignalHint | null
): DashboardSignalCard | undefined {
  if (cards.length === 0) {
    return undefined;
  }

  const selectedById = selectedSignal?.signalId ?? selectedSignal?.id;
  if (selectedById) {
    const byId = cards.find((card) => card.signalId === selectedById);
    if (byId) {
      return byId;
    }
  }

  if (selectedSignal?.symbol) {
    const bySymbol = cards.find((card) => card.instrument.toUpperCase() === selectedSignal.symbol?.toUpperCase());
    if (bySymbol) {
      return bySymbol;
    }
  }

  const matchingTicker = cards.find((card) => card.instrument.toUpperCase() === ticker.toUpperCase());
  if (matchingTicker) {
    return matchingTicker;
  }

  return [...cards].sort((left, right) => {
    const confluenceDelta = right.confluenceScore - left.confluenceScore;
    if (confluenceDelta !== 0) return confluenceDelta;

    return right.confidence - left.confidence;
  })[0];
}

function formatMetadataLine(card: DashboardSignalCard, focus: QuestionFocus): string | null {
  const metadata = card.metadata;
  if (!metadata) {
    return null;
  }

  if (focus === "coverage") {
    const optionType = metadata.tipo_opcion ?? metadata.variantes_ataque ?? null;
    const strike = formatPrice(metadata.precio_ejercicio);
    const stop = formatPrice(metadata.stoploss_sugerido ?? metadata.stop);
    const expiry = metadata.vencimiento ?? null;

    const parts = [
      optionType ? `cobertura ${optionType}` : null,
      strike ? `ejercicio ${strike}` : null,
      expiry ? `vencimiento ${expiry}` : null,
      stop ? `stop ${stop}` : null
    ].filter((part): part is string => Boolean(part));

    return parts.length > 0 ? `Para cobertura, el tablero destaca ${parts.join(", ")}.` : null;
  }

  if (focus === "risk") {
    const stop = formatPrice(metadata.stoploss_sugerido ?? metadata.stop);
    const target = formatPrice(metadata.objetivo ?? metadata.retorno_maximo);
    const risk = metadata.riesgo ?? null;

    const parts = [
      stop ? `stop ${stop}` : null,
      target ? `objetivo ${target}` : null,
      risk ? `riesgo ${risk}` : null
    ].filter((part): part is string => Boolean(part));

    return parts.length > 0 ? `El perfil de riesgo se lee con ${parts.join(", ")}.` : null;
  }

  if (focus === "timing") {
    const timingD = metadata.timing_d ?? null;
    const timingH = metadata.timing_h ?? null;
    const preSignal = metadata.pre_senal ?? null;
    const activated = metadata.senal_real_activada === undefined ? null : metadata.senal_real_activada ? "señal activa" : "señal en espera";

    const parts = [
      timingD ? `D ${timingD}` : null,
      timingH ? `H ${timingH}` : null,
      preSignal ? `pre-señal ${preSignal}` : null,
      activated
    ].filter((part): part is string => Boolean(part));

    return parts.length > 0 ? `El timing se resume en ${parts.join(", ")}.` : null;
  }

  return null;
}

function summarizePeerCards(cards: DashboardSignalCard[], primaryCard: DashboardSignalCard): string | null {
  const peers = cards
    .filter((card) => card.signalId !== primaryCard.signalId)
    .slice()
    .sort((left, right) => right.confluenceScore - left.confluenceScore)
    .slice(0, 2);

  if (peers.length === 0) {
    return null;
  }

  return `Como contraste, ${peers
    .map((peer) => `${peer.instrument} está en ${peer.signal} con ${formatPercent(peer.confidence)} de confianza`)
    .join("; ")}.`;
}

export function buildFallbackDashboardSnapshot(ticker: string, currentPrice: number): DashboardOrchestratorResponse {
  const safePrice = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : 1;

  return {
    timeframe: "1d",
    generatedAt: new Date().toISOString(),
    instruments: [ticker],
    cards: [
      {
        signalId: `fallback-${ticker}`,
        instrument: ticker,
        signal: "HOLD",
        confidence: 0.5,
        confluenceScore: 50,
        riskLevel: "MEDIUM",
        activeCores: ["technical", "options"],
        updatedAt: new Date().toISOString(),
        evidence: [],
        metadata: {
          stop: Number((safePrice * 0.95).toFixed(2)),
          objetivo: Number((safePrice * 1.05).toFixed(2)),
          riesgo: "neutral"
        }
      }
    ]
  };
}

export function composeDashboardChatReply(input: DashboardChatReplyInput): string {
  const cards = input.dashboard.cards ?? [];
  if (cards.length === 0) {
    return `No encontré tarjetas de confluencia para ${input.ticker}. Con el precio actual de $${input.currentPrice.toFixed(2)}, la mejor lectura es esperar datos nuevos del dashboard antes de tomar una decisión.`;
  }

  const focus = extractFocus(input.question);
  const relevantCard = selectRelevantCard(cards, input.ticker, input.selectedSignal) ?? cards[0];
  const signalCounts = countSignals(cards);
  const topCores = [...relevantCard.activeCores].slice(0, 3).join(", ") || "sin cores activados";
  const confidenceText = formatPercent(relevantCard.confidence);
  const primarySummary = `Con el dashboard actual, ${relevantCard.instrument} muestra una señal ${relevantCard.signal} con ${confidenceText} de confianza y un score de confluencia de ${relevantCard.confluenceScore}.`;
  const inventorySummary = `El tablero resume ${signalCounts.BUY} compra(s), ${signalCounts.SELL} venta(s) y ${signalCounts.HOLD} neutral(es) entre ${cards.length} tarjeta(s) activas.`;
  const evidenceSummary = `La evidencia útil viene de ${relevantCard.evidence.length} fuente(s) y de los cores ${topCores}.`;
  const focusSummary = formatMetadataLine(relevantCard, focus);
  const peerSummary = summarizePeerCards(cards, relevantCard);

  const responseParts = [
    primarySummary,
    inventorySummary,
    focusSummary ?? evidenceSummary,
    peerSummary,
    `En términos prácticos, la lectura actual es ${relevantCard.signal === "BUY" ? "constructiva" : relevantCard.signal === "SELL" ? "defensiva" : "neutral"} para una decisión guiada por el dashboard.`
  ].filter((part): part is string => Boolean(part));

  return responseParts.join("\n\n") + "\n\nEsta respuesta se genera solo con el snapshot actual del dashboard; no uso memoria entre preguntas.";
}