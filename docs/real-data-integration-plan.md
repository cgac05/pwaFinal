# Audit & Implementation Plan — Real Data Integration
## Watchlist · SuperChart · Option Chain · Strategies

---

## PARTE 1 — AUDIT FINDINGS

### 1. Watchlist

**Componentes encontrados:**
- `src/features/sidebar/views/WatchlistView.tsx` — activo, en sidebar izquierdo
- `src/features/dashboard/WatchlistTree.tsx` — legacy, sin uso actual

**Datos que muestra:** ticker, precio, cambio%, nombre de empresa, categoría

**¿Precios reales, delayed, o mock?**
- Polling cada **30 segundos** a `/api/market/quotes?symbols=...`
- El backend intenta Alpaca paper sandbox (`data.sandbox.alpaca.markets/v2/stocks/bars/latest`)
- Si Alpaca falla: **precios deterministas mockeados** (seed por nombre de ticker)
- En la práctica actual: **mock data** (Alpaca paper sandbox puede no responder)

**Click event → state flow:**
```
WatchlistView click → setSelectedInstrument({ symbol, name, category })
  → Signal Store (signals.ts) → emit()
    → MainDashboard useSignalStore() → selectedSymbol = instrument.symbol ?? "SPY"
      → <SuperChart symbol={selectedSymbol} />
        → useEffect([symbol]) → fetch /api/market-data/ohlc?symbol={symbol}
        → useEffect([symbol]) → fetch /api/signals/confluence?symbol={symbol}
```

**Comunicación con backend:** Fetch API nativo con Bearer JWT. Sin WebSocket.

**¿Alimenta datos al SuperChart?** Sí, indirectamente vía Signal Store → prop `symbol` en MainDashboard.

---

### 2. SuperChart

**NO usa TradingView widget/iframe.** Usa `lightweight-charts` v5.2.0.

**Archivo:** `src/features/dashboard/SuperChart.tsx`

**¿El símbolo es hardcodeado o dinámico?** Completamente dinámico — llega como prop desde MainDashboard.

**¿Se actualiza al hacer click en watchlist?** Sí — dos `useEffect` se disparan:
1. `[symbol]` → reinicializa el chart
2. `[symbol, timeframe, startDate, endDate]` → fetch OHLC → `candleSeriesRef.setData(candles)`

**Fuente de datos OHLC:** `/api/market-data/ohlc` → **datos mock deterministas** (sin API externa real).

---

### 3. Option Chain

**Frontend:** No existe ningún componente. Ni UI, ni tipos, ni fetch.

**Backend:** `yahooOptionsParser.ts` llama a Yahoo v7 options pero solo extrae `volume/openInterest` para señales institucionales. Descarta `bid`, `ask`, `lastPrice`, `impliedVolatility`.

**Campos necesarios para una tabla estándar:**
```typescript
interface OptionChainRow {
  strike: number;
  // Calls
  callBid: number; callAsk: number; callIV: number; callDelta: number;
  callVolume: number; callOpenInterest: number; callLastPrice: number;
  // Puts
  putBid: number; putAsk: number; putIV: number; putDelta: number;
  putVolume: number; putOpenInterest: number; putLastPrice: number;
}
interface OptionChainResponse {
  ticker: string;
  underlyingPrice: number;
  expirationDate: string;
  availableExpirations: string[];
  rows: OptionChainRow[];
}
```

---

### 4. Strategy Calculations

| Estrategia | Archivo | Fórmulas | IV | Greeks |
|---|---|---|---|---|
| protective_put | `protectivePutEngine.ts` | breakEven, maxLoss, payoff 21pts | hardcoded 0.25 | ninguno |
| married_put | mismo archivo | idéntico a protective_put | hardcoded 0.25 | ninguno |
| collar_put | `collarEngine.ts` | maxProfit/Loss dual stop-loss | hardcoded 0.25 | ninguno |
| covered_straddle | `coveredStraddleEngine.ts` | netCredit, unlimited downside | hardcoded 0.25 | ninguno |
| Black-Scholes | `coverageTypes.ts` | A&S 1964 normal CDF, r=0.05 | INPUT | n/a |

**Inputs hardcodeados que necesitan datos reales:**

| Parámetro | Valor actual | Dónde cambia |
|---|---|---|
| IV (volatilidad implícita) | 0.25 | `coverageStrategyAdapter.ts` línea 127 |
| r (tasa libre de riesgo) | 0.05 | `coverageTypes.ts` línea 41 |
| DTE | 90 días | `coverageStrategyAdapter.ts` línea 128 |
| put strike | S × 0.95 | `analyze.ts` buildContracts() |
| call strike | S × 1.05 | `analyze.ts` buildContracts() |
| premium | estimado BS | `coverageStrategyAdapter.ts` líneas 131-132 |

**Greeks:** Ninguno implementado por contrato. Solo multiplicadores de régimen (theta/gamma institucional) en `expirationAnalysisEngine.ts`, no relevantes para estrategias.

---

### 5. Frontend ↔ Backend Communication

**Proxy:** Vite dev server `localhost:5173` → backend `localhost:3000` vía `/api/**`

**Auth:** Bearer JWT desde `localStorage.getItem("inversions.dev.token")` o `VITE_DEV_BEARER_TOKEN`. Dev bypass automático con rol `trader`.

**API keys expuestas en frontend:** Ninguna. Todo pasa por el backend.

**Variables de entorno backend (`.env` actual):**
- `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` / `ALPACA_BASE_URL` ← ya configurado
- `GEMINI_API_KEY` ← ya configurado
- `SUPABASE_*` ← ya configurado
- **Sin key de Tradier ni Polygon**

**APIs externas que llama el backend actualmente:**
- Alpaca paper sandbox → quotes de equities
- Yahoo Finance (v7/v8) → opciones + chart + institucional (bloqueado frecuentemente en WSL)
- Google Gemini → copilot y análisis de volatilidad
- SEC EDGAR + FINRA → posiciones institucionales

---

## PARTE 2 — IMPLEMENTATION PLAN

### 1. API Provider Recomendado

**Recomendación: Tradier para options chain + mantener Alpaca para equity quotes**

| Criterio | Tradier | Polygon.io | Alpaca |
|---|---|---|---|
| Free tier | ✅ Sandbox completo | ⚠️ Limitado | ✅ Ya integrado |
| Option chains | ✅ Full: bid/ask/IV/Greeks/expirations | ✅ Pro (pago) | ⚠️ Parcial |
| Greeks incluidos | ✅ delta, gamma, theta, vega, rho | ✅ Pro | ⚠️ Solo delta |
| IV per strike | ✅ Sí | ✅ Pro | ⚠️ Limitado |
| Facilidad integración | ✅ REST simple | ⚠️ Más complejo | ✅ Ya integrado |
| Para producción | ✅ $10/mes commission-free | ✅ Mejor escala | ✅ Ya integrado |

**Justificación:** Tradier tiene el sandbox gratuito más completo para opciones con IV y Greeks incluidos. Alpaca ya está configurado y funciona para equity quotes — no tiene sentido reemplazarlo. Tradier cubre el gap de options chain sin romper nada existente.

**Endpoints Tradier a usar:**
```
GET https://sandbox.tradier.com/v1/markets/quotes?symbols={ticker}
GET https://sandbox.tradier.com/v1/markets/options/chains?symbol={ticker}&expiration={date}
GET https://sandbox.tradier.com/v1/markets/options/expirations?symbol={ticker}&includeAllRoots=true
GET https://sandbox.tradier.com/v1/markets/history?symbol={ticker}&interval=daily&start={date}
```

---

### 2. Data Flow: Watchlist → SuperChart → Strategy

**Estado actual del flow:**
```
WatchlistView click → Signal Store → MainDashboard → SuperChart(symbol prop)
                                   ↓
                          [NADA pasa a strategies/options]
```

**Flow objetivo:**
```
WatchlistView click → Signal Store → selectedInstrument.symbol
  ├─ MainDashboard → SuperChart(symbol) → fetch OHLC real (Tradier history)
  ├─ MainDashboard → OptionChain(symbol) → fetch chain real (Tradier)
  └─ CoverageStrategyModal → fetch /api/coverage/analyze (usa chain real)
```

**Archivos que cambian para hacer el flow completamente dinámico:**

*Backend:*
- `src/routes/market-data/ohlc.ts` — reemplazar mock con Tradier `/v1/markets/history`
- `src/routes/market/quotes.ts` — mantener Alpaca, agregar Tradier como fallback
- `src/routes/coverage/analyze.ts` — integrar cadena real
- `src/modules/strategies/coverage/coverageStrategyAdapter.ts` — usar real IV/premiums
- **nuevo** `src/routes/options/chain.ts` — endpoint para option chain
- **nuevo** `src/routes/options/expirations.ts` — endpoint para expirations
- **nuevo** `src/modules/market/tradierClient.ts` — cliente Tradier centralizado

*Frontend:*
- `src/features/dashboard/SuperChart.tsx` — fetch OHLC real en lugar de mock
- **nuevo** `src/features/options/OptionChainTable.tsx` — componente cadena de opciones
- **nuevo** `src/services/options/optionChainApi.ts` — service para llamar `/api/options/chain`
- `src/features/coverage/CoverageStrategyModal.tsx` — pasar strikes reales del chain al analyze

---

### 3. Option Chain Component

**Ubicación:** `src/features/options/OptionChainTable.tsx`

**Layout propuesto:**
```
┌─────────────────────────────────────────────────────────┐
│  NVDA  |  Precio actual: $472.00  |  Expiry: [dropdown] │
├──────────────────────┬───────────┬──────────────────────┤
│      CALLS           │  STRIKE   │       PUTS           │
│  Bid  Ask  IV  Δ Vol │           │  Bid  Ask  IV  Δ Vol │
├──────────────────────┼───────────┼──────────────────────┤
│  8.20 8.50 0.32 0.65 │   450  ◀  │ 2.10 2.30 0.28 -0.35 │ ← ITM highlight
│  5.10 5.30 0.28 0.52 │   460     │ 3.40 3.60 0.30 -0.45 │
│  2.90 3.10 0.25 0.38 │   470  ★  │ 5.20 5.50 0.32 -0.55 │ ← precio actual
│  1.20 1.40 0.23 0.25 │   480     │ 8.10 8.40 0.35 -0.65 │
└──────────────────────┴───────────┴──────────────────────┘
```

**Props:**
```typescript
interface OptionChainTableProps {
  symbol: string;          // Del Signal Store (ticker activo)
  onSelectStrike?: (strike: number, type: "call" | "put", premium: number, iv: number) => void;
}
```

**Comportamiento:**
- Recibe `symbol` del Signal Store (actualiza automáticamente al cambiar ticker)
- Dropdown de expiraciones en el header (carga desde `/api/options/expirations?symbol=`)
- Strike en el medio; highlights: verde si ITM call / rojo si ITM put
- Al hacer click en un strike → `onSelectStrike()` → puede pre-llenar modal de coverage
- Usa clases CSS y tokens existentes del design system (`--color-buy`, `--color-sell`, `var(--surface-*)`)
- **No introduce nuevos estilos** — reutiliza patrones de `ConfluenceTableView.tsx` y `CoverageStrategyModal.tsx`

---

### 4. Data Required Per Strategy

| Input | Estrategia | Endpoint Tradier | Campo API |
|---|---|---|---|
| Underlying price | Todas | `/v1/markets/quotes?symbols={ticker}` | `last` |
| Put strike | Todas | `/v1/markets/options/chains` | `strike` (selección usuario o cercano) |
| Call strike | Collar, Straddle | `/v1/markets/options/chains` | `strike` |
| Put premium | Todas | `/v1/markets/options/chains` | `(bid+ask)/2` |
| Call premium | Collar, Straddle | `/v1/markets/options/chains` | `(bid+ask)/2` |
| IV por strike | Todas (BS input) | `/v1/markets/options/chains` | `greeks.smv_vol` o `implied_volatility` |
| Delta | Opcional | `/v1/markets/options/chains` | `greeks.delta` |
| DTE real | Todas | `/v1/markets/options/expirations` | Calcular desde fecha seleccionada |

**Greeks:** Se obtienen de Tradier (incluidos en la respuesta de chains). Las fórmulas de payoff no se tocan — solo los inputs.

---

### 5. Nuevos Backend Endpoints

| Método | Path | Descripción | Fuente |
|---|---|---|---|
| GET | `/api/options/chain?symbol=NVDA&expiration=2025-06-20` | Option chain completo (calls + puts + Greeks) | Tradier `/v1/markets/options/chains` |
| GET | `/api/options/expirations?symbol=NVDA` | Fechas de expiración disponibles | Tradier `/v1/markets/options/expirations` |
| GET | `/api/market-data/ohlc?symbol=NVDA&timeframe=1d` | OHLC real (reemplazar mock) | Tradier `/v1/markets/history` |
| POST | `/api/coverage/analyze` | Ya existe — modificar para usar chain real | interno |

**Todos los llamados a Tradier se hacen desde el backend. El frontend nunca toca Tradier directamente.**

**Nuevo módulo centralizado:** `src/modules/market/tradierClient.ts`
```typescript
// Encapsula base URL, headers, timeout, y retry logic para Tradier
export async function tradierGet<T>(path: string, params?: Record<string, string>): Promise<T>
```

---

### 6. Environment Variables

**Agregar al `.env` del backend:**
```env
# Tradier (options chain + market data)
TRADIER_API_KEY=tu_sandbox_token_aqui
TRADIER_BASE_URL=https://sandbox.tradier.com/v1
# Para producción: https://api.tradier.com/v1
```

**Frontend `.env` (si no existe, crear):**
```env
VITE_DEV_BEARER_TOKEN=dev-token-local
```

**No se mueve ninguna API key al frontend.** Todo permanece en backend.

---

### 7. Data Mapping — Tradier → Interfaces Existentes

**Option Chain (Tradier → OptionChainRow):**
```typescript
// Tradier response: option.greeks.delta, option.greeks.smv_vol, option.bid, option.ask
const row: OptionChainRow = {
  strike: option.strike,
  callBid: call.bid, callAsk: call.ask,
  callIV: call.greeks?.smv_vol ?? call.implied_volatility ?? 0,
  callDelta: call.greeks?.delta ?? 0,
  callVolume: call.volume, callOpenInterest: call.open_interest,
  // ... puts igual
};
```

**OHLC (Tradier → Candle existente en SuperChart):**
```typescript
// Tradier: { date, open, high, low, close, volume }
const candle: OHLC = {
  time: Math.floor(new Date(day.date).getTime() / 1000),  // unix timestamp
  open: day.open, high: day.high, low: day.low, close: day.close, volume: day.volume
};
```

**Market Quotes (Tradier → MarketQuote existente):**
```typescript
// Tradier: { last, change, change_percentage }
const quote: MarketQuote = {
  symbol, price: q.last,
  change: q.change, changePercent: q.change_percentage,
  timestamp: new Date().toISOString()
};
```

**Minimize breaking changes:** Los tipos `OHLC`, `MarketQuote`, y `CoverageStrategyResult` no se modifican.

---

### 8. Error Handling & Loading States

**Backend (nuevas rutas):**
- `tradierClient.ts`: AbortController timeout 5s, retry 1x en 429/5xx
- `/api/options/chain`: 502 si Tradier falla, 400 si faltan params
- `/api/options/expirations`: 502 si Tradier falla
- `/api/market-data/ohlc`: fallback a datos mock si Tradier falla (no romper SuperChart)

**Frontend:**
- `OptionChainTable.tsx`: skeleton loader mientras carga, mensaje vacío si 502
- `SuperChart.tsx`: ya tiene loading/error state — extender para mostrar "datos reales" vs "datos demo"
- `CoverageStrategyModal.tsx`: spinner en campos de strike mientras carga chain
- `marketApi.ts`: ya tiene retry + stale-while-revalidate — no cambiar

---

### 9. Estimated Effort

| Área | Complejidad | Razón |
|---|---|---|
| Watchlist (prices reales) | **Baja** | Alpaca ya integrado; solo activar modo real |
| SuperChart (OHLC real) | **Media** | Reemplazar mock con Tradier history; mapeo de campos |
| Option Chain component | **Alta** | Componente nuevo de cero, UI compleja, integración chain |
| Strategies (inputs reales) | **Media** | IV + premium del chain; fórmulas no se tocan |
| Backend nuevas rutas | **Media** | `tradierClient` + 2 nuevas rutas + modificar ohlc.ts |
| Env + configuración | **Baja** | Solo agregar TRADIER_API_KEY al .env |
| Data mapping | **Baja** | Interfaces existentes son compatibles |
| Error handling | **Baja** | Patrones ya establecidos en el codebase |

**Orden de implementación recomendado:**
1. `tradierClient.ts` (base para todo lo demás)
2. OHLC real en SuperChart (impacto visual inmediato)
3. Quotes reales en Watchlist
4. Option Chain endpoint + componente
5. Coverage analyze con chain real + IV real

---

## Archivos críticos de referencia

| Archivo | Propósito en el plan |
|---|---|
| `src/features/sidebar/views/WatchlistView.tsx` | Click handler → Signal Store |
| `src/features/dashboard/SuperChart.tsx` | Fetch OHLC → reemplazar con Tradier |
| `src/features/dashboard/MainDashboard.tsx` | Orquestador; pasar symbol a OptionChain |
| `src/store/signals.ts` | Global state; `selectedInstrument` |
| `src/services/signals/marketApi.ts` | useWatchlistPrices hook; 30s polling |
| `src/routes/market-data/ohlc.ts` | Mock OHLC → reemplazar |
| `src/routes/market/quotes.ts` | Alpaca quotes → agregar Tradier fallback |
| `src/routes/coverage/analyze.ts` | Inyectar chain real |
| `src/modules/strategies/coverage/coverageStrategyAdapter.ts` | IV + premium reales |
