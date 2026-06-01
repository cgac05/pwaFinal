# Short Put — Implementación Completa

## Índice
1. [Modelo de Datos](#modelo-de-datos)
2. [Lógica de Negocio](#lógica-de-negocio)
3. [Motor de Simulación](#motor-de-simulación)
4. [Comparador de Estrategias](#comparador-de-estrategias)
5. [Servicio de Alertas](#servicio-de-alertas)
6. [API Endpoints](#api-endpoints)
7. [Integración Chat IA](#integración-chat-ia)
8. [UI Components](#ui-components)
9. [Tests](#tests)
10. [Flujo Completo](#flujo-completo)

---

## Modelo de Datos

**Archivo:** `projects/rest-api/inversions_api/src/modules/strategies/optionsStrategyContract.ts`

### Tipos Base

```typescript
export type OptionType = "CALL" | "PUT";
export type OptionDirection = "LONG" | "SHORT";
export type RiskTolerance = "LOW" | "MEDIUM" | "HIGH";
export type TimeDecayModel = "LINEAR" | "EXPONENTIAL";
```

### OptionStrategyInput — Entrada

```typescript
export interface OptionStrategyInput {
  ticker: string;
  optionType: OptionType;           // "PUT" para short put
  direction: OptionDirection;        // "SHORT" para short put
  strikePrice: number;
  currentPrice: number;
  expirationDate: string;
  daysToExpiration: number;
  premiumPerContract: number;
  numberOfContracts: number;
  availableCapital: number;
  riskTolerance: RiskTolerance;
  assumptions: {
    impliedVolatility?: number;     // default: 25
    timeDecayModel?: TimeDecayModel;
    interestRate?: number;          // default: 4%
    expectedReturn?: number;
  };
}
```

### OptionStrategyOutput — Salida

```typescript
export interface OptionStrategyOutput {
  ticker: string;
  optionType: OptionType;
  direction: OptionDirection;
  premium: number;
  quantity: number;
  breakEvenPrice: number;
  maxProfit: number;
  maxLoss: number;
  requiredMargin: number;
  scenarioAtm: PriceScenario;
  scenarioPlus5: PriceScenario;
  scenarioMinus5: PriceScenario;
  riskAdjustedReturn: number;
  probabilityItm: number;
  warnings: string[];
  calculatedAt: string;
  calculationVersion: string;
  assumptions: OptionStrategyInput["assumptions"];
}
```

### OptionStrategyContract — Contrato API simplificado

```typescript
export interface OptionStrategyContract {
  ticker: string;
  optionType: "call" | "put" | "CALL" | "PUT";
  direction: "long" | "short" | "LONG" | "SHORT";
  strikePrice: number;
  currentPrice?: number;
  expirationDate: string;
  daysToExpiration?: number;
  premium: number;
  quantity: number;
  capitalAvailable?: number;
  riskTolerance?: "low" | "medium" | "high" | "LOW" | "MEDIUM" | "HIGH";
  assumptions?: { impliedVolatility?: number; timeDecayModel?: string; interestRate?: number };
}
```

### OpenPosition — Posición Abierta

```typescript
// alertService.ts líneas 14–27
export interface OpenPosition {
  positionId: string;
  ticker: string;
  strategyType: "LONG_CALL" | "LONG_PUT" | "SHORT_CALL" | "SHORT_PUT";
  entryPrice: number;
  strikePrice: number;
  expirationDate: string;
  quantity: number;
  stopLossLevel: number;
  takeProfitLevel: number;
  status: "OPEN" | "REQUESTED_CLOSE" | "CLOSED";
  createdAt: string;
  userId: string;
}
```

---

## Lógica de Negocio

**Archivo:** `projects/rest-api/inversions_api/src/modules/strategies/options/shortPut.ts` (216 líneas)

### Fórmulas

```
P&L            = Premium - max(K - S, 0)
Breakeven      = StrikePrice - Premium
Max Profit     = Premium × contratos × 100
Max Loss       = (Strike - Premium) × contratos × 100
Margin requerido ≈ 20% del valor del strike
```

### calculateShortPutPnL (líneas 15–27)

```typescript
export function calculateShortPutPnL(
  currentPrice: number,
  strikePrice: number,
  premium: number,
  numberOfContracts: number,
  atPrice?: number
): number {
  const priceToUse = atPrice ?? currentPrice;
  const assignmentObligationValue = Math.max(strikePrice - priceToUse, 0);
  const totalObligation = assignmentObligationValue * numberOfContracts * 100;
  const totalPremiumReceived = premium * numberOfContracts * 100;
  return totalPremiumReceived - totalObligation;
}
```

### calculateThetaDecay (líneas 32–49)

- Vendedor se beneficia del paso del tiempo
- Modelo LINEAR: `premium * (1 - decayRatio)`
- Modelo EXPONENTIAL: decaimiento acelerado hacia vencimiento

### evaluateShortPut (líneas 76–167)

**Validación:** confirma `optionType === "PUT"` y `direction === "SHORT"`.

**Cálculos:**
```typescript
breakEven      = strikePrice - premium               // línea 89
maxProfit      = premium * numberOfContracts * 100   // línea 92
maxLoss        = (strikePrice - premium) * numberOfContracts * 100  // línea 96
requiredMargin ≈ strikePrice * 0.20 * numberOfContracts * 100       // línea 99
```

**Probabilidad ITM:** usa volatilidad implícita y z-score estadístico (líneas 131–135).

**Escenarios generados** (líneas 102–124):
| Escenario | Descripción |
|---|---|
| ATM | Precio actual — evalúa si está en el money |
| +5% | Movimiento favorable — precio sube, put OTM |
| -5% | Movimiento adverso — precio baja, put ITM |

**Warnings automáticos** (líneas 137–145):
- Probabilidad de asignación > 70%
- Opción ya ITM al momento del cálculo
- Notificación de pérdida máxima potencial

### checkMarginAlert (líneas 172–182)

```typescript
// Trigger cuando pérdida mark-to-market supera threshold
marketToMarketLoss > premiumBenefit * (1 - marginLevel)
// default marginLevel = 0.75
```

### calculateShortPutResult (líneas 187–215)

Wrapper simplificado compatible con tests y `OptionStrategyContract`.

---

## Motor de Simulación

**Archivo:** `projects/rest-api/inversions_api/src/modules/strategies/simulationEngine.ts` (237 líneas)

### Punto de simulación diaria

```typescript
export interface DailySimulationPoint {
  day: number;
  date: string;
  underlayingPrice: number;
  profitLoss: number;
  theta: number;           // Decaimiento temporal (positivo para vendedor)
  gamma: number;           // Sensibilidad a cambios de precio
  vega: number;            // Sensibilidad a cambios de volatilidad
  impliedVolatility: number;
}
```

### Dispatch de estrategia (líneas 126–128)

```typescript
case "SHORT_PUT":
  strategyOutput = evaluateShortPut(updatedParams);
  break;
```

### Métricas de riesgo calculadas

| Métrica | Descripción |
|---|---|
| Sharpe Ratio | `avgReturn / stdDev` |
| Sortino Ratio | Solo penaliza volatilidad negativa |
| Max Drawdown | Peor pérdida acumulada en el path |
| Max Runup | Mejor ganancia acumulada en el path |
| Breakeven Date | Día en que P&L cruza a positivo |

---

## Comparador de Estrategias

**Archivo:** `projects/rest-api/inversions_api/src/modules/strategies/strategyComparator.ts` (265 líneas)

### Umbrales de recomendación

| Estrategia | viabilityScore mínimo |
|---|---|
| Short Put | >= 0.65 |
| Short Call | >= 0.70 |
| Long Call | >= 0.60 |
| Long Put | >= 0.60 |

Short Put tiene umbral intermedio — más riesgo que Long pero menor que Short Call (riesgo ilimitado).

### Scoring (líneas 244–264)

```typescript
// Base score
let score = output.riskAdjustedReturn;

// Ajuste Short Put: penaliza alta probabilidad de asignación
score *= (1 + (1 - output.probabilityItm));

// Caps para valores infinitos
if (!isFinite(score)) score = 0.5;
```

### Rationale generado

```
"Short Put: Risk-Adjusted Return = X.XX. Captura prima en bajada. Pérdida finita."
```

---

## Servicio de Alertas

**Archivo:** `projects/rest-api/inversions_api/src/modules/strategies/alertService.ts` (350+ líneas)

### P&L en tiempo real (líneas 240–242)

```typescript
case "SHORT_PUT":
  const obligation = Math.max(strikePrice - currentPrice, 0);
  pnl = ((currentPrice - strikePrice) - position.entryPrice) * quantity * 100;
```

### Max Loss / Max Profit (líneas 259–275)

```typescript
// Max Loss
return (position.strikePrice - premium) * quantity * 100;

// Max Profit
return premium * quantity * 100;
```

### Triggers de alertas

| Tipo | Condición |
|---|---|
| Stop-Loss | Pérdida supera 50% del maxLoss |
| Take-Profit | Ganancia llega al 75% del premium recibido |
| Margin Warning | Pérdida mark-to-market > premium × (1 - threshold) |
| Expiration Warning | 25–30 días antes del vencimiento |

---

## API Endpoints

**Archivo:** `projects/rest-api/inversions_api/src/routes/strategies/optionsRouter.ts`

### POST /strategies/options/calculate

```typescript
// Input:  OptionStrategyContract
// Output: { strategy: OptionStrategyOutput }
// Audit:  action: "options_formula_calculated"
```

Llama `buildOptionStrategyResult(params)`.

### POST /strategies/options/recommend

```typescript
// Input:  OptionStrategyContract + viabilityScore
// Output: { recommendation, alternatives[] }
```

Llama `rankOptionStrategies(params, viabilityScore)`. Retorna Short Put rankeado contra otras 3 estrategias.

### POST /strategies/options/simulate

```typescript
// Input:  { contract: OptionStrategyContract, pricePath: number[] }
// Output: { simulation: SimulationResult }
```

Llama `simulateStrategy(contract, pricePath)`. Genera puntos diarios con greeks.

### POST /ai/fundamental/copilot

```typescript
// Input:  { ticker, question, simulationContext?, conversationHistory? }
// simulationContext.strategy puede ser "Short Put"
// Output: { answer, sourceContext[], disclaimer, reasoningTrace[] }
// Audit:  action: "fundamental_copilot_chat"
```

---

## Integración Chat IA

**Archivo:** `projects/rest-api/inversions_api/src/modules/ai/fundamentalCopilotChat.ts`

### CopilotSimulationContext (líneas 22–39)

```typescript
export interface CopilotSimulationContext {
  strategy: string;                  // "Short Put"
  verdict: "VIABLE" | "MARGINAL" | "NO_VIABLE";
  score: number;                     // 0–100
  projectionFrom: string;
  projectionTo: string;
  initialPrice: number;
  expectedMove?: number;
  strike?: number;
  premium?: number;
  breakeven?: number;
  maxLoss?: number | string;
  maxProfit?: number | string;
  scenarios?: Array<{ label: string; price: number; profitLoss: number }>;
  drivers?: string[];
  changeTriggers?: string[];
  calculationSteps?: string[];
}
```

### Lógica conversacional Short Put (líneas 198–210)

```typescript
} else if (isYesNoShortPut) {
  const recommend = isViable || isNeutral;
  lines.push(recommend
    ? `**Short Put puede tener sentido** si estás dispuesto a comprar ${ticker} al precio de asignación.`
    : `**Short Put tiene riesgo elevado** con ${ticker} en ${result.verdict}.`
  );
  lines.push(`Cobras: $${proj.premium}/acc ($${(proj.premium * 100).toFixed(0)}/contrato)`);
  lines.push(`Breakeven: $${proj.breakeven} | Pérdida máxima: $${proj.maxLoss}`);
  lines.push(recommend
    ? `Si el precio cae bajo $${proj.breakeven}, recibirías las acciones a ese precio efectivo.`
    : `Con fundamentales débiles, recibir las acciones podría no ser deseable.`
  );
}
```

### Árbol de decisión IA

```
viabilityScore >= 65% AND moderadamente bajista
  → Recomienda Short Put
  → Explica flujo de asignación como entrada con descuento
  → Muestra tabla comparativa 4 estrategias

viabilityScore < 65% OR NO_VIABLE
  → Advierte riesgo de asignación con fundamentales débiles
  → Sugiere alternativas menos arriesgadas
```

### Tabla comparativa generada por IA (línea 347)

```
| Short Put  | Cobra $X/contrato | $maxLoss | $breakeven | Vol alta; acepta asignación |
```

---

## UI Components

### SimulationControlPanel.tsx

**Archivo:** `projects/pwa/inversions_app/src/features/dashboard/simulation/SimulationControlPanel.tsx`

```typescript
// Líneas 44–64
const OPTIONS_STRATEGIES: OptionsStrategy[] = [
  "Short Call",
  "Short Put",    // ← aquí
  "Long Call",
  "Long Put"
];
```

Selector pasa estrategia seleccionada → `FundamentalAnalysisModal`.

### FundamentalCopilotPanel.tsx

**Archivo:** `projects/pwa/inversions_app/src/features/ai/FundamentalCopilotPanel.tsx`

- Recibe `simulationContext` con `strategy: "Short Put"`
- Renderiza respuestas del copilot contextualizadas a la estrategia
- Muestra premium, breakeven, maxLoss, escenarios en formato legible

---

## Tests

**Archivo:** `projects/rest-api/inversions_api/tests/unit/strategies/fundamentalOptions.test.ts`

```typescript
// Líneas 46–50
it("calculates a short put profile with finite loss", () => {
  const params = { ...baseParams, optionType: "put", direction: "short" };
  const result = calculateShortPutResult(params);
  expect(result.maxLoss).toBe((params.strikePrice - params.premium) * params.quantity * 100);
});
```

Verifica que la pérdida máxima sea **finita** — diferenciador clave vs Short Call (pérdida potencialmente ilimitada).

---

## Flujo Completo

```
1. UI: Usuario selecciona "Short Put" en SimulationControlPanel
        ↓
2. API: POST /strategies/options/calculate
        → evaluateShortPut() calcula breakeven, maxProfit, maxLoss, margin, probabilidad ITM
        → genera 3 escenarios de precio
        → dispara warnings si probabilidad asignación > 70%
        ↓
3. API: POST /strategies/options/recommend
        → rankOptionStrategies() compara Short Put vs otras 3 estrategias
        → score ajustado por probabilidad OTM
        → recomienda si viabilityScore >= 0.65
        ↓
4. API: POST /strategies/options/simulate
        → simulateStrategy() genera path diario con greeks (theta, gamma, vega)
        → calcula Sharpe, Sortino, Max Drawdown, Breakeven Date
        ↓
5. AlertService: monitoreo de posición abierta (OpenPosition.strategyType = "SHORT_PUT")
        → P&L mark-to-market en tiempo real
        → alertas Stop-Loss (50% maxLoss), Take-Profit (75% premium), Margin Warning, Expiration
        ↓
6. Chat IA: POST /ai/fundamental/copilot con simulationContext.strategy = "Short Put"
        → fundamentalCopilotChat evalúa verdict + score
        → respuesta contextualizada: recomienda o advierte según fundamentales
        → explica asignación, breakeven, flujo de entrada con descuento
        → tabla comparativa de 4 estrategias
        ↓
7. UI: FundamentalCopilotPanel renderiza respuesta con métricas de la estrategia
```

---

## Archivos Clave — Referencia Rápida

| Archivo | Responsabilidad |
|---|---|
| `options/shortPut.ts` | Cálculos core: P&L, theta, evaluación completa |
| `optionsStrategyContract.ts` | Tipos e interfaces de entrada/salida |
| `simulationEngine.ts` | Simulación diaria con greeks y métricas de riesgo |
| `strategyComparator.ts` | Ranking y recomendación vs otras estrategias |
| `alertService.ts` | Monitoreo de posición abierta y alertas |
| `optionsRouter.ts` | Endpoints `/calculate`, `/recommend`, `/simulate` |
| `fundamentalCopilotChat.ts` | Lógica conversacional IA con contexto de estrategia |
| `fundamentalCopilot.ts` | Ruta `/ai/fundamental/copilot` |
| `SimulationControlPanel.tsx` | Selector de estrategia en UI |
| `FundamentalCopilotPanel.tsx` | Renderizado chat IA con contexto Short Put |
| `fundamentalOptions.test.ts` | Tests unitarios de cálculos |
