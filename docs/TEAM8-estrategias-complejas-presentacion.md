# TEAM-08: Estrategias Complejas de Opciones (Dashboard)

## Documento de Arquitectura para Presentación

---

# 📋 Índice

1. [¿Qué es TEAM-08?](#1-qu%C3%A9-es-team-08)
2. [Estrategias Soportadas](#2-estrategias-soportadas)
3. [Parámetros de Configuración](#3-par%C3%A1metros-de-configuraci%C3%B3n)
4. [Arquitectura General](#4-arquitectura-general)
5. [APIs Internas (Frontend ↔ Backend)](#5-apis-internas-frontend--backend)
6. [APIs Externas (Backend ↔ Alpaca)](#6-apis-externas-backend--alpaca)
7. [Flujo de Trabajo Completo](#7-flujo-de-trabajo-completo)
8. [Motores Internos del Backend](#8-motores-internos-del-backend)
9. [Estructura de la Respuesta](#9-estructura-de-la-respuesta)
10. [Componentes del Dashboard](#10-componentes-del-dashboard)
11. [Mapa de Archivos](#11-mapa-de-archivos)
12. [Código Muerto Identificado](#12-c%C3%B3digo-muerto-identificado)

---

# 1. ¿Qué es TEAM-08?

TEAM-08 es el equipo responsable de construir y ejecutar **estrategias complejas de opciones multi-pata** dentro de la plataforma de inversiones. Su sistema permite:

- ✅ **Obtener datos reales** del mercado de opciones desde **Alpaca Markets** (Paper Trading)
- ✅ **Configurar estrategias** de 3 o 4 patas (Iron Condor, Iron Butterfly, Butterfly Spread, Condor)
- ✅ **Simular el comportamiento** de la estrategia mediante **Monte Carlo** (10,000 iteraciones)
- ✅ **Evaluar el riesgo** contra el portafolio del usuario
- ✅ **Visualizar** curva de payoff, primas, puntaje de riesgo, y probabilidad de éxito
- ✅ **Cargar saldo real** de Alpaca para decisiones informadas

** stack tecnológico:**

| Capa | Tecnología |
|------|-----------|
| Frontend | React + TypeScript + CSS Variables (Revolut Design System) |
| Backend | Node.js + Express + TypeScript |
| Broker | Alpaca Markets API (Paper Trading) |
| Autenticación | Bearer Token (localStorage o `VITE_DEV_BEARER_TOKEN`) |

---

# 2. Estrategias Soportadas

El sistema soporta **4 estrategias complejas de opciones**, construidas dinámicamente desde la options chain real de Alpaca:

| Estrategia | Patas | Descripción | Tipo Neto |
|-----------|-------|-------------|-----------|
| **Iron Condor** | 4 | 2 puts (long + short) + 2 calls (short + long). Gana con baja volatilidad / mercado lateral. | Crédito |
| **Iron Butterfly** | 4 | 2 puts (long + short) + 2 calls (short + long). Similar al Condor pero con strikes concéntricos (ATM). | Crédito |
| **Butterfly Spread** | 3 | 3 patas del mismo tipo (long + short 2x + long). Apuesta a que el precio expire cerca del strike medio. | Débito |
| **Condor** | 4 | 4 patas del mismo tipo (long + short + short + long). Más rango de ganancia que el Butterfly. | Débito |

## 2.1 Estructura de Patas por Estrategia

### Iron Condor / Iron Butterfly
```
Pata 1: PUT  LONG  (strike inferior — protección)
Pata 2: PUT  SHORT (strike medio inferior — prima recibida)
Pata 3: CALL SHORT (strike medio superior — prima recibida)
Pata 4: CALL LONG  (strike superior — protección)
```

### Butterfly Spread
```
Pata 1: CALL LONG  (strike inferior)
Pata 2: CALL SHORT (strike medio ×2)
Pata 3: CALL LONG  (strike superior)
```

### Condor
```
Pata 1: CALL LONG  (strike inferior)
Pata 2: CALL SHORT (strike medio-bajo)
Pata 3: CALL SHORT (strike medio-alto)
Pata 4: CALL LONG  (strike superior)
```

---

# 3. Parámetros de Configuración

Cada estrategia requiere los siguientes parámetros para ejecutarse:

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `strategy_type` | `string` | `iron_condor` | Tipo de estrategia: `iron_condor`, `iron_butterfly`, `butterfly_spread`, `condor` |
| `ticker` | `string` | — | Símbolo del subyacente (ej: SPY, AAPL, MSFT) |
| `expiracion` | `string` (YYYY-MM-DD) | — | Fecha de vencimiento de las opciones |
| `strikes` | `StrikeSelection[]` | — | Array de patas con strike, tipo (call/put) y posición (long/short) |
| `contratos` | `number` | `1` | Número de contratos por pata |
| `tipo_ala` | `"short" | "wide" | "broken"` | `"short"` | Distancia relativa entre strikes |
| `tolerancia_riesgo` | `"bajo" | "medio" | "alto"` | `"medio"` | Perfil de riesgo del usuario |
| `estilo_opcion` | `"americana" | "europea"` | `"americana"` | Estilo de ejercicio de la opción |
| `portfolio.valor_portafolio_usd` | `number` | — | Valor total del portafolio del usuario |
| `portfolio.poder_compra_usd` | `number` | — | Poder de compra disponible |
| `portfolio.margen_actual_usd` | `number` | — | Margen actual utilizado |
| `portfolio.posiciones_actuales` | `number` | — | Número de posiciones actuales |

## 3.1 Tipo de Ala (`tipo_ala`)

| Valor | Significado | Efecto |
|-------|-------------|--------|
| `short` | Alas equidistantes estándar | Spread equilibrado entre strikes |
| `wide` | Alas más anchas | Mayor rango de ganancia pero menor prima neta |
| `broken` | Alas asimétricas | Un lado más ancho que el otro (sesgo direccional) |

## 3.2 Offsets de Strikes por Defecto

Cuando se presiona "Ajustar", el sistema calcula el strike base desde Alpaca (midpoint entre `call_strike_min` y `call_strike_max`) y aplica estos offsets:

| Estrategia | Offsets |
|-----------|---------|
| Iron Condor | `[-20, 0, 40, 60]` |
| Iron Butterfly | `[-40, 0, 0, 40]` |
| Butterfly Spread | `[-20, 20, 60]` |
| Condor | `[-60, -20, 20, 60]` |

---

# 4. Arquitectura General

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                                 │
│                                                                          │
│  ┌──────────────────────┐   ┌──────────────────────┐                     │
│  │  EstrategiasPanel     │   │  SimulationControl   │                     │
│  │  (Panel inline)       │   │  Panel               │                     │
│  │                       │   │                      │                     │
│  │  ComplexStrategy      │   │  (Abre modal)        │                     │
│  │  ParamsModal          │   │                      │                     │
│  └──────────┬────────────┘   └──────────┬───────────┘                     │
│             │                           │                                 │
│             └──────────┬────────────────┘                                 │
│                        │                                                  │
│                ┌───────▼────────┐                                         │
│                │  strategyApi   │  ← ARCHIVO CENTRAL: define las APIs     │
│                │  .ts           │    (puente único frontend ↔ backend)    │
│                └───────┬────────┘                                         │
│                        │                                                  │
│            HTTP fetch("/api/strategies/complex/...")                      │
└────────────────────────┼──────────────────────────────────────────────────┘
                         │
┌────────────────────────┼──────────────────────────────────────────────────┐
│                        ▼             BACKEND (Express)                     │
│                                                                           │
│   ┌─────────────────────────────────────────────────────────────┐        │
│   │                    index.ts                                  │        │
│   │  app.use("/api/strategies/complex", optionsChainRouter)      │        │
│   │  app.use("/api/strategies/complex", fromChainRouter)         │        │
│   │  app.use("/api/strategies/complex", alpacaExecutionRouter)   │        │
│   └────────────────────┬────────────────────────────────────────┘        │
│                        │                                                  │
│          ┌─────────────┼──────────────────┐                              │
│          ▼             ▼                  ▼                               │
│   ┌──────────┐  ┌──────────┐  ┌────────────────────┐                     │
│   │options   │  │fromChain │  │alpacaExecution     │                     │
│   │Chain.ts   │  │.ts       │  │Router.ts           │                     │
│   │          │  │          │  │                    │                     │
│   │GET /exp  │  │POST      │  │GET /account        │                     │
│   │GET /opt  │  │/from-    │  │POST/execute-order   │                     │
│   │-chain    │  │chain     │  │etc. (no usados)     │                     │
│   └────┬─────┘  └────┬─────┘  └────────────────────┘                     │
│        │             │                                                     │
│        │      ┌──────▼──────────┐                                          │
│        │      │ strategyFrom    │                                          │
│        │      │ ChainHandler.ts │  ← ORQUESTADOR                           │
│        │      └──────┬──────────┘                                          │
│        │             │                                                      │
│  ┌─────▼─────────────┼───────────────────────────────────┐                │
│  │                   ▼                                   │                │
│  │  ┌──────────────────────────────────────────┐        │                │
│  │  │      alpacaOptionsService.ts              │        │                │
│  │  │  GET /v2/options/contracts (Alpaca)       │        │                │
│  │  │  GET /v1beta1/options/snapshots (Alpaca)  │        │                │
│  │  └──────────────────────────────────────────┘        │                │
│  │                   │                                   │                │
│  │                   ▼                                   │                │
│  │  ┌──────────────────────────────────────────┐        │                │
│  │  │         MOTORES INTERNOS                  │        │                │
│  │  │                                          │        │                │
│  │  │  IronCondorEngine     → calculateProfile │        │                │
│  │  │  IronButterflyEngine  → calculateProfile │        │                │
│  │  │  ButterflySpreadEngine→ calculateProfile │        │                │
│  │  │  CondorEngine         → calculateProfile │        │                │
│  │  │                                          │        │                │
│  │  │  ComplexSimulationEngine  → Monte Carlo  │        │                │
│  │  │  ComplexRiskEngine       → evaluación    │        │                │
│  │  │  ComplexReportEngine     → reporte       │        │                │
│  │  └──────────────────────────────────────────┘        │                │
│  └──────────────────────────────────────────────────────┘                │
│                        │                                                  │
│                        ▼                                                  │
│              JSON Response → Frontend                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

# 5. APIs Internas (Frontend ↔ Backend)

Son las que comunican el frontend con el backend de la propia aplicación.

## 5.1 Definiciones en `strategyApi.ts`

**Archivo:** `projects/pwa/inversions_app/src/services/strategies/strategyApi.ts`

**Base URL:** `/api/strategies/complex`

### Función: `fetchExpirations()`

| Propiedad | Valor |
|-----------|-------|
| **Método HTTP** | `GET` |
| **Endpoint** | `/api/strategies/complex/expirations` |
| **Parámetros** | `ticker` (req), `rangeMonths` (req: 1, 2, 6, 12) |
| **Respuesta** | `ExpirationsResponse: { ticker, rangeMonths, expiraciones: string[] }` |
| **¿Quién la llama?** | `ComplexStrategyParamsModal.tsx` |
| **¿Cuándo?** | Al abrir el modal, al cambiar el ticker o el rango de meses |

**Ejemplo de llamada:**
```
GET /api/strategies/complex/expirations?ticker=SPY&rangeMonths=6

Respuesta:
{
  "ticker": "SPY",
  "rangeMonths": 6,
  "expiraciones": ["2026-06-19", "2026-07-17", "2026-08-21", ...]
}
```

---

### Función: `fetchOptionsChain()`

| Propiedad | Valor |
|-----------|-------|
| **Método HTTP** | `GET` |
| **Endpoint** | `/api/strategies/complex/options-chain` |
| **Parámetros** | `ticker` (req), `expiration` (opc, YYYY-MM-DD) |
| **Respuesta** | `OptionsChainResponse` con strikes, bid/ask, griegas |
| **¿Quién la llama?** | `ComplexStrategyParamsModal.tsx` · `EstrategiasPanel.tsx` |
| **¿Cuándo?** | Al abrir modal, al seleccionar fecha, al cambiar ticker (onBlur) |

**Ejemplo de llamada:**
```
GET /api/strategies/complex/options-chain?ticker=SPY&expiration=2026-06-19

Respuesta (resumida):
{
  "ticker": "SPY",
  "expiracion": "2026-06-19",
  "total_contratos": 480,
  "total_calls": 240,
  "total_puts": 240,
  "resumen": {
    "call_strike_min": 510,
    "call_strike_max": 650,
    "put_strike_min": 480,
    "put_strike_max": 620
  },
  "grouped": {
    "calls": [
      {
        "symbol": "SPY260619C00540000",
        "strike": 540,
        "tipo": "call",
        "expiracion": "2026-06-19",
        "bid": 12.45,
        "ask": 12.60,
        "mid": 12.525,
        "estilo": "american",
        "tradable": true,
        "greeks": { "delta": 0.62, "gamma": 0.012, "theta": -0.08, "vega": 0.35, "implied_volatility": 0.22 }
      },
      ...
    ],
    "puts": [...]
  }
}
```

---

### Función: `fetchAccountBalance()`

| Propiedad | Valor |
|-----------|-------|
| **Método HTTP** | `GET` |
| **Endpoint** | `/api/strategies/complex/account` |
| **Parámetros** | Ninguno (usa auth headers) |
| **Respuesta** | `AlpacaAccountBalance: { cash, equity, buyingPower, broker, mode }` |
| **¿Quién la llama?** | `EstrategiasPanel.tsx` |
| **¿Cuándo?** | Click en botón "Cargar saldo real de Alpaca" |

**Ejemplo de llamada:**
```
GET /api/strategies/complex/account

Respuesta:
{
  "success": true,
  "cash": 25000.00,
  "equity": 50000.00,
  "buyingPower": 75000.00,
  "broker": "ALPACA",
  "mode": "paper"
}
```

---

### Función: `executeStrategy()`

| Propiedad | Valor |
|-----------|-------|
| **Método HTTP** | `POST` |
| **Endpoint** | `/api/strategies/complex/from-chain` |
| **Body** | `FromChainRequest` (todos los parámetros de la estrategia) |
| **Respuesta** | `FromChainResponse` (profile, simulation, risk, report, summary) |
| **¿Quién la llama?** | `EstrategiasPanel.tsx` · `SimulationControlPanel.tsx` |
| **¿Cuándo?** | Click en "Ejecutar Estrategia con Datos Reales" o "Ejecutar Simulación" |

**Ejemplo de body:**
```json
POST /api/strategies/complex/from-chain
{
  "strategy_type": "iron_condor",
  "ticker": "SPY",
  "expiracion": "2026-06-19",
  "strikes": [
    { "strike": 540, "tipo": "put", "posicion": "long" },
    { "strike": 560, "tipo": "put", "posicion": "short" },
    { "strike": 600, "tipo": "call", "posicion": "short" },
    { "strike": 620, "tipo": "call", "posicion": "long" }
  ],
  "contratos": 1,
  "tipo_ala": "short",
  "tolerancia_riesgo": "medio",
  "estilo_opcion": "americana",
  "portfolio": {
    "valor_portafolio_usd": 50000,
    "poder_compra_usd": 25000,
    "margen_actual_usd": 0,
    "posiciones_actuales": 0
  }
}
```

---

# 6. APIs Externas (Backend ↔ Alpaca)

Son las llamadas HTTP reales que salen del backend hacia **Alpaca Markets** (única fuente de datos reales).

## 6.1 `alpacaOptionsService.ts`

**Archivo:** `projects/rest-api/inversions_api/src/modules/strategies/complex/alpacaOptionsService.ts`

Requiere variables de entorno:
- `ALPACA_API_KEY`
- `ALPACA_SECRET_KEY`

### Endpoint: GET /v2/options/contracts

**Propósito:** Obtener los contratos de opciones disponibles (símbolo, strike, tipo, expiración)

```
GET https://paper-api.alpaca.markets/v2/options/contracts
    ?underlying_symbols=SPY
    &status=active
    &limit=250
    &expiration_date_gte=2026-06-19
    &expiration_date_lte=2026-06-19

Headers:
  APCA-API-KEY-ID: <api_key>
  APCA-API-SECRET-KEY: <api_secret>
```

### Endpoint: GET /v1beta1/options/snapshots

**Propósito:** Obtener precios en tiempo real (bid/ask) y griegas (delta, gamma, theta, vega, IV)

```
GET https://data.alpaca.markets/v1beta1/options/snapshots
    ?symbols=SPY260619C00540000,SPY260619P00540000,...

Headers:
  APCA-API-KEY-ID: <api_key>
  APCA-API-SECRET-KEY: <api_secret>
```

### Flujo de Alpaca Options Service

```
strategyFromChainHandler.ts
       │
       ▼
alpacaOptionsService.ts
       │
       ├── 1. fetchContracts(ticker, expiration)
       │      → GET /v2/options/contracts?underlying_symbols=SPY&...
       │      ← Lista de contratos (strike, tipo, símbolo)
       │
       ├── 2. fetchSnapshots(symbols[])
       │      → GET /v1beta1/options/snapshots?symbols=SPY260619C...
       │      ← Bid/Ask/Griegas por símbolo
       │
       └── 3. Merge: contract + snapshot → OptionChainEntry
              → strike, tipo, bid, ask, mid, greeks
```

**Límites de Alpaca:**
- Snapshots: máximo 100 símbolos por request (el código hace batch automático)
- Rate limit: estándar de Alpaca (depende del plan)

---

# 7. Flujo de Trabajo Completo

## 7.1 Flujo desde `EstrategiasPanel.tsx` (Panel inline)

```
1. USUARIO
   ├── Escribe ticker (ej: "SPY") en el campo Ticker
   ├── Sale del campo (onBlur)
   │
   ▼
2. EstrategiasPanel.tsx
   ├── handleAutoAdjustStrikes()
   │     → fetchOptionsChain("SPY")
   │     → Calcula strike base = midpoint(call_strike_min, call_strike_max)
   │     → Aplica offsets según estrategia seleccionada
   │     → Actualiza los strikes en el formulario
   │
   ├── (Opcional) Click "Cargar saldo real de Alpaca"
   │     → fetchAccountBalance()
   │     → Actualiza portfolio_valor y portfolio_poder
   │
   ├── Usuario ajusta strikes, contratos, tipo_ala, etc.
   │
   ├── Click "Ejecutar Estrategia con Datos Reales"
   │
   ▼
3. strategyApi.ts → executeStrategy(payload)
   │
   ▼
4. POST /api/strategies/complex/from-chain (Backend)
   │
   ▼
5. fromChain.ts
   ├── Valida: strategy_type, ticker, strikes, portfolio, etc.
   │
   ▼
6. strategyFromChainHandler.ts (orquestador)
   ├── Step 1: alpacaOptionsService.getOptionsChain(ticker, expiración)
   │     → Fetch contratos + snapshots de Alpaca
   │
   ├── Step 2: Match strikes solicitados con contratos reales
   │     → Si algún strike no existe → error 400 con strikes disponibles
   │
   ├── Step 3: Calcular DTE (días hasta vencimiento)
   │
   ├── Step 4: Construir ComplexStrategyConfig con primas reales
   │     → Prima = mid price (o ask si long, bid si short)
   │
   ├── Step 5: Ejecutar motores:
   │     │
   │     ├── IronCondorEngine.calculateProfile(config)
   │     │     → Valida configuración
   │     │     → Calcula payoff curve (150 puntos)
   │     │     → Calcula crédito neto, break-evens, pérdida/gánancia máxima
   │     │     → Curvas temporales (theta decay)
   │     │
   │     ├── ComplexSimulationEngine.simulate(config, profile)
   │     │     → Monte Carlo: 10,000 iteraciones
   │     │     → Precios simulados con distribución normal (Box-Muller)
   │     │     → Costos: slippage, comisiones, spread
   │     │     → Distribución P&L, percentiles, Sharpe ratio
   │     │
   │     ├── ComplexRiskEngine.evaluate(config, profile, simulation, portfolio)
   │     │     → 10 controles: kill-switch, pérdida máxima, contratos,
   │     │       riesgo portafolio, poder compra, probabilidad éxito,
   │     │       DTE mínimo, asignación temprana, drawdown, Sharpe
   │     │     → Puntaje de riesgo (0-100)
   │     │     → Eventos: blocking, critical, warning, info
   │     │
   │     └── ComplexReportEngine.generateReport(config, profile, simulation, risk)
   │           → Reporte estructurado con metadatos
   │           → Curva de payoff anotada con break-evens
   │           → Heatmap P&L (precio × tiempo)
   │
   └── Step 6: Construir respuesta JSON
         ├── premiums_used (primas reales de Alpaca)
         ├── profile (curva de payoff, griegas)
         ├── simulation (Monte Carlo, probabilidad éxito)
         ├── risk (eventos, puntaje, acción recomendada)
         ├── report (reporte completo)
         └── summary (resumen ejecutivo)
   │
   ▼
7. Frontend recibe respuesta
   ├── Renderiza: Summary Cards (estrategia, ticker, vencimiento, ganancia máx, pérdida máx, DTE)
   ├── Renderiza: Payoff Chart (curva SVG)
   ├── Renderiza: Tabla de primas (strike, tipo, posición, prima)
   ├── Renderiza: Evaluación de riesgo (puntaje, aceptable, eventos)
   └── Renderiza: Simulación Monte Carlo (probabilidad éxito, Sharpe, drawdown)
```

## 7.2 Flujo desde `SimulationControlPanel.tsx`

```
1. USUARIO
   ├── Selecciona estrategia tipo "IRON_CONDOR" del dropdown
   │
   ▼
2. SimulationControlPanel.tsx
   ├── handleEstrategiaChange("IRON_CONDOR")
   │     → isComplexStrategy("IRON_CONDOR") = true
   │     → Abre ComplexStrategyParamsModal
   │
   ▼
3. ComplexStrategyParamsModal.tsx
   ├── Al abrirse:
   │     → fetchExpirations(ticker, rangoMeses) → llena dropdown fechas
   │     → fetchOptionsChain(ticker) → auto-ajusta strikes
   │
   ├── Usuario configura: fecha, strikes, contratos, tipo_ala, portfolio
   ├── Click "Guardar Parámetros" → onConfirm(form, strategy)
   │     → Guarda complexParams en SimulationControlPanel
   │     → Cierra el modal
   │
   ▼
4. SimulationControlPanel.tsx
   ├── Usuario hace otros ajustes (temporalidad, cores, indicadores)
   ├── Click "Ejecutar Simulación"
   │
   ▼
5. Se ejecuta en paralelo:
   ├── runSimulation(simPayload) → simulación general de la plataforma
   └── executeStrategy(complexPayload) → POST /from-chain (nuestra estrategia)
   │
   ▼
6. onComplexResult?.(complexRes, estrategia, temporalidad)
   → Se envía el resultado al padre (MainDashboard)
```

## 7.3 Validaciones del Backend

### Errores HTTP que puede devolver `POST /from-chain`

| Código | Causa | Respuesta |
|--------|-------|-----------|
| `400` | `strategy_type` inválido o faltante | `{ error: "...", opciones: [...] }` |
| `400` | `ticker` faltante | `{ error: "ticker es requerido" }` |
| `400` | `strikes` vacío | `{ error: "Se requieren strikes" }` |
| `400` | Fecha mal formateada | `{ error: "Formato de fecha invalido" }` |
| `400` | `portfolio` faltante | `{ error: "portfolio es requerido" }` |
| `400` | Strikes no encontrados en Alpaca | `{ error, unmatched, available_summary }` |
| `404` | No hay opciones para el ticker/fecha | `{ error, ticker, expiracion }` |
| `502` | Error de autenticación con Alpaca | `{ error, detalle }` |
| `500` | Error interno del servidor | `{ error, detalle }` |

---

# 8. Motores Internos del Backend

## 8.1 IronCondorEngine (`ironCondorEngine.ts`)

**Propósito:** Valida y calcula el perfil de un Iron Condor.

**Validaciones:**
- Exactamente 4 patas (2 puts + 2 calls)
- Puts: strike inferior = long, strike superior = short
- Calls: strike inferior = short, strike superior = long
- Si `tipo_ala = "wide"`: verifica que las alas sean significativamente más anchas

**Cálculos:**
- Payoff curve: 150 puntos desde precio mínimo hasta máximo
- Net credit: suma de primas (short = +, long = -) × contratos × 100
- Break-even points: interpolación lineal donde P&L cruza cero
- Máx pérdida / Máx ganancia desde la curva
- Ratio riesgo/beneficio
- Curvas temporales: T-0, T-66%, T-33% (theta decay simplificado)

## 8.2 ComplexSimulationEngine (`complexSimulationEngine.ts`)

**Propósito:** Ejecuta simulaciones para evaluar el comportamiento probabilístico de la estrategia.

**Tipos de simulación:**

| Tipo | Descripción | Iteraciones |
|------|-------------|-------------|
| `monte_carlo` | Precios simulados con distribución normal (Box-Muller) | 10,000 (default) |
| `deterministico` | 9 shocks de precio × 5 shocks de IV = 45 escenarios | 45 |
| `backtesting` | Precios históricos reales (si se proporcionan) | Variable |

**Parámetros de simulación default:**

| Parámetro | Valor |
|-----------|-------|
| iteraciones | 10,000 |
| shock_precio | ±20% |
| shock_iv | ±10% |
| intervalo_confianza | 95% |
| slippage | 0.1% |
| comisión por contrato | $0.65 |
| comisión base | $1.00 |
| spread | 2% |

**Salida de la simulación:**
- Distribución P&L: media, mediana, desviación estándar, percentiles 5, 25, 75, 95
- Probabilidad de éxito (P&L > 0)
- Rendimiento esperado
- Drawdown máximo
- Sharpe ratio
- 3 escenarios: mejor caso, peor caso, caso base
- Costos desglosados: slippage, comisiones, spread

## 8.3 ComplexRiskEngine (`complexRiskEngine.ts`)

**Propósito:** Evalúa el riesgo de la estrategia contra el portafolio del usuario.

**10 controles de riesgo:**

| # | Categoría | ¿Qué evalúa? | ¿Bloquea? |
|---|-----------|-------------|-----------|
| 1 | `KILL_SWITCH` | Si el ticker tiene kill-switch activo | ✅ Sí |
| 2 | `PERDIDA_MAXIMA` | Pérdida máxima vs límite según perfil | ✅ Sí |
| 3 | `CONTRATOS_MAXIMOS` | Total contratos vs límite | ✅ Sí |
| 4 | `RIESGO_PORTAFOLIO` | % del portafolio en riesgo | ✅ Sí |
| 5 | `PODER_COMPRA` | Pérdida potencial vs poder de compra | ✅ Sí |
| 6 | `PROBABILIDAD_EXITO` | Probabilidad < 20% | ❌ No |
| 7 | `DTE_MINIMO` | Días hasta vencimiento bajo mínimo | ⚠️ Depende |
| 8 | `ASIGNACION_TEMPRANA` | Opciones americanas ITM en short | ⚠️ Depende |
| 9 | `DRAWDOWN` | Drawdown simulado vs límite | ⚠️ Depende |
| 10 | `SHARPE_NEGATIVO` | Sharpe ratio negativo | ❌ No |

**Perfiles de riesgo y límites:**

| Perfil | Pérdida Máx | Margen Máx | Contratos | % Portafolio | Stop-loss | DTE Mín |
|--------|------------|-----------|-----------|-------------|-----------|---------|
| **Conservador** | $500 | $2,000 | 5 | 2% | ✅ Auto | 21 días |
| **Moderado** | $2,000 | $10,000 | 20 | 5% | ✅ Auto | 14 días |
| **Agresivo** | $10,000 | $50,000 | 100 | 15% | ❌ Manual | 7 días |

**Puntaje de riesgo (0-100):**
- Cada evento tiene un peso: info=2, warning=10, critical=25, blocking=40
- Se suman los pesos de todos los eventos detectados
- Máximo 100

## 8.4 ComplexReportEngine (`complexReportEngine.ts`)

**Propósito:** Genera reportes estructurados consumibles por cualquier UI.

**Componentes del reporte:**
- **Metadata:** ticker, tipo estrategia, fecha análisis, tiempo de cálculo
- **Perfil:** crédito neto, pérdida/gánancia máxima, ratio, break-evens
- **Payoff anotado:** curva con marcadores de break-even, pérdida/gánancia máxima, zonas de ganancia/pérdida
- **Heatmap P&L:** matriz precio × tiempo (8 DTEs × 20 precios = 160 celdas)
- **Simulación:** probabilidad, rendimiento, drawdown, Sharpe, distribución
- **Riesgo:** puntaje, aceptable, eventos, resumen, acción recomendada

---

# 9. Estructura de la Respuesta

## `FromChainResponse` (POST /from-chain)

```typescript
{
  strategy_type: string;         // "iron_condor"
  ticker: string;                // "SPY"
  expiracion: string;            // "2026-06-19"
  
  premiums_used: PremiumUsed[];  // Primas reales de Alpaca
  // [{
  //   strike: 540,
  //   tipo: "put",
  //   posicion: "long",
  //   prima: 2.35,          ← Mid price real de Alpaca
  //   bid: 2.30,
  //   ask: 2.40,
  //   volatilidad_implicita: 0.22,
  //   symbol: "SPY260619P00540000"
  // }, ...]

  profile: Record<string, unknown>;  // StrategyProfile (internamente tipado)
  // {
  //   credito_neto: 125.00,
  //   tipo_neto: "credito",
  //   break_even_points: [545.25, 614.75],
  //   perdida_maxima: 874.75,
  //   ganancia_maxima: 125.00,
  //   payoff_curve: [{ precio_subyacente, pnl }, ...],
  //   payoff_vencimiento: [...],
  //   payoff_temporal: [{ precio_subyacente, pnl, dias_restantes }, ...],
  //   ratio_riesgo_beneficio: 0.14
  // }

  simulation: Record<string, unknown>;  // SimulationResult
  // {
  //   tipo: "monte_carlo",
  //   total_iteraciones: 10000,
  //   probabilidad_exito: 72.5,
  //   rendimiento_esperado: 85.20,
  //   drawdown_maximo: 1200.00,
  //   ratio_sharpe: 0.45,
  //   distribucion_pnl: {
  //     media: 85.20, mediana: 92.00, desviacion_estandar: 450.00,
  //     percentil_5: -520.00, percentil_25: -180.00,
  //     percentil_75: 125.00, percentil_95: 125.00,
  //     maximo: 125.00, minimo: -3200.00
  //   },
  //   escenarios: { mejor_caso, peor_caso, caso_base },
  //   costos_totales: 15.30,
  //   costos_detalle: { slippage_total, comisiones_totales, spread_total }
  // }

  risk: Record<string, unknown>;  // RiskAssessment
  // {
  //   riesgo_aceptable: true,
  //   puntaje_riesgo: 25,
  //   eventos: [{ id, severidad, categoria, mensaje, bloquea, ... }, ...],
  //   resumen: "RIESGO MODERADO: ...",
  //   accion_recomendada: "Operativa permitida. Monitorear."
  // }

  report: Record<string, unknown>;  // ComplexReport
  // {
  //   metadata: { ticker, tipo_estrategia, fecha_analisis, tiempo_calculo_ms },
  //   perfil: { credito_neto, perdida_maxima, ganancia_maxima, ratio, break_even_points },
  //   payoff: {
  //     expiracion: { curva, break_even, perdida_maxima, ganancia_maxima, zonas },
  //     temporal: { ... }
  //   },
  //   heatmap: { celdas: [{ precio, dias_restantes, pnl, tipo }], ... },
  //   simulacion: { tipo, probabilidad_exito, rendimiento_esperado, ... },
  //   riesgo: { puntaje, aceptable, eventos, resumen, accion_recomendada }
  // }

  summary: Record<string, unknown>;  // resumen ejecutivo
  // {
  //   perfil: { credito_neto, perdida_maxima, ganancia_maxima, ratio, break_even },
  //   simulacion: { prob_exito, rendimiento, sharpe, drawdown },
  //   riesgo: { puntaje, aceptable, advertencias, bloqueos }
  // }
}
```

> **Nota:** Los campos `profile`, `simulation`, `risk`, `report` y `summary` están declarados como `Record<string, unknown>` en el tipo de TypeScript del frontend, pero internamente tienen estructura definida en el backend.

---

# 10. Componentes del Dashboard

## 10.1 `EstrategiasPanel.tsx`

**Ubicación:** `projects/pwa/inversions_app/src/features/dashboard/simulation/EstrategiasPanel.tsx`

**Propósito:** Panel inline que se despliega en el dashboard al activar el core ESTRATEGIAS.

**Estados:**
- `"form"`: formulario de configuración (ticker, strikes, portfolio, etc.)
- `"results"`: visualización de resultados (payoff chart, primas, riesgo, simulación)

**APIs que consume:**
- `fetchOptionsChain()` → al cambiar ticker (onBlur)
- `fetchAccountBalance()` → click "Cargar saldo real de Alpaca"
- `executeStrategy()` → click "Ejecutar Estrategia con Datos Reales"

**Renderiza:**
- Tarjetas de resumen: estrategia, ticker, vencimiento, ganancia máx, pérdida máx, DTE
- Curva de payoff (SVG con gradiente)
- Tabla de primas con datos de Alpaca
- Evaluación de riesgo (puntaje, aceptable, eventos)
- Simulación Monte Carlo (probabilidad éxito, Sharpe, drawdown)

## 10.2 `ComplexStrategyParamsModal.tsx`

**Ubicación:** `projects/pwa/inversions_app/src/features/dashboard/simulation/ComplexStrategyParamsModal.tsx`

**Propósito:** Modal para configurar los parámetros detallados de una estrategia compleja.

**APIs que consume:**
- `fetchExpirations()` → al abrir modal o cambiar rango de meses
- `fetchOptionsChain()` → al abrir modal o seleccionar fecha

**Secciones del modal:**
1. **Parámetros:** Ticker (readonly), Contratos, Rango, Tolerancia Riesgo, Vencimiento, Tipo Ala, Estilo Opción
2. **Patas (Strikes):** N patas configurables con strike, tipo (call/put), posición (long/short)
3. **Portfolio:** Valor portafolio, Poder de compra, Margen actual, Posiciones

**Valores hardcodeados (no vienen de API):**
- `portfolio_valor: 50000`
- `portfolio_poder: 25000`
- `portfolio_margen: 0`
- `portfolio_posiciones: 0`
- `contratos: 1`
- `tipo_ala: "short"`
- `estilo_opcion: "americana"`
- Offsets de strikes (basados en strike base que SÍ viene de API)

## 10.3 `SimulationControlPanel.tsx`

**Ubicación:** `projects/pwa/inversions_app/src/features/dashboard/simulation/SimulationControlPanel.tsx`

**Propósito:** Panel de control central del dashboard que coordina todas las estrategias.

**APIs que consume (de TEAM-08):**
- `executeStrategy()` → al ejecutar simulación con estrategia compleja

**Integración con TEAM-08:**
1. Usuario selecciona estrategia (IRON_CONDOR, IRON_BUTTERFLY, BUTTERFLY_SPREAD, CONDOR)
2. Se abre `ComplexStrategyParamsModal` para configuración detallada
3. Al ejecutar, llama `executeStrategy()` + `runSimulation()` en paralelo
4. El resultado se pasa a `onComplexResult?.(complexRes, estrategia, temporalidad)`

---

# 11. Mapa de Archivos

## Frontend (React)

| Archivo | Ruta relativa | Rol |
|---------|--------------|-----|
| `strategyApi.ts` | `services/strategies/strategyApi.ts` | **Archivo central**: define todas las funciones API y tipos |
| `EstrategiasPanel.tsx` | `features/dashboard/simulation/EstrategiasPanel.tsx` | Panel inline de estrategias en el dashboard |
| `ComplexStrategyParamsModal.tsx` | `features/dashboard/simulation/ComplexStrategyParamsModal.tsx` | Modal de configuración detallada de estrategias |
| `SimulationControlPanel.tsx` | `features/dashboard/simulation/SimulationControlPanel.tsx` | Panel de control que orquesta simulaciones |

## Backend (Express)

### Routers (reciben peticiones HTTP)

| Archivo | Ruta relativa | Endpoints activos |
|---------|--------------|-------------------|
| `optionsChain.ts` | `routes/strategies/complex/optionsChain.ts` | `GET /expirations` · `GET /options-chain` |
| `fromChain.ts` | `routes/strategies/complex/fromChain.ts` | `POST /from-chain` |
| `alpacaExecutionRouter.ts` | `routes/strategies/complex/alpacaExecutionRouter.ts` | `GET /account` (solo este se usa) |

### Handler compartido

| Archivo | Ruta relativa | Rol |
|---------|--------------|-----|
| `strategyFromChainHandler.ts` | `routes/strategies/complex/strategyFromChainHandler.ts` | **Orquestador**: coordina toda la lógica de construir una estrategia |

### Motores

| Archivo | Ruta relativa | Rol |
|---------|--------------|-----|
| `complexStrategyContract.ts` | `modules/strategies/complex/complexStrategyContract.ts` | Contrato: tipos compartidos, validación, utilidades de cálculo |
| `ironCondorEngine.ts` | `modules/strategies/complex/ironCondorEngine.ts` | Motor de Iron Condor |
| `ironButterflyEngine.ts` | `modules/strategies/complex/ironButterflyEngine.ts` | Motor de Iron Butterfly |
| `butterflySpreadEngine.ts` | `modules/strategies/complex/butterflySpreadEngine.ts` | Motor de Butterfly Spread |
| `condorEngine.ts` | `modules/strategies/complex/condorEngine.ts` | Motor de Condor |
| `complexSimulationEngine.ts` | `modules/strategies/complex/complexSimulationEngine.ts` | Simulación Monte Carlo, determinística y backtesting |
| `complexRiskEngine.ts` | `modules/strategies/complex/complexRiskEngine.ts` | Evaluación de riesgo, límites y kill-switch |
| `complexReportEngine.ts` | `modules/strategies/complex/complexReportEngine.ts` | Generación de reportes, heatmaps, CSV |

### Servicio externo

| Archivo | Ruta relativa | Rol |
|---------|--------------|-----|
| `alpacaOptionsService.ts` | `modules/strategies/complex/alpacaOptionsService.ts` | Conexión con Alpaca Markets API |

### Registro de rutas

| Archivo | Ruta relativa |
|---------|--------------|
| `index.ts` | `projects/rest-api/inversions_api/src/index.ts` | Líneas 134-139 montan todas las rutas de TEAM-08 |

---

# 12. Código Muerto Identificado

## 12.1 En `strategyApi.ts` (frontend) — 5 funciones sin uso

| Función | ¿Alguien la llama? |
|---------|-------------------|
| `executeOptionsStrategy()` | ❌ Nadie |
| `executeAlpacaOrder()` | ❌ Nadie |
| `fetchActiveOrders()` | ❌ Nadie |
| `cancelAlpacaOrder()` | ❌ Nadie |
| `fetchSingleOrder()` | ❌ Nadie |

## 12.2 En `routes/strategies/complex/` (backend) — 6 routers montados sin uso

| Router | Endpoint | ¿Lo llama alguien? |
|--------|----------|-------------------|
| `ironCondorRouter` | `POST /iron-condor` | ❌ Nadie (reemplazado por `from-chain`) |
| `ironButterflyRouter` | `POST /iron-butterfly` | ❌ Nadie (reemplazado por `from-chain`) |
| `butterflySpreadRouter` | `POST /butterfly-spread` | ❌ Nadie (reemplazado por `from-chain`) |
| `condorRouter` | `POST /condor` | ❌ Nadie (reemplazado por `from-chain`) |
| `complexComparatorRouter` | `POST /complex-comparator` | ❌ Nadie |
| `alpacaExecutionRouter` | `GET /account`, `POST /execute-order`, `GET /orders`, etc. | ❌ Solo `GET /account` se usa |

> **Por qué están montados pero no se usan:** Las rutas individuales (`/iron-condor`, `/iron-butterfly`, etc.) fueron el diseño original. Luego se creó `POST /from-chain` que recibe `strategy_type` como parámetro y es un endpoint único para todas las estrategias. Las rutas viejas internamente llaman al mismo handler (`buildStrategyFromChain`), pero el frontend nunca las invoca.

---

## Apéndice A: Estados y Manejo de Errores

### Estados de carga visibles en el dashboard

| Componente | Estado | Indicador |
|-----------|--------|-----------|
| ComplexStrategyParamsModal | Cargando expiraciones | "Cargando..." junto al label |
| ComplexStrategyParamsModal | Error expiraciones | "Error: {mensaje}" en el dropdown |
| ComplexStrategyParamsModal | Cargando strikes | Texto: "Cargando strikes desde options chain..." |
| EstrategiasPanel | Cargando strikes | Texto: "Cargando strikes desde options chain..." |
| EstrategiasPanel | Cargando balance | Botón: "Cargando..." |
| EstrategiasPanel | Ejecutando estrategia | Botón: "Ejecutando con datos reales..." |
| EstrategiasPanel | Error general | Burbuja roja con mensaje de error |
| SimulationControlPanel | Ejecutando simulación | Botón: "Ejecutando…" con spinner |

### Errores mapeados por el frontend

| API | Código HTTP | Mensaje al usuario |
|-----|------------|-------------------|
| `fetchExpirations` | 404 | `"No hay expiraciones disponibles para {ticker} en los próximos {rangeMonths} meses."` |
| `fetchExpirations` | 502 | `"Error de autenticación con Alpaca. Verifica las API keys."` |
| `fetchOptionsChain` | 404 | `"No hay opciones disponibles para {ticker} ({expiration})"` |
| `fetchOptionsChain` | 502 | `"Error de autenticación con Alpaca. Verifica las API keys."` |
| `executeStrategy` | 400 | Mensaje de error de validación del backend |
| `executeStrategy` | 404 | `"No hay opciones disponibles para {ticker}"` |
| `executeStrategy` | 502 | `"Error de autenticación con Alpaca. Verifica las API keys."` |

---

## Apéndice B: Variables de Entorno Necesarias

| Variable | Dónde se usa | Propósito |
|----------|-------------|-----------|
| `ALPACA_API_KEY` | Backend (`alpacaOptionsService.ts`, `alpacaExecutionRouter.ts`) | Autenticación con Alpaca Markets |
| `ALPACA_SECRET_KEY` | Backend (ídem) | Autenticación con Alpaca Markets |
| `VITE_DEV_BEARER_TOKEN` | Frontend (`strategyApi.ts`) | Token de desarrollo para auth headers |
| `ALPACA_BASE_URL` | Backend (`alpacaExecutionRouter.ts`) | URL base de Alpaca (paper o live) |

---

## Apéndice C: Arquitectura de Autenticación

### Frontend → Backend (API interna)

```typescript
// strategyApi.ts
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const storageToken = window.localStorage.getItem("inversions.dev.token");
  const envToken = import.meta.env.VITE_DEV_BEARER_TOKEN;
  const token = storageToken || envToken;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
```

### Backend → Alpaca (API externa)

```typescript
// alpacaOptionsService.ts
headers: {
  "APCA-API-KEY-ID": this.apiKey,
  "APCA-API-SECRET-KEY": this.apiSecret,
  "Accept": "application/json",
}
```

---

# Apéndice D: Bloques de Código Clave del Código Fuente

> Esta sección contiene los fragmentos de código más importantes del código real, organizados por archivo.

---

## D.1 `strategyApi.ts` — Las 4 funciones activas del frontend

**Archivo:** `projects/pwa/inversions_app/src/services/strategies/strategyApi.ts`

### Configuración base

```typescript
const API_BASE = "/api/strategies/complex";

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const storageToken =
    typeof window !== "undefined" ? window.localStorage.getItem("inversions.dev.token") ?? undefined : undefined;
  const envToken = import.meta.env.VITE_DEV_BEARER_TOKEN as string | undefined;
  const token = storageToken || envToken;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
```

### `fetchExpirations()` — Obtener fechas de expiración

```typescript
export async function fetchExpirations(ticker: string, rangeMonths: number): Promise<ExpirationsResponse> {
  const params = new URLSearchParams({ ticker, rangeMonths: String(rangeMonths) });

  const response = await fetch(`${API_BASE}/expirations?${params.toString()}`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    if (response.status === 404) {
      throw new Error(`No hay expiraciones disponibles para ${ticker} en los proximos ${rangeMonths} meses.`);
    }
    if (response.status === 502) {
      throw new Error("Error de autenticacion con Alpaca. Verifica las API keys.");
    }
    throw new Error(`Error ${response.status} al obtener expiraciones: ${text}`);
  }

  return (await response.json()) as ExpirationsResponse;
}
```

### `fetchOptionsChain()` — Obtener strikes, precios y griegas

```typescript
export async function fetchOptionsChain(ticker: string, expiration?: string): Promise<OptionsChainResponse> {
  const params = new URLSearchParams({ ticker });
  if (expiration) params.set("expiration", expiration);

  const response = await fetch(`${API_BASE}/options-chain?${params.toString()}`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error(`No hay opciones disponibles para ${ticker}${expiration ? ` (${expiration})` : ""}`);
    if (response.status === 502) throw new Error("Error de autenticacion con Alpaca. Verifica las API keys.");
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`Error ${response.status}: ${text}`);
  }

  return (await response.json()) as OptionsChainResponse;
}
```

### `fetchAccountBalance()` — Obtener saldo real de Alpaca

```typescript
export async function fetchAccountBalance(): Promise<AlpacaAccountBalance> {
  const response = await fetch(`${API_BASE}/account`, {
    headers: { ...getAuthHeaders() },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`Error ${response.status}: ${text}`);
  }

  return (await response.json()) as AlpacaAccountBalance;
}
```

### `executeStrategy()` — Ejecutar estrategia completa

```typescript
export async function executeStrategy(payload: FromChainRequest): Promise<FromChainResponse> {
  const response = await fetch(`${API_BASE}/from-chain`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    if (response.status === 400) {
      const err = JSON.parse(text);
      throw new Error(err.error || `Error de validacion: ${text}`);
    }
    if (response.status === 404) throw new Error(`No hay opciones disponibles para ${payload.ticker}`);
    if (response.status === 502) throw new Error("Error de autenticacion con Alpaca. Verifica las API keys.");
    throw new Error(`Error ${response.status}: ${text}`);
  }

  return (await response.json()) as FromChainResponse;
}
```

---

## D.2 `fromChain.ts` — Router del backend con validaciones

**Archivo:** `projects/rest-api/inversions_api/src/routes/strategies/complex/fromChain.ts`

```typescript
import { Router } from "express";
import { authContextMiddleware } from "../../../middleware/authContext";
import {
  buildStrategyFromChain,
  mapBuildError,
  type SupportedStrategy,
  type StrategyChainRequest,
} from "./strategyFromChainHandler";

export const fromChainRouter = Router();

fromChainRouter.post("/from-chain", authContextMiddleware, async (req, res) => {
  try {
    const body = req.body as StrategyChainRequest & { strategy_type?: SupportedStrategy };

    // ── Validate strategy_type ──
    if (!body.strategy_type) {
      res.status(400).json({
        error: "strategy_type es requerido. strategy_type is required.",
        opciones: ["iron_condor", "iron_butterfly", "butterfly_spread", "condor"],
      });
      return;
    }

    const supported: SupportedStrategy[] = ["iron_condor", "iron_butterfly", "butterfly_spread", "condor"];
    if (!supported.includes(body.strategy_type)) {
      res.status(400).json({
        error: `Tipo de estrategia no soportado: ${body.strategy_type}. Unsupported strategy type.`,
        opciones: supported,
      });
      return;
    }

    // ── Validate common fields ──
    if (!body.ticker) {
      res.status(400).json({ error: "ticker es requerido. ticker is required." });
      return;
    }

    if (!body.strikes || body.strikes.length === 0) {
      res.status(400).json({
        error: "Se requieren strikes para construir la estrategia. Strikes are required.",
      });
      return;
    }

    if (body.expiracion && !/^\d{4}-\d{2}-\d{2}$/.test(body.expiracion)) {
      res.status(400).json({
        error: "Formato de fecha invalido. Use YYYY-MM-DD. Invalid date format.",
      });
      return;
    }

    if (!body.portfolio) {
      res.status(400).json({
        error: "portfolio es requerido (valor_portafolio_usd, poder_compra_usd). No hay valor por defecto.",
      });
      return;
    }

    // ── Delegate to shared handler ──
    const result = await buildStrategyFromChain(body.strategy_type, {
      ticker: body.ticker,
      expiracion: body.expiracion,
      strikes: body.strikes,
      contratos: body.contratos,
      tipo_ala: body.tipo_ala,
      tolerancia_riesgo: body.tolerancia_riesgo,
      estilo_opcion: body.estilo_opcion,
      dias_vencimiento: body.dias_vencimiento,
      portfolio: body.portfolio,
    });

    res.status(200).json({
      strategy_type: body.strategy_type,
      ticker: result.ticker,
      expiracion: result.expiracion,
      premiums_used: result.premiums_used,
      validation: result.validation,
      profile: result.profile,
      simulation: result.simulation,
      risk: result.risk,
      report: result.report,
      summary: result.summary,
    });
  } catch (error) {
    const mapped = mapBuildError(error);
    res.status(mapped.statusCode).json(mapped.body);
  }
});
```

---

## D.3 `strategyFromChainHandler.ts` — El orquestador principal

**Archivo:** `projects/rest-api/inversions_api/src/routes/strategies/complex/strategyFromChainHandler.ts`

### Engine factory registry

```typescript
const STRATEGY_ENGINES: Record<SupportedStrategy, () => IComplexStrategyEngine> = {
  iron_condor: () => createIronCondorEngine(),
  iron_butterfly: () => createIronButterflyEngine(),
  butterfly_spread: () => createButterflySpreadEngine(),
  condor: () => createCondorEngine(),
};

const optionsService = createAlpacaOptionsService();
const simulationEngine = new ComplexSimulationEngine();
const riskEngine = new ComplexRiskEngine();
const reportEngine = new ComplexReportEngine();
```

### Clases de error custom

```typescript
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
```

### Función principal `buildStrategyFromChain()`

```typescript
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
```

### Mapeo de errores a HTTP

```typescript
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

  // ... generic errors
  return {
    statusCode: 500,
    body: {
      error: "Error al procesar estrategia desde options chain.",
      detalle: message,
    },
  };
}
```

---

## D.4 `complexStrategyContract.ts` — Tipos base y utilidades de cálculo

**Archivo:** `projects/rest-api/inversions_api/src/modules/strategies/complex/complexStrategyContract.ts`

### Tipos base

```typescript
export type OptionStyle = "europea" | "americana";
export type OptionType = "call" | "put";
export type LegPosition = "long" | "short";
export type WingType = "short" | "wide" | "broken";
export type RiskTolerance = "bajo" | "medio" | "alto";
```

### Interface `OptionLeg`

```typescript
export interface OptionLeg {
  strike: number;
  tipo: OptionType;
  posicion: LegPosition;
  prima: number;
  contratos: number;
  bid?: number;
  ask?: number;
  subyacente_precio?: number;
  volatilidad_implicita?: number;
  symbol?: string;
}
```

### Interface `StrategyProfile`

```typescript
export interface StrategyProfile {
  credito_neto: number;
  tipo_neto: "credito" | "debito";
  break_even_points: number[];
  perdida_maxima: number;
  ganancia_maxima: number;
  payoff_curve: PayoffPoint[];
  payoff_vencimiento: PayoffPoint[];
  payoff_temporal?: PayoffPoint[];
  griegas?: GreeksSummary;
  probabilidad_ganancia?: number;
  ratio_riesgo_beneficio?: number;
}
```

### Cálculo del payoff de una pata individual

```typescript
export function calculateLegPayoff(leg: OptionLeg, subyacente_precio: number): number {
  let intrinsicValue: number;

  if (leg.tipo === "call") {
    intrinsicValue = Math.max(0, subyacente_precio - leg.strike);
  } else {
    intrinsicValue = Math.max(0, leg.strike - subyacente_precio);
  }

  const multiplier = leg.posicion === "long" ? 1 : -1;
  const premiumCost = leg.posicion === "long" ? -leg.prima : leg.prima;

  return (intrinsicValue * multiplier + premiumCost) * leg.contratos * 100;
}
```

### Cálculo del crédito/débito neto

```typescript
export function calculateNetCredit(legs: OptionLeg[]): { credito_neto: number; tipo_neto: "credito" | "debito" } {
  const net = legs.reduce((sum, leg) => {
    const sign = leg.posicion === "short" ? 1 : -1;
    return sum + sign * leg.prima * leg.contratos * 100;
  }, 0);

  return {
    credito_neto: Math.round(net * 100) / 100,
    tipo_neto: net >= 0 ? "credito" : "debito",
  };
}
```

### Break-evens interpolación lineal

```typescript
export function findBreakEvens(payoffCurve: PayoffPoint[]): number[] {
  const breakEvens: number[] = [];

  for (let i = 1; i < payoffCurve.length; i++) {
    const prev = payoffCurve[i - 1];
    const curr = payoffCurve[i];

    if ((prev.pnl <= 0 && curr.pnl >= 0) || (prev.pnl >= 0 && curr.pnl <= 0)) {
      const denom = Math.abs(prev.pnl) + Math.abs(curr.pnl);
      if (denom === 0) continue;
      const fraction = Math.abs(prev.pnl) / denom;
      const bePrice = prev.precio_subyacente + fraction * (curr.precio_subyacente - prev.precio_subyacente);
      breakEvens.push(Math.round(bePrice * 100) / 100);
    }
  }

  return breakEvens;
}
```

---

## D.5 `ironCondorEngine.ts` — Motor de Iron Condor

**Archivo:** `projects/rest-api/inversions_api/src/modules/strategies/complex/ironCondorEngine.ts`

### Validación específica del Iron Condor

```typescript
export class IronCondorEngine implements IComplexStrategyEngine {
  validateConfig(config: ComplexStrategyConfig): StrategyValidationResult {
    const base = validateCommonConfig(config);
    const errores = [...base.errores];
    const advertencias = [...base.advertencias];

    if (config.legs.length !== 4) {
      errores.push("Iron Condor requiere exactamente 4 patas (2 puts + 2 calls).");
      return { valido: false, errores, advertencias };
    }

    const puts = config.legs.filter((leg) => leg.tipo === "put");
    const calls = config.legs.filter((leg) => leg.tipo === "call");

    if (puts.length !== 2) {
      errores.push("Iron Condor requiere exactamente 2 patas put.");
    }
    if (calls.length !== 2) {
      errores.push("Iron Condor requiere exactamente 2 patas call.");
    }

    if (errores.length > 0) return { valido: false, errores, advertencias };

    const sortedPuts = [...puts].sort((a, b) => a.strike - b.strike);
    const sortedCalls = [...calls].sort((a, b) => a.strike - b.strike);

    const shortPut = sortedPuts[1];
    const longPut = sortedPuts[0];
    const shortCall = sortedCalls[0];
    const longCall = sortedCalls[1];

    if (longPut.posicion !== "long" || shortPut.posicion !== "short") {
      errores.push("Iron Condor put legs: lower strike must be long and higher strike must be short.");
    }
    if (shortCall.posicion !== "short" || longCall.posicion !== "long") {
      errores.push("Iron Condor call legs: lower strike must be short and higher strike must be long.");
    }

    return { valido: errores.length === 0, errores, advertencias };
  }
}
```

### Cálculo del perfil completo

```typescript
  calculateProfile(config: ComplexStrategyConfig): StrategyProfile {
    const validation = this.validateConfig(config);
    if (!validation.valido) {
      throw new Error(`IronCondorEngine: configuracion invalida.\n${validation.errores.join("\n")}`);
    }

    const puts = config.legs.filter((leg) => leg.tipo === "put").sort((a, b) => a.strike - b.strike);
    const calls = config.legs.filter((leg) => leg.tipo === "call").sort((a, b) => a.strike - b.strike);

    const longPut = puts[0];
    const shortPut = puts[1];
    const shortCall = calls[0];
    const longCall = calls[1];

    const priceRange = generatePriceRange(config.legs, 0.4);
    const payoffExpiration = generatePayoffCurve(config.legs, priceRange.min, priceRange.max, 150);
    const { credito_neto, tipo_neto } = calculateNetCredit(config.legs);
    const breakEvens = findBreakEvens(payoffExpiration);
    const perdida_maxima = calculateMaxLoss(payoffExpiration);
    const ganancia_maxima = calculateMaxGain(payoffExpiration);

    const ratio_riesgo_beneficio =
      perdida_maxima > 0
        ? Math.round((ganancia_maxima / perdida_maxima) * 100) / 100
        : 0;

    const payoffTemporal = this.generateTemporalPayoff(
      config.legs, priceRange.min, priceRange.max, config.dias_vencimiento ?? 45
    );

    return {
      credito_neto,
      tipo_neto,
      break_even_points: breakEvens,
      perdida_maxima,
      ganancia_maxima,
      payoff_curve: payoffExpiration,
      payoff_vencimiento: payoffExpiration,
      payoff_temporal: payoffTemporal,
      ratio_riesgo_beneficio,
    };
  }
```

---

## D.6 `complexSimulationEngine.ts` — Monte Carlo

**Archivo:** `projects/rest-api/inversions_api/src/modules/strategies/complex/complexSimulationEngine.ts`

### SeededRandom (PRNG reproducible)

```typescript
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextGaussian(): number {
    const u1 = this.next();
    const u2 = this.next();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
}
```

### Núcleo de la simulación Monte Carlo

```typescript
private runMonteCarlo(
  config: ComplexStrategyConfig,
  profile: StrategyProfile,
  simConfig: SimulationConfig,
  basePrice: number,
  baseIV: number,
  startTime: number
): SimulationResult {
  const rng = new SeededRandom(simConfig.semilla);
  const iterations = Math.min(Math.max(simConfig.iteraciones, 1000), 100000);

  const pnlResults: number[] = [];
  const sampledResults: Array<{ iteracion: number; precio_final: number; pnl: number }> = [];

  let totalCosts = 0;
  const costDetail = this.calculateCosts(config.legs, simConfig.costos);
  totalCosts = costDetail.total;

  for (let i = 0; i < iterations; i++) {
    // FIC: Geometric Brownian Motion (simplified)
    const priceShock = simConfig.shock_precio * rng.nextGaussian();
    const simulatedPrice = basePrice * (1 + priceShock);

    let pnl = this.calculateTotalPnl(config.legs, simulatedPrice);
    pnl -= totalCosts;
    pnlResults.push(pnl);

    const sampleRate = Math.max(1, Math.floor(iterations / 100));
    if (i % sampleRate === 0) {
      sampledResults.push({
        iteracion: i,
        precio_final: Math.round(simulatedPrice * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
      });
    }
  }

  const sorted = [...pnlResults].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / sorted.length;
  const stdDev = Math.sqrt(variance);

  return {
    tipo: "monte_carlo",
    total_iteraciones: iterations,
    semilla: simConfig.semilla,
    tiempo_ms: Date.now() - startTime,
    distribucion_pnl: {
      media: Math.round(mean * 100) / 100,
      mediana: Math.round(median * 100) / 100,
      desviacion_estandar: Math.round(stdDev * 100) / 100,
      percentil_5: Math.round(sorted[Math.floor(sorted.length * 0.05)] * 100) / 100,
      percentil_25: Math.round(sorted[Math.floor(sorted.length * 0.25)] * 100) / 100,
      percentil_75: Math.round(sorted[Math.floor(sorted.length * 0.75)] * 100) / 100,
      percentil_95: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 100) / 100,
      maximo: Math.round(Math.max(...pnlResults) * 100) / 100,
      minimo: Math.round(Math.min(...pnlResults) * 100) / 100,
    },
    probabilidad_exito: Math.round((pnlResults.filter((p) => p > 0).length / iterations) * 10000) / 100,
    rendimiento_esperado: Math.round(mean * 100) / 100,
    drawdown_maximo: Math.round(this.calculateMaxDrawdown(pnlResults) * 100) / 100,
    ratio_sharpe: stdDev > 0 ? Math.round((mean / stdDev) * 100) / 100 : 0,
    escenarios: { mejor_caso, peor_caso, caso_base },
    muestras: sampledResults,
    costos_totales: Math.round(totalCosts * 100) / 100,
    costos_detalle: {
      slippage_total: Math.round(costDetail.slippage * 100) / 100,
      comisiones_totales: Math.round(costDetail.commissions * 100) / 100,
      spread_total: Math.round(costDetail.spread * 100) / 100,
    },
  };
}
```

---

## D.7 `complexRiskEngine.ts` — Evaluación de los 10 controles

**Archivo:** `projects/rest-api/inversions_api/src/modules/strategies/complex/complexRiskEngine.ts`

### Límites por perfil de riesgo

```typescript
export const DEFAULT_RISK_LIMITS: Record<RiskProfile, RiskLimits> = {
  conservador: {
    perdida_maxima_usd: 500,
    margen_maximo_usd: 2000,
    contratos_maximos: 5,
    riesgo_maximo_porcentaje: 2,
    drawdown_maximo_porcentaje: 10,
    stop_loss_automatico: true,
    dte_minimo: 21,
    iv_maximo_percentil: 50,
  },
  moderado: {
    perdida_maxima_usd: 2000,
    margen_maximo_usd: 10000,
    contratos_maximos: 20,
    riesgo_maximo_porcentaje: 5,
    drawdown_maximo_porcentaje: 20,
    stop_loss_automatico: true,
    dte_minimo: 14,
    iv_maximo_percentil: 70,
  },
  agresivo: {
    perdida_maxima_usd: 10000,
    margen_maximo_usd: 50000,
    contratos_maximos: 100,
    riesgo_maximo_porcentaje: 15,
    drawdown_maximo_porcentaje: 35,
    stop_loss_automatico: false,
    dte_minimo: 7,
    iv_maximo_percentil: 90,
  },
};
```

### Evaluación de controles (fragmento)

```typescript
evaluate(
  config: ComplexStrategyConfig,
  profile: StrategyProfile,
  simulation: SimulationResult,
  portfolio: PortfolioContext,
  customLimits?: Partial<RiskLimits>
): RiskAssessment {
  const riskProfile = this.mapToleranceToProfile(config.tolerancia_riesgo);
  const limits = this.resolveLimits(riskProfile, customLimits);
  const eventos: RiskEvent[] = [];
  let eventId = 0;

  // 1. Kill-switch check
  const killSwitch = this.killSwitches.get(config.ticker);
  if (killSwitch?.activo) { /* blocking event */ }

  // 2. Maximum loss check
  if (profile.perdida_maxima > limits.perdida_maxima_usd) { /* blocking event */ }

  // 3. Contracts check
  if (totalContracts > limits.contratos_maximos) { /* blocking event */ }

  // 4. Portfolio risk percentage check
  const riskPercent = (profile.perdida_maxima / portfolio.valor_portafolio_usd) * 100;
  if (riskPercent > limits.riesgo_maximo_porcentaje) { /* blocking event */ }

  // 5. Buying power check
  if (profile.perdida_maxima > portfolio.poder_compra_usd) { /* blocking event */ }

  // 6. Probability of success check
  if (simulation.probabilidad_exito < 20) { /* warning event */ }

  // 7. DTE check
  if (dte < limits.dte_minimo) { /* warning or critical */ }

  // 8. Early assignment detection (American options)
  if (config.estilo_opcion === "americana") { /* check ITM short legs */ }

  // 9. Drawdown check
  if (drawdownPercent > limits.drawdown_maximo_porcentaje) { /* warning or critical */ }

  // 10. Sharpe ratio check
  if (simulation.ratio_sharpe < 0) { /* warning */ }

  const puntajeRiesgo = this.calculateRiskScore(eventos);
  const riesgoAceptable = eventos.filter((e) => e.bloquea).length === 0;

  return { riesgo_aceptable, puntaje_riesgo, eventos, resumen, accion_recomendada };
}
```

---

## D.8 `alpacaOptionsService.ts` — Conexión con Alpaca

**Archivo:** `projects/rest-api/inversions_api/src/modules/strategies/complex/alpacaOptionsService.ts`

### Fetch de la options chain desde Alpaca

```typescript
export class AlpacaOptionsService {
  private readonly paperApiBase = "https://paper-api.alpaca.markets";
  private readonly dataApiBase = "https://data.alpaca.markets";

  async getOptionsChain(ticker: string, expiration?: string): Promise<OptionsChain> {
    // Step 1: Fetch contracts from Alpaca /v2/options/contracts
    const contracts = await this.fetchContracts(ticker, expiration);

    if (contracts.length === 0) {
      return { ticker: ticker.toUpperCase(), expiracion: expiration ?? "unknown",
        subyacente_precio: null, entries: [], grouped: { calls: [], puts: [] } };
    }

    // Step 2: Fetch snapshots for all contracts (bid/ask/greeks)
    const contractSymbols = contracts.map((c) => c.symbol);
    const snapshots = await this.fetchSnapshots(contractSymbols);

    // Step 3: Build normalized entries
    const entries: OptionChainEntry[] = contracts.map((contract) => {
      const snapshot = snapshots[contract.symbol];
      const bid = snapshot?.latestQuote?.bp ?? null;
      const ask = snapshot?.latestQuote?.ap ?? null;
      const mid = bid !== null && ask !== null ? Math.round(((bid + ask) / 2) * 100) / 100 : null;

      return {
        symbol: contract.symbol,
        strike: parseFloat(contract.strike_price),
        tipo: contract.type,
        expiracion: contract.expiration_date,
        bid, ask, mid,
        estilo: contract.style,
        tradable: contract.tradable,
        greeks: snapshot?.greeks ? {
          delta: snapshot.greeks.delta,
          gamma: snapshot.greeks.gamma,
          theta: snapshot.greeks.theta,
          vega: snapshot.greeks.vega,
          implied_volatility: snapshot.greeks.implied_volatility,
        } : undefined,
      };
    });

    return {
      ticker: ticker.toUpperCase(),
      expiracion: expiration ?? contracts[0]?.expiration_date ?? "unknown",
      subyacente_precio: null,
      entries,
      grouped: { calls: entries.filter((e) => e.tipo === "call"), puts: entries.filter((e) => e.tipo === "put") },
    };
  }

  private async fetchContracts(ticker: string, expiration?: string): Promise<AlpacaOptionContract[]> {
    let url = `${this.paperApiBase}/v2/options/contracts?underlying_symbols=${ticker}&status=active&limit=250`;
    if (expiration) {
      const expDate = expiration.substring(0, 10);
      url += `&expiration_date_gte=${expDate}&expiration_date_lte=${expDate}`;
    }
    const response = await this.get(url);
    const data = (await response.json()) as AlpacaContractsResponse;
    return data.option_contracts ?? [];
  }

  private async fetchSnapshots(symbols: string[]): Promise<Record<string, AlpacaOptionSnapshot>> {
    const batchSize = 100;
    const allSnapshots: Record<string, AlpacaOptionSnapshot> = {};

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const url = `${this.dataApiBase}/v1beta1/options/snapshots?symbols=${batch.join(",")}`;
      const response = await this.get(url);
      const data = (await response.json()) as AlpacaSnapshotsResponse;
      if (data.snapshots) Object.assign(allSnapshots, data.snapshots);
    }
    return allSnapshots;
  }

  private async get(url: string): Promise<Response> {
    const response = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": this.apiKey,
        "APCA-API-SECRET-KEY": this.apiSecret,
        "Accept": "application/json",
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "Unknown error");
      throw new Error(`Alpaca API error: ${response.status} ${response.statusText} - ${body}.`);
    }
    return response;
  }
}
```

---

## D.9 `index.ts` — Registro de rutas de TEAM-08

**Archivo:** `projects/rest-api/inversions_api/src/index.ts`

```typescript
// ── TEAM-08: Complex Strategy Routes ──
import { alpacaExecutionRouter } from "./routes/strategies/complex/alpacaExecutionRouter";
import { fromChainRouter } from "./routes/strategies/complex/fromChain";
import { optionsChainRouter } from "./routes/strategies/complex/optionsChain";
import { ironCondorRouter } from "./routes/strategies/complex/ironCondor";
import { ironButterflyRouter } from "./routes/strategies/complex/ironButterfly";
import { butterflySpreadRouter } from "./routes/strategies/complex/butterflySpread";
import { condorRouter } from "./routes/strategies/complex/condor";
import { complexComparatorRouter } from "./routes/strategies/complex/complexComparator";

// ── TEAM-08: Complex Strategy Routes ──
app.use("/api/strategies/complex", optionsChainRouter);    // GET /expirations, /options-chain
app.use("/api/strategies/complex", fromChainRouter);       // POST /from-chain
app.use("/api/strategies/complex", alpacaExecutionRouter); // GET /account (+ código muerto)
app.use("/api/strategies/complex", ironCondorRouter);      // CÓDIGO MUERTO
app.use("/api/strategies/complex", ironButterflyRouter);   // CÓDIGO MUERTO
app.use("/api/strategies/complex", butterflySpreadRouter); // CÓDIGO MUERTO
app.use("/api/strategies/complex", condorRouter);          // CÓDIGO MUERTO
app.use("/api/strategies/complex", complexComparatorRouter); // CÓDIGO MUERTO
```

---

## D.10 `EstrategiasPanel.tsx` — Llamada desde el frontend

**Archivo:** `projects/pwa/inversions_app/src/features/dashboard/simulation/EstrategiasPanel.tsx`

### handleAutoAdjustStrikes — auto-ajuste de strikes desde Alpaca

```typescript
const handleAutoAdjustStrikes = useCallback(async () => {
  if (!form.ticker || form.ticker.length < 2) return;
  setError(null);
  setLoadingStrikes(true);
  try {
    const chain = await fetchOptionsChain(form.ticker);
    if (chain && chain.total_contratos > 0) {
      const midStrike = Math.round(
        (chain.resumen.call_strike_min + chain.resumen.call_strike_max) / 2
      );
      const roundedBase = Math.round(midStrike / 5) * 5;
      setLastAutoBaseStrike(roundedBase);
      setForm((prev) => ({
        ...prev,
        strikes: getDefaultStrikes(prev.strategy_type, roundedBase),
      }));
    }
  } catch {
    setError("No se pudieron ajustar strikes automaticamente para " + form.ticker);
  } finally {
    setLoadingStrikes(false);
  }
}, [form.ticker]);
```

### handleLoadBalance — cargar saldo real de Alpaca

```typescript
const handleLoadBalance = useCallback(async () => {
  setLoadingBalance(true);
  setError(null);
  try {
    const balance = await fetchAccountBalance();
    setForm((prev) => ({
      ...prev,
      portfolio_valor: Math.round(balance.equity),
      portfolio_poder: Math.round(balance.buyingPower),
    }));
  } catch (err) {
    setError(err instanceof Error ? err.message : "Error al cargar saldo de Alpaca");
  } finally {
    setLoadingBalance(false);
  }
}, []);
```

### handleExecute — ejecutar estrategia

```typescript
const handleExecute = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const payload = {
      strategy_type: form.strategy_type,
      ticker: form.ticker,
      expiracion: form.expiracion || undefined,
      strikes: form.strikes,
      contratos: form.contratos,
      tipo_ala: form.tipo_ala,
      tolerancia_riesgo: form.tolerancia_riesgo,
      estilo_opcion: form.estilo_opcion,
      portfolio: {
        valor_portafolio_usd: form.portfolio_valor,
        poder_compra_usd: form.portfolio_poder,
        margen_actual_usd: form.portfolio_margen,
        posiciones_actuales: form.portfolio_posiciones,
      },
    };
    const res = await executeStrategy(payload);
    setResult(res);
    setStep("results");
    onStrategyResult?.(res);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Error al ejecutar estrategia");
  } finally {
    setLoading(false);
  }
}, [form, onStrategyResult]);
```

---

## D.11 `optionsChain.ts` — Endpoints GET del backend

**Archivo:** `projects/rest-api/inversions_api/src/routes/strategies/complex/optionsChain.ts`

### GET /expirations

```typescript
optionsChainRouter.get("/expirations", authContextMiddleware, async (req, res) => {
  try {
    const ticker = (req.query.ticker as string)?.trim().toUpperCase();
    const rangeMonthsStr = req.query.rangeMonths as string | undefined;

    if (!ticker) {
      res.status(400).json({ error: "Ticker es requerido.", ejemplo: "/api/strategies/complex/expirations?ticker=SPY&rangeMonths=6" });
      return;
    }
    if (!rangeMonthsStr) {
      res.status(400).json({ error: "rangeMonths es requerido." });
      return;
    }

    const rangeMonths = parseInt(rangeMonthsStr, 10);
    if (isNaN(rangeMonths) || rangeMonths < 1) {
      res.status(400).json({ error: "rangeMonths debe ser un numero positivo." });
      return;
    }

    const expiraciones = await optionsService.getExpirations(ticker, rangeMonths);

    res.status(200).json({ ticker, rangeMonths, expiraciones });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("No se encontraron expiraciones")) {
      res.status(404).json({ error: message, ticker: req.query.ticker, rangeMonths, expiraciones: [] });
      return;
    }
    if (message.includes("401") || message.includes("403")) {
      res.status(502).json({ error: "Error de autenticacion con Alpaca." });
      return;
    }
    res.status(500).json({ error: "Error al obtener expiraciones." });
  }
});
```

### GET /options-chain

```typescript
optionsChainRouter.get("/options-chain", authContextMiddleware, async (req, res) => {
  try {
    const ticker = (req.query.ticker as string)?.trim().toUpperCase();
    const expiration = (req.query.expiration as string)?.trim() || undefined;

    if (!ticker) {
      res.status(400).json({
        error: "Ticker es requerido.",
        ejemplo: "/api/strategies/complex/options-chain?ticker=SPY&expiration=2026-06-19",
      });
      return;
    }

    if (expiration && !/^\d{4}-\d{2}-\d{2}$/.test(expiration)) {
      res.status(400).json({ error: "Formato de fecha invalido. Use YYYY-MM-DD." });
      return;
    }

    const chain: OptionsChain = await optionsService.getOptionsChain(ticker, expiration);

    if (chain.entries.length === 0) {
      res.status(404).json({ error: `No se encontraron opciones para ${ticker}${expiration ? ` con vencimiento ${expiration}` : ""}.` });
      return;
    }

    res.status(200).json({
      ticker: chain.ticker,
      expiracion: chain.expiracion,
      total_contratos: chain.entries.length,
      total_calls: chain.grouped.calls.length,
      total_puts: chain.grouped.puts.length,
      resumen: {
        call_strike_min: chain.grouped.calls.length > 0 ? Math.min(...chain.grouped.calls.map((c) => c.strike)) : null,
        call_strike_max: chain.grouped.calls.length > 0 ? Math.max(...chain.grouped.calls.map((c) => c.strike)) : null,
        put_strike_min: chain.grouped.puts.length > 0 ? Math.min(...chain.grouped.puts.map((c) => c.strike)) : null,
        put_strike_max: chain.grouped.puts.length > 0 ? Math.max(...chain.grouped.puts.map((c) => c.strike)) : null,
      },
      grouped: chain.grouped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("401") || message.includes("403")) {
      res.status(502).json({ error: "Error de autenticacion con Alpaca." });
      return;
    }
    res.status(500).json({ error: "Error al obtener options chain." });
  }
});
```

---

## D.12 `ComplexStrategyParamsModal.tsx` — Configuración desde el modal

**Archivo:** `projects/pwa/inversions_app/src/features/dashboard/simulation/ComplexStrategyParamsModal.tsx`

### Presets de estrategias y offsets

```typescript
const STRATEGY_PRESETS: Record<string, { label: string; legs: number; description: string; backendType: string }> = {
  IRON_CONDOR:     { label: "Iron Condor",     legs: 4, description: "2 puts (long+short) + 2 calls (short+long)",        backendType: "iron_condor" },
  IRON_BUTTERFLY:  { label: "Iron Butterfly",  legs: 4, description: "2 puts (long+short) + 2 calls (short+long) · ATM", backendType: "iron_butterfly" },
  BUTTERFLY_SPREAD:{ label: "Butterfly Spread",legs: 3, description: "3 patas del mismo tipo (long + short 2x + long)",   backendType: "butterfly_spread" },
  CONDOR:          { label: "Condor",           legs: 4, description: "4 patas del mismo tipo (long + short + short + long)", backendType: "condor" },
};

function getDefaultStrikes(type: string, baseStrike: number): StrikeSelection[] {
  const patterns = getLegPattern(type);
  if (baseStrike <= 0) return patterns.map((p) => ({ strike: 0, ...p }));

  const offsets: Record<string, number[]> = {
    IRON_CONDOR:      [-20, 0, 40, 60],
    IRON_BUTTERFLY:   [-40, 0, 0, 40],
    BUTTERFLY_SPREAD: [-20, 20, 60],
    CONDOR:           [-60, -20, 20, 60],
  };
  const legOffsets = offsets[type] ?? [];
  return patterns.map((p, i) => ({ ...p, strike: baseStrike + (legOffsets[i] ?? 0) }));
}
```

### Fetch de expiraciones al abrir el modal

```typescript
useEffect(() => {
  if (!open || !ticker || ticker.length < 2) return;

  let cancelled = false;
  setLoadingExpirations(true);
  setExpirationsError(null);

  fetchExpirations(ticker, rangoMeses)
    .then((res) => {
      if (!cancelled) {
        setAvailableExpirations(sampleExpirations(res.expiraciones, rangoMeses));
        setLoadingExpirations(false);
      }
    })
    .catch((err: Error) => {
      if (!cancelled) {
        setExpirationsError(err.message);
        setAvailableExpirations([]);
        setLoadingExpirations(false);
      }
    });

  return () => { cancelled = true; };
}, [open, ticker, rangoMeses]);
```

### Auto-ajuste de strikes con datos reales

```typescript
const handleAutoAdjustStrikes = useCallback(async (tickerToFetch: string, expiration?: string) => {
  if (!tickerToFetch || tickerToFetch.length < 2) return;
  setLoadingStrikes(true);
  setStrikesError(null);
  try {
    const chain = await fetchOptionsChain(tickerToFetch, expiration);
    if (chain && chain.total_contratos > 0) {
      const midStrike = Math.round(
        (chain.resumen.call_strike_min + chain.resumen.call_strike_max) / 2
      );
      const roundedBase = Math.round(midStrike / 5) * 5;
      setLastAutoBaseStrike(roundedBase);
      setForm((prev) => ({
        ...prev,
        strikes: getDefaultStrikes(strategy, roundedBase),
      }));
    }
  } catch (err) {
    setStrikesError(err instanceof Error ? err.message : String(err));
  } finally {
    setLoadingStrikes(false);
  }
}, [strategy]);
```

### SampleExpirations — filtrado de fechas por rango

```typescript
function sampleExpirations(dates: string[], range: number): string[] {
  if (dates.length === 0) return [];
  if (range === 1) return dates;

  const grouped: Record<string, string[]> = {};
  for (const d of dates) {
    const key = d.slice(0, 7);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d);
  }

  const months = Object.keys(grouped).sort();
  const result: string[] = [];

  if (range === 2) {
    for (const m of months) {
      result.push(grouped[m][0]);
      if (grouped[m].length > 1) result.push(grouped[m][grouped[m].length - 1]);
    }
  } else if (range === 6) {
    for (const m of months) result.push(grouped[m][0]);
  } else if (range === 12) {
    for (let i = 0; i < months.length; i += 2) result.push(grouped[months[i]][0]);
  }

  return result;
}
```

---

*Documento generado para presentación del equipo TEAM-08 — Estrategias Complejas de Opciones*
