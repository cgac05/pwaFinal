# TEAM-08: Estrategias Complejas de Opciones — Documentación Completa

> **Branch:** `main` (merge TEAM-08)  
> **Estado:** ✅ Completado — Backend + Frontend  
> **Backend:** `localhost:3000` | **Frontend:** `localhost:5173/#strategy-lab`  
> **Fecha:** Mayo 2026

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura General](#2-arquitectura-general)
3. [Teoría de Estrategias](#3-teoría-de-estrategias)
   - 3.1 [Iron Condor](#31-iron-condor)
   - 3.2 [Iron Butterfly](#32-iron-butterfly)
   - 3.3 [Butterfly Spread](#33-butterfly-spread)
   - 3.4 [Condor](#34-condor)
4. [Backend — API REST](#4-backend--api-rest)
   - 4.1 [Estructura de Archivos](#41-estructura-de-archivos)
   - 4.2 [Módulo: Alpaca Options Service](#42-módulo-alpaca-options-service)
   - 4.3 [Módulo: Complex Strategy Contract](#43-módulo-complex-strategy-contract)
   - 4.4 [Motores de Estrategia](#44-motores-de-estrategia)
   - 4.5 [Módulo: Complex Simulation Engine](#45-módulo-complex-simulation-engine)
   - 4.6 [Módulo: Complex Risk Engine](#46-módulo-complex-risk-engine)
   - 4.7 [Módulo: Complex Report Engine](#47-módulo-complex-report-engine)
   - 4.8 [Handler Compartido: Strategy From Chain](#48-handler-compartido-strategy-from-chain)
   - 4.9 [Endpoints API](#49-endpoints-api)
5. [Frontend — Strategy Lab](#5-frontend--strategy-lab)
   - 5.1 [Estructura de Archivos](#51-estructura-de-archivos)
   - 5.2 [Componente: StrategyLab.tsx](#52-componente-strategylabtsx)
   - 5.3 [API Service: strategyApi.ts](#53-api-service-strategyapits)
   - 5.4 [Routing: App.tsx](#54-routing-apptsx)
6. [Flujo de Datos Completo](#6-flujo-de-datos-completo)
7. [Especificación de Tasks](#7-especificación-de-tasks)
8. [Arranque y Pruebas](#8-arranque-y-pruebas)

---

## 1. Resumen Ejecutivo

**TEAM-08** implementa un sistema completo de **Estrategias Complejas de Opciones** (Iron Condor, Iron Butterfly, Butterfly Spread, Condor) con datos **REALES de Alpaca Markets** — cero datos mock, cero defaults hardcodeados.

### ¿Qué problema resuelve?

Las estrategias complejas de opciones (multi-pata) son difíciles de construir y evaluar manualmente. TEAM-08 automatiza:

1. **Consulta de options chain real** — strikes, bid/ask, griegas desde Alpaca
2. **Construcción automática de estrategias** — el usuario selecciona strikes y el motor valida y calcula el perfil completo
3. **Simulación Monte Carlo** — distribución de P&L, probabilidad de éxito, Sharpe ratio
4. **Evaluación de riesgo** — 10 controles distintos (pérdida máxima, margen, DTE, asignación temprana, etc.)
5. **Reportes completos** — curvas de payoff, heatmaps P&L, resumen ejecutivo

### Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js + Express + TypeScript |
| Frontend | React 18 + Vite + TailwindCSS |
| Datos de mercado | Alpaca Markets API (datos reales) |
| Charting | TradingView Lightweight Charts |
| Routing frontend | Hash-based (sin dependencias) |

---

## 2. Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (PWA)                         │
│  localhost:5173                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  App.tsx (hash-router)                                │   │
│  │  ├── MainDashboard (/)                                │   │
│  │  └── StrategyLab (#strategy-lab)                      │   │
│  │       ├── 📋 OptionsChainTab                          │   │
│  │       ├── 🔧 BuilderTab                               │   │
│  │       └── 📊 ResultadosTab                            │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (fetch)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND (REST API)                      │
│  localhost:3000                                              │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  index.ts (Express router)                               │ │
│  │                                                          │ │
│  │  /api/strategies/complex/                                │ │
│  │  ├── GET  /options-chain      → optionsChain.ts          │ │
│  │  ├── POST /from-chain         → fromChain.ts             │ │
│  │  ├── POST /iron-condor        → ironCondor.ts            │ │
│  │  ├── POST /iron-butterfly     → ironButterfly.ts         │ │
│  │  ├── POST /butterfly-spread   → butterflySpread.ts       │ │
│  │  └── POST /condor             → condor.ts                │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  strategyFromChainHandler.ts (SHARED HANDLER)            │ │
│  │  ├── 1. Fetch options chain from Alpaca                  │ │
│  │  ├── 2. Match strikes → resolve premiums                 │ │
│  │  ├── 3. Validate config with engine                      │ │
│  │  ├── 4. Calculate profile                                │ │
│  │  ├── 5. Run Monte Carlo simulation                       │ │
│  │  ├── 6. Evaluate risk                                    │ │
│  │  └── 7. Generate report                                  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│  │ IronCondor   │ │ IronButterfly│ │ Butterfly    │          │
│  │ Engine       │ │ Engine       │ │ Spread Engine│          │
│  └──────────────┘ └──────────────┘ └──────────────┘          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│  │ Condor       │ │ Simulation   │ │ Risk         │          │
│  │ Engine       │ │ Engine       │ │ Engine       │          │
│  └──────────────┘ └──────────────┘ └──────────────┘          │
│  ┌──────────────┐ ┌──────────────┐                            │
│  │ Report       │ │ Alpaca       │                            │
│  │ Engine       │ │ Options Svc  │                            │
│  └──────────────┘ └──────┬───────┘                            │
│                           │                                    │
└───────────────────────────┼────────────────────────────────────┘
                            │ HTTPS
                            ▼
              ┌─────────────────────────┐
              │   Alpaca Markets API     │
              │  (datos reales de mercado)│
              └─────────────────────────┘
```

---

## 3. Teoría de Estrategias

### 3.1 Iron Condor

#### ¿Qué es?

Un **Iron Condor** es una estrategia de **4 patas** que se beneficia de la **baja volatilidad** y el movimiento lateral del subyacente. Es una estrategia de **crédito** (recibes prima neta al abrirla).

#### Estructura

```
Pata 1: COMPRAR Put OTM (strike más bajo)     → Long Put
Pata 2: VENDER Put OTM (strike más alto)       → Short Put
Pata 3: VENDER Call OTM (strike más bajo)      → Short Call
Pata 4: COMPRAR Call OTM (strike más alto)     → Long Call
```

Las 4 patas tienen el mismo **vencimiento**. Los strikes están ordenados:

```
[Long Put] -- [Short Put] -- [Short Call] -- [Long Call]
   $190          $195           $205            $210
```

#### Perfil de Riesgo/Beneficio

| Métrica | Valor |
|---------|-------|
| **Tipo** | Crédito (recibes prima neta) |
| **Ganancia máxima** | Prima neta recibida |
| **Pérdida máxima** | Ancho del ala — prima neta |
| **Break-evens** | Short Put strike — prima recibida (inferior) |
| | Short Call strike + prima recibida (superior) |

#### ¿Cuándo usarlo?

- Cuando esperas que el subyacente **se mantenga dentro de un rango** hasta el vencimiento
- En mercados laterales o de baja volatilidad (IV alta es ideal para recibir más prima)
- El activo tiene strikes con suficiente liquidez

#### Variantes

| Tipo | Descripción |
|------|-------------|
| **Short Condor** | Estándar — alas equidistantes, ganancia máxima entre los strikes cortos |
| **Wide Condor** | Alas más anchas — mayor probabilidad de ganancia pero menor prima |
| **Broken Wing** | Un ala más ancha que la otra — sesgo direccional |

#### Ejemplo con SPY

```
SPY a $545. Supongamos Iron Condor a 45 DTE:

- Comprar Put $530 @ $1.20  (paga $120)
- Vender Put $535 @ $1.80  (recibe $180)
- Vender Call $555 @ $1.50 (recibe $150)
- Comprar Call $560 @ $0.90 (paga $90)

Crédito neto: $180 + $150 - $120 - $90 = $120
Ganancia máxima: $120
Pérdida máxima: ($535 - $530) × 100 - $120 = $380
Break-evens: $533.80 y $556.20
```

---

### 3.2 Iron Butterfly

#### ¿Qué es?

Un **Iron Butterfly** es una estrategia de **4 patas** con un **strike central común** (body). Es similar al Iron Condor pero con una zona de ganancia más estrecha y mayor prima. También es una estrategia de **crédito**.

#### Estructura

```
Pata 1: COMPRAR Put OTM (strike más bajo)  → Long Put
Pata 2: VENDER Put ATM (strike medio)       → Short Put
Pata 3: VENDER Call ATM (strike medio)      → Short Call
Pata 4: COMPRAR Call OTM (strike más alto)  → Long Call
```

Las patas 2 y 3 comparten el **mismo strike** (el cuerpo):

```
[Long Put] -- [Short Put = Short Call] -- [Long Call]
   $535              $545                     $555
```

#### Perfil de Riesgo/Beneficio

| Métrica | Valor |
|---------|-------|
| **Tipo** | Crédito (recibes prima neta) |
| **Ganancia máxima** | Prima neta recibida |
| **Pérdida máxima** | Ancho del ala — prima neta |
| **Break-evens** | Body strike ± prima recibida |

#### ¿Cuándo usarlo?

- Cuando esperas que el subyacente **termine exactamente en el strike ATM**
- En mercados muy laterales o con baja volatilidad esperada
- Ofrece mejor prima que el Iron Condor pero menos margen de error

#### Variantes

| Tipo | Descripción |
|------|-------------|
| **Short Butterfly** | Estándar — alas simétricas alrededor del body ATM |
| **Broken Wing** | Un ala más ancha que la otra — elimina riesgo de un lado a cambio de menor prima |

#### Ejemplo con SPY

```
SPY a $545. Iron Butterfly a 45 DTE:

- Comprar Put $535 @ $1.20
- Vender Put $545 @ $3.50
- Vender Call $545 @ $3.20
- Comprar Call $555 @ $1.00

Crédito neto: $3.50 + $3.20 - $1.20 - $1.00 = $4.50
Ganancia máxima: $450
Pérdida máxima: ($545 - $535) × 100 - $450 = $550 (por lado)
Break-evens: $540.50 y $549.50
```

> **Diferencia clave con Iron Condor:** El Iron Butterfly tiene los dos strikes cortos en el mismo precio (ATM), lo que da una prima más alta pero una zona de ganancia más estrecha. El Iron Condor separa los strikes cortos, dando una zona de ganancia más amplia pero menor prima.

---

### 3.3 Butterfly Spread

#### ¿Qué es?

Un **Butterfly Spread** (Call Butterfly o Put Butterfly) es una estrategia de **3 patas** del **mismo tipo** (todas calls o todas puts). Es una estrategia de **débito** (pagas prima neta).

#### Estructura

```
Call Butterfly:
Pata 1: COMPRAR 1 Call (strike inferior)    → Long Call
Pata 2: VENDER 2 Calls (strike medio)       → Short Call ×2
Pata 3: COMPRAR 1 Call (strike superior)    → Long Call

Put Butterfly:
Pata 1: COMPRAR 1 Put (strike inferior)     → Long Put
Pata 2: VENDER 2 Puts (strike medio)        → Short Put ×2
Pata 3: COMPRAR 1 Put (strike superior)     → Long Put
```

Strikes equidistantes:

```
[Long Call] -- [Short Call ×2] -- [Long Call]
   $540            $545              $550
```

#### Perfil de Riesgo/Beneficio

| Métrica | Valor |
|---------|-------|
| **Tipo** | Débito (pagas prima neta) |
| **Ganancia máxima** | Diferencia entre strikes — débito neto |
| **Pérdida máxima** | Débito neto pagado |
| **Break-evens** | Strike inferior + débito neto (call) |
| | Strike superior — débito neto (put) |

#### ¿Cuándo usarlo?

- Cuando esperas que el subyacente **termine exactamente en el strike medio**
- Es la estrategia con **menor riesgo** (riesgo limitado al débito pagado)
- Útil para apostar por un precio objetivo específico

#### Ejemplo con SPY

```
Call Butterfly SPY $540/$545/$550:

- Comprar 1 Call $540 @ $6.50
- Vender 2 Calls $545 @ $4.00 c/u (recibe $8.00)
- Comprar 1 Call $550 @ $2.00

Débito neto: $6.50 + $2.00 - $8.00 = $0.50
Ganancia máxima: ($545 - $540) × 100 - $50 = $450
Pérdida máxima: $50
Break-even: $540.50
```

---

### 3.4 Condor

#### ¿Qué es?

Un **Condor** (Call Condor o Put Condor) es una estrategia de **4 patas** del **mismo tipo** (todas calls o todas puts). Es similar al Butterfly pero con **dos strikes cortos separados**, creando una meseta de ganancia más amplia.

#### Estructura

```
Call Condor:
Pata 1: COMPRAR 1 Call (strike inferior)      → Long Call
Pata 2: VENDER 1 Call (strike medio-inferior) → Short Call
Pata 3: VENDER 1 Call (strike medio-superior) → Short Call
Pata 4: COMPRAR 1 Call (strike superior)      → Long Call
```

Strikes equidistantes:

```
[Long Call] -- [Short Call] -- [Short Call] -- [Long Call]
   $535           $540           $545            $550
```

#### Perfil de Riesgo/Beneficio

| Métrica | Valor |
|---------|-------|
| **Tipo** | Débito (pagas prima neta, normalmente menor que Butterfly) |
| **Ganancia máxima** | Entre los dos strikes cortos |
| **Pérdida máxima** | Débito neto pagado |
| **Break-evens** | Strike inferior + débito neto |
| | Strike superior — débito neto |

#### ¿Cuándo usarlo?

- Cuando esperas que el subyacente **termine entre los dos strikes medios**
- Ofrece una **meseta de ganancia** (no solo un punto como el Butterfly)
- Menor prima que el Butterfly pero mayor probabilidad de éxito

#### Diferencia con Butterfly Spread

| Aspecto | Butterfly | Condor |
|---------|-----------|--------|
| Patas | 3 | 4 |
| Short strikes | 1 (×2 contratos) | 2 (1 contrato c/u) |
| Zona de ganancia | Punto exacto (strike medio) | Meseta (entre strikes medios) |
| Prima | Mayor débito | Menor débito |
| Probabilidad de éxito | Menor | Mayor |

---

## 4. Backend — API REST

### 4.1 Estructura de Archivos

```
projects/rest-api/inversions_api/src/
├── index.ts                                              # Entry point — monta todos los routers
│
├── modules/
│   └── strategies/
│       └── complex/
│           ├── alpacaOptionsService.ts                   # 🔌 Conexión con Alpaca Markets API
│           ├── complexStrategyContract.ts                 # 📜 Contrato base: tipos, interfaces, validación
│           ├── ironCondorEngine.ts                       # 🏭 Motor de Iron Condor
│           ├── ironButterflyEngine.ts                    # 🏭 Motor de Iron Butterfly
│           ├── butterflySpreadEngine.ts                  # 🏭 Motor de Butterfly Spread
│           ├── condorEngine.ts                           # 🏭 Motor de Condor
│           ├── complexSimulationEngine.ts                # 🎲 Simulación Monte Carlo + determinística
│           ├── complexRiskEngine.ts                      # 🛡️ Evaluación de riesgo (10 controles)
│           └── complexReportEngine.ts                    # 📊 Generación de reportes
│
└── routes/
    └── strategies/
        └── complex/
            ├── strategyFromChainHandler.ts               # 🧠 Handler compartido (toda la lógica central)
            ├── fromChain.ts                              # POST /from-chain (endpoint universal)
            ├── optionsChain.ts                           # GET /options-chain
            ├── ironCondor.ts                             # POST /iron-condor (legacy)
            ├── ironButterfly.ts                          # POST /iron-butterfly (legacy)
            ├── butterflySpread.ts                        # POST /butterfly-spread (legacy)
            └── condor.ts                                 # POST /condor (legacy)
```

### 4.2 Módulo: Alpaca Options Service

**Archivo:** `alpacaOptionsService.ts`

#### Propósito

Servicio que se conecta a la API de **Alpaca Markets** para obtener datos reales de opciones. Combina dos endpoints:

1. **`/v2/options/contracts`** — Metadatos de contratos (strikes, vencimientos, tipo)
2. **`/v1beta1/options/snapshots`** — Datos de mercado en tiempo real (bid/ask, griegas)

#### Configuración

Requiere variables de entorno:
```
ALPACA_API_KEY=your_paper_api_key
ALPACA_SECRET_KEY=your_paper_secret_key
```

Usa **Alpaca Paper Trading API** por defecto (`https://paper-api.alpaca.markets`).  
Los snapshots vienen del endpoint de datos (`https://data.alpaca.markets`).

#### Interfaces Principales

```typescript
interface OptionChainEntry {
  symbol: string;        // Símbolo del contrato en Alpaca
  strike: number;        // Precio de ejercicio
  tipo: "call" | "put"; // Tipo de opción
  expiracion: string;    // Fecha de vencimiento
  bid: number | null;    // Precio bid actual
  ask: number | null;    // Precio ask actual
  mid: number | null;    // Precio medio (bid+ask)/2
  estilo: string;        // Estilo (americana/europea)
  tradable: boolean;     // Si es negociable
  greeks?: {             // Griegas (delta, gamma, theta, vega, IV)
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    implied_volatility: number;
  };
}

interface OptionsChain {
  ticker: string;                    // Ticker subyacente
  expiracion: string;                // Vencimiento
  subyacente_precio: number | null;  // Precio del subyacente
  entries: OptionChainEntry[];       // Todos los contratos
  grouped: {                         // Agrupados por tipo
    calls: OptionChainEntry[];
    puts: OptionChainEntry[];
  };
}
```

#### Métodos

| Método | Descripción |
|--------|-------------|
| `getOptionsChain(ticker, expiration?)` | Obtiene options chain completa con bid/ask |
| `fetchContracts(ticker, expiration?)` | Consulta contratos de Alpaca (batching automático) |
| `fetchSnapshots(symbols)` | Consulta snapshots con bid/ask/griegas (batching de 100) |

#### Manejo de Errores

- Si las API keys no existen → Error `ALPACA_API_KEY and ALPACA_SECRET_KEY must be set`
- Si la API responde 401/403 → Error de autenticación mapeado a HTTP 502
- Timeouts y errores de red → Error genérico `Alpaca API error`

---

### 4.3 Módulo: Complex Strategy Contract

**Archivo:** `complexStrategyContract.ts`

#### Propósito

Define el **contrato base** que todas las estrategias deben cumplir. Contiene:

- **Tipos compartidos** (OptionLeg, OptionType, LegPosition, WingType, etc.)
- **Interfaz `IComplexStrategyEngine`** que todos los motores implementan
- **Validación común** (validateCommonConfig — ticker, fechas, legs, primas)
- **Utilidades de cálculo** compartidas entre todos los motores

#### Interfaces Core

```typescript
interface OptionLeg {
  strike: number;
  tipo: "call" | "put";
  posicion: "long" | "short";
  prima: number;
  contratos: number;
  bid?: number;
  ask?: number;
  subyacente_precio?: number;
  volatilidad_implicita?: number;
}

interface ComplexStrategyConfig {
  ticker: string;
  expiracion: string;
  legs: OptionLeg[];
  tipo_ala: "short" | "wide" | "broken";
  tolerancia_riesgo: "bajo" | "medio" | "alto";
  estilo_opcion: "europea" | "americana";
  version: number;
  id?: string;
  trace_id?: string;
  dias_vencimiento?: number;
  etiqueta?: string;
}

interface StrategyProfile {
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

#### Utilidades de Cálculo

| Función | Propósito |
|---------|-----------|
| `calculateLegPayoff(leg, price)` | Payoff individual de una pata |
| `generatePayoffCurve(legs, min, max, steps)` | Curva de payoff completa |
| `findBreakEvens(payoffCurve)` | Puntos de equilibrio (interpolación lineal) |
| `calculateNetCredit(legs)` | Crédito/débito neto |
| `calculateMaxLoss(payoffCurve)` | Pérdida máxima |
| `calculateMaxGain(payoffCurve)` | Ganancia máxima |
| `generatePriceRange(legs, margin)` | Rango de precios para gráficos |
| `calculateWingWidth(lower, upper)` | Ancho de ala |

---

### 4.4 Motores de Estrategia

Cada motor implementa la interfaz `IComplexStrategyEngine`:

```typescript
interface IComplexStrategyEngine {
  validateConfig(config: ComplexStrategyConfig): StrategyValidationResult;
  calculateProfile(config: ComplexStrategyConfig): StrategyProfile;
}
```

#### 4.4.1 IronCondorEngine

**Archivo:** `ironCondorEngine.ts`

| Aspecto | Detalle |
|---------|---------|
| **Patas** | 4 (2 puts + 2 calls) |
| **Validación** | Long put < Short put < Short call < Long call |
| **Cálculo** | Genera payoff, creditos, breakevens, pérdida/ganancia máxima |
| **Payoff temporal** | 3 curvas: DTE actual, 66% DTE, 33% DTE (theta decay simplificado) |
| **Variantes** | short, wide |

#### 4.4.2 IronButterflyEngine

**Archivo:** `ironButterflyEngine.ts`

| Aspecto | Detalle |
|---------|---------|
| **Patas** | 4 (2 puts + 2 calls) |
| **Validación** | Long put < [Short Put = Short Call] < Long Call |
| **Regla clave** | Los strikes del cuerpo (short put y short call) DEBEN coincidir |
| **Variantes** | short (alas simétricas), broken (alas asimétricas) |
| **Broken wing** | Detecta sesgo: ala put más ancha = bajista, ala call más ancha = alcista |

#### 4.4.3 ButterflySpreadEngine

**Archivo:** `butterflySpreadEngine.ts`

| Aspecto | Detalle |
|---------|---------|
| **Patas** | 3 (mismo tipo: todas calls o todas puts) |
| **Validación** | Long lower, Short medio ×2, Long upper; strikes equidistantes |
| **Cálculo** | Ventana óptima de beneficio |
| **IV Skew** | Advierte si hay diferencia de IV > 5% entre alas |

#### 4.4.4 CondorEngine

**Archivo:** `condorEngine.ts`

| Aspecto | Detalle |
|---------|---------|
| **Patas** | 4 (mismo tipo: todas calls o todas puts) |
| **Validación** | Long lower, Short lower-mid, Short upper-mid, Long upper; equidistantes |
| **Meseta** | Calcula zona de ganancia máxima entre los dos strikes cortos |
| **Métricas** | Ancho de ala, ancho de cuerpo, credit spread ratio |

---

### 4.5 Módulo: Complex Simulation Engine

**Archivo:** `complexSimulationEngine.ts`

#### Propósito

Ejecuta **simulaciones** para estimar la distribución de resultados de una estrategia.

#### Tipos de Simulación

| Tipo | Descripción | Iteraciones |
|------|-------------|-------------|
| **Monte Carlo** | Movimiento browniano geométrico con shocks de precio aleatorios | 1K–100K (default 10K) |
| **Determinística** | Escenarios fijos de precio (±30%, ±20%, ±10%, ±5%, 0) × shocks de IV | 45 escenarios |
| **Backtesting** | Evalúa contra datos históricos reales | Según datos disponibles |

#### Implementación PRNG

Usa **Mulberry32** — un generador de números aleatorios con semilla (seed) para **reproducibilidad**. No requiere dependencias externas.

```typescript
const rng = new SeededRandom(seed);  // Misma semida = mismos resultados
const price = basePrice * (1 + shock * rng.nextGaussian());
```

#### Salida de Simulación

```typescript
interface SimulationResult {
  tipo: SimulationType;
  total_iteraciones: number;
  probabilidad_exito: number;      // % de escenarios con P&L > 0
  rendimiento_esperado: number;     // P&L promedio
  drawdown_maximo: number;          // Mayor caída desde pico
  ratio_sharpe: number;             // Retorno / desviación estándar
  distribucion_pnl: {
    media: number;
    mediana: number;
    desviacion_estandar: number;
    percentil_5: number;
    percentil_95: number;
    maximo: number;
    minimo: number;
  };
  escenarios: {
    mejor_caso: { precio: number; pnl: number; descripcion: string };
    peor_caso: { precio: number; pnl: number; descripcion: string };
    caso_base: { precio: number; pnl: number; descripcion: string };
  };
  costos_totales: number;
  costos_detalle: {
    slippage_total: number;     // 0.1% del premium
    comisiones_totales: number; // $0.65/contrato + $1 base
    spread_total: number;       // 2% del premium
  };
}
```

---

### 4.6 Módulo: Complex Risk Engine

**Archivo:** `complexRiskEngine.ts`

#### Propósito

Evalúa **10 controles de riesgo** distintos sobre una estrategia y produce una evaluación completa con puntaje, eventos y acción recomendada.

#### Perfiles de Riesgo

| Perfil | Pérdida Máx | Margen Máx | Contratos | Riesgo % | DTE Mín | IV Máx |
|--------|-------------|------------|-----------|----------|---------|--------|
| **Conservador** | $500 | $2,000 | 5 | 2% | 21 | 50% |
| **Moderado** | $2,000 | $10,000 | 20 | 5% | 14 | 70% |
| **Agresivo** | $10,000 | $50,000 | 100 | 15% | 7 | 90% |

#### Los 10 Controles de Riesgo

| # | Control | Bloquea |
|---|---------|---------|
| 1 | **Kill-switch** — ¿El ticker está en lista negra? | ✅ Sí |
| 2 | **Pérdida máxima** — ¿Excede el límite del perfil? | ✅ Sí |
| 3 | **Contratos máximos** — ¿Excede el límite? | ✅ Sí |
| 4 | **Riesgo del portafolio** — ¿Excede el % del portafolio? | ✅ Sí |
| 5 | **Poder de compra** — ¿La pérdida potencial excede el poder de compra? | ✅ Sí |
| 6 | **Probabilidad de éxito** — ¿Menor al 20%? | ❌ No (warning) |
| 7 | **DTE mínimo** — ¿Muy cerca del vencimiento (< 7 días)? | ✅ Sí (< 7) |
| 8 | **Asignación temprana** — ¿Opción americana ITM short con DTE ≤ 14? | ✅ Sí |
| 9 | **Drawdown máximo** — ¿Excede el límite del perfil? | ✅ (si stop-loss auto) |
| 10 | **Sharpe negativo** — ¿Rendimiento esperado negativo? | ❌ No (warning) |

#### Kill-Switch

El Risk Engine incluye un sistema de **kill-switch** que permite bloquear operaciones para un ticker específico:

```typescript
riskEngine.activateKillSwitch("SPY", "Volatilidad extrema detectada", "admin");
riskEngine.getKillSwitchStatus("SPY"); // { activo: true, motivo: "...", ... }
riskEngine.deactivateKillSwitch("SPY");
```

---

### 4.7 Módulo: Complex Report Engine

**Archivo:** `complexReportEngine.ts`

#### Propósito

Genera **reportes estructurados** combinando el perfil de la estrategia, la simulación y la evaluación de riesgo.

#### Formatos de Salida

| Formato | Descripción |
|---------|-------------|
| **Reporte completo** | JSON con metadata, perfil, payoff, heatmap, simulación, riesgo |
| **Resumen ejecutivo** | Payload ligero para dashboards |
| **CSV** | Array de filas listo para exportar |
| **JSON serializado** | `JSON.stringify(report, null, 2)` |

#### Estructura del Reporte

```typescript
interface ComplexReport {
  metadata: {
    ticker: string;
    tipo_estrategia: string;
    fecha_analisis: string;
    tiempo_calculo_ms: number;
  };
  perfil: {
    credito_neto: number;
    tipo_neto: "credito" | "debito";
    perdida_maxima: number;
    ganancia_maxima: number;
    ratio_riesgo_beneficio: number;
    break_even_points: number[];
  };
  payoff: {
    expiracion: AnnotatedPayoffCurve;    // Curva al vencimiento con anotaciones
    temporal?: AnnotatedPayoffCurve;      // Curvas temporales (theta decay)
  };
  heatmap?: {
    celdas: HeatmapCell[];               // 8 DTEs × 20 precios = 160 celdas
    precio_min: number;
    precio_max: number;
    dte_max: number;
    pnl_min: number;
    pnl_max: number;
  };
  simulacion: { /* resumen */ };
  riesgo: { /* resumen */ };
}
```

---

### 4.8 Handler Compartido: Strategy From Chain

**Archivo:** `strategyFromChainHandler.ts`

#### Propósito

Es el **cerebro** de TEAM-08. Todos los endpoints de estrategia (from-chain, iron-condor, iron-butterfly, etc.) **delegan a este handler** para garantizar:

- ✅ Datos siempre de Alpaca (cero datos mock)
- ✅ Misma lógica de validación para todos los endpoints
- ✅ Errores mapeados a códigos HTTP consistentes

#### Pipeline Completo (7 pasos)

```
Request (strikes, tipo_estrategia, portfolio)
    │
    ▼
┌────────────────────────────────────────────────────────────┐
│  Paso 1: Fetch options chain real de Alpaca                │
│  (getOptionsChain → contracts + snapshots)                  │
└────────────────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────────────────┐
│  Paso 2: Match strikes + resolver primas                   │
│  - Busca cada strike solicitado en los contratos reales    │
│  - Usa mid price; fallback bid para short, ask para long   │
│  - Si un strike no existe → UnmatchedStrikesError (400)    │
└────────────────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────────────────┐
│  Paso 3: Calcular DTE                                     │
│  - Usa request.dias_vencimiento o lo calcula de la fecha   │
└────────────────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────────────────┐
│  Paso 4: Construir ComplexStrategyConfig                   │
│  - ticker, expiracion real, legs con primas reales         │
│  - tipo_ala, tolerancia, estilo_opcion                     │
└────────────────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────────────────┐
│  Paso 5: Ejecutar motor de estrategia                      │
│  - Validar config → calculateProfile                       │
│  - Engine seleccionado según strategy_type                 │
└────────────────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────────────────┐
│  Paso 6: Simulación + Riesgo + Reporte                     │
│  - Monte Carlo (10K iteraciones)                           │
│  - Risk evaluation (10 controles)                          │
│  - Generate report completo + summary                      │
└────────────────────────────────────────────────────────────┘
    │
    ▼
Response (StrategyChainResult)
```

#### Clases de Error

| Error | HTTP | Causa |
|-------|------|-------|
| `ChainNotFoundError` | 404 | No hay opciones para el ticker/vencimiento |
| `UnmatchedStrikesError` | 400 | Strikes solicitados no existen en la chain |
| `AlpacaAuthError` | 502 | Error de autenticación con Alpaca |
| Error genérico | 500 | Error interno |

El error `UnmatchedStrikesError` es especialmente útil porque **devuelve los strikes disponibles** para que el usuario pueda corregir su selección:

```json
{
  "error": "Los siguientes strikes no se encontraron en la options chain de SPY:",
  "unmatched": [{"strike": 550, "tipo": "call"}],
  "available_summary": {
    "ticker": "SPY",
    "call_strikes": [530, 535, 540, 545, 555, 560],
    "put_strikes": [530, 535, 540, 545, 555, 560]
  }
}
```

---

### 4.9 Endpoints API

#### `GET /api/strategies/complex/options-chain`

Obtiene la options chain real de Alpaca para un ticker.

**Query params:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `ticker` | string | ✅ | Símbolo (SPY, AAPL, MSFT, etc.) |
| `expiration` | string | ❌ | Vencimiento (YYYY-MM-DD). Default: nearest active |

**Response (200):**
```json
{
  "ticker": "SPY",
  "expiracion": "2026-06-19",
  "total_contratos": 120,
  "total_calls": 60,
  "total_puts": 60,
  "resumen": {
    "call_strike_min": 500,
    "call_strike_max": 600,
    "put_strike_min": 500,
    "put_strike_max": 600
  },
  "grouped": {
    "calls": [
      {
        "symbol": "SPY260619C00540000",
        "strike": 540,
        "tipo": "call",
        "bid": 8.50,
        "ask": 8.70,
        "mid": 8.60,
        "greeks": { "delta": 0.65, "gamma": 0.02, "theta": -0.15, "vega": 0.30, "implied_volatility": 0.22 }
      }
    ],
    "puts": [ /* ... */ ]
  }
}
```

---

#### `POST /api/strategies/complex/from-chain`

**Endpoint universal.** Construye cualquier estrategia desde datos reales de la options chain.

**Body:**
```json
{
  "strategy_type": "iron_condor",
  "ticker": "SPY",
  "expiracion": "2026-06-19",
  "contratos": 1,
  "tipo_ala": "short",
  "tolerancia_riesgo": "medio",
  "estilo_opcion": "americana",
  "strikes": [
    { "strike": 530, "tipo": "put", "posicion": "long" },
    { "strike": 535, "tipo": "put", "posicion": "short" },
    { "strike": 555, "tipo": "call", "posicion": "short" },
    { "strike": 560, "tipo": "call", "posicion": "long" }
  ],
  "portfolio": {
    "valor_portafolio_usd": 100000,
    "poder_compra_usd": 50000,
    "margen_actual_usd": 0,
    "posiciones_actuales": 0
  }
}
```

**Response (200)** — Objeto masivo con:

| Campo | Descripción |
|-------|-------------|
| `strategy_type` | Tipo de estrategia ejecutada |
| `premiums_used` | Array de primas reales obtenidas de Alpaca |
| `validation` | Advertencias de validación |
| `profile` | Perfil completo (credito, breakevens, payoff) |
| `simulation` | Resultados de Monte Carlo |
| `risk` | Evaluación de riesgo |
| `report` | Reporte completo con heatmap |
| `summary` | Resumen ejecutivo |

---

#### Endpoints Legacy (refactorizados)

| Endpoint | Método | Strategy Type |
|----------|--------|---------------|
| `/api/strategies/complex/iron-condor` | POST | `iron_condor` |
| `/api/strategies/complex/iron-butterfly` | POST | `iron_butterfly` |
| `/api/strategies/complex/butterfly-spread` | POST | `butterfly_spread` |
| `/api/strategies/complex/condor` | POST | `condor` |

Cada uno delega internamente a `buildStrategyFromChain()` con el `strategy_type` fijo.  
El body y response son equivalentes al endpoint `from-chain`.

---

## 5. Frontend — Strategy Lab

### 5.1 Estructura de Archivos

```
projects/pwa/inversions_app/src/
├── App.tsx                                          # Router hash-based
├── main.tsx                                         # Entry point (renderiza <App />)
│
├── features/
│   ├── dashboard/
│   │   └── MainDashboard.tsx                        # Dashboard con botón 🧪 Strategy Lab
│   │
│   └── strategies/
│       └── StrategyLab.tsx                          # ⭐ Página completa del Lab (3 tabs)
│
└── services/
    └── strategies/
        └── strategyApi.ts                           # API service con tipos y fetch
```

### 5.2 Componente: StrategyLab.tsx

#### Estructura General

```
┌─────────────────────────────────────────────────────────────┐
│  [← Dashboard]  🧪 Strategy Lab                             │
│                                                              │
│  ┌──────────┬──────────┬──────────┐                          │
│  │ 📋 Chain │ 🔧 Builder│ 📊 Results│                         │
│  └──────────┴──────────┴──────────┘                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  [Tab content based on activeTab]                     │   │
│  │                                                       │   │
│  │  1. OptionsChainTab — Consulta de options chain       │   │
│  2. BuilderTab — Configuración y ejecución             │   │
│  3. ResultadosTab — Payoff, riesgo, simulación         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### Tab 1: 📋 Options Chain

| Elemento | Descripción |
|----------|-------------|
| Input ticker | Campo de texto para símbolo (SPY, AAPL, etc.) |
| Input expiration | Fecha opcional (YYYY-MM-DD) |
| Botón "Consultar" | Ejecuta `GET /options-chain` |
| Tabla de resultados | Muestra strikes, bid, ask, mid, delta, gamma, theta, vega, IV |
| Estados | Loading spinner, error, sin datos |

#### Tab 2: 🔧 Builder

| Elemento | Descripción |
|----------|-------------|
| Selector de estrategia | Dropdown: Iron Condor, Iron Butterfly, Butterfly Spread, Condor |
| Selección de strikes | Define patas: strike, tipo (call/put), posición (long/short) |
| Contratos | Número de contratos por pata |
| Tipo de ala | short / wide / broken (según estrategia) |
| Tolerancia de riesgo | bajo / medio / alto |
| Datos de portafolio | Valor del portafolio, poder de compra |
| Botón "Ejecutar Estrategia" | Construye con datos reales de Alpaca |

#### Tab 3: 📊 Resultados

| Sección | Contenido |
|---------|-----------|
| **Primas Usadas** | Tabla con strikes, tipo, posición, prima (mid), bid, ask, IV |
| **Resumen del Perfil** | Crédito/débito neto, pérdida máxima, ganancia máxima, ratio R/R, break-evens |
| **Payoff Chart** | SVG interactivo — curva de P&L al vencimiento vs precio del subyacente |
| **Payoff Temporal** | Curvas a diferentes DTE (efecto theta decay) |
| **Heatmap P&L** | Tabla de calor precio × tiempo (opcional) |
| **Simulación Monte Carlo** | Probabilidad de éxito, rendimiento esperado, Sharpe, drawdown |
| **Evaluación de Riesgo** | Puntaje (0-100), eventos detectados, acción recomendada |
| **Distribución de P&L** | Media, mediana, percentiles 5/95, desviación estándar |

#### Estados de UI

Cada tab maneja:

- **Loading:** Spinner con texto descriptivo
- **Error:** Mensaje de error con detalle y acciones sugeridas
- **Sin datos:** Mensaje informativo con instrucciones
- **Éxito:** Datos completos renderizados

### 5.3 API Service: strategyApi.ts

**Archivo:** `strategyApi.ts`

```typescript
// Tipos exportados
export interface OptionsChainResponse { /* ... */ }
export interface StrategyChainRequest { /* ... */ }
export interface StrategyChainResponse { /* ... */ }

// Funciones
export async function getOptionsChain(ticker, expiration?): Promise<OptionsChainResponse>
export async function executeStrategy(request: StrategyChainRequest): Promise<StrategyChainResponse>
```

#### Manejo de errores

- Errores HTTP 4xx/5xx → Lanzan `Error` con mensaje descriptivo
- Errores de red → Lanzan `Error` con mensaje de conexión
- Errores 502 de Alpaca → Mensaje claro sobre API keys

### 5.4 Routing: App.tsx

**Archivo:** `App.tsx`

Implementa routing **hash-based** sin dependencias externas:

```typescript
function App() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigateToLab = useCallback(() => { window.location.hash = "#strategy-lab"; }, []);
  const navigateToDashboard = useCallback(() => { window.location.hash = ""; }, []);

  if (hash === "#strategy-lab") {
    return <StrategyLab onBackToDashboard={navigateToDashboard} />;
  }

  return <MainDashboard onNavigateToLab={navigateToLab} />;
}
```

**Rutas:**

| Hash | Componente |
|------|------------|
| (vacío o `/`) | MainDashboard |
| `#strategy-lab` | StrategyLab |

---

## 6. Flujo de Datos Completo

### Flujo 1: Consultar Options Chain

```
Usuario (Frontend)                    Backend                    Alpaca API
      │                                 │                          │
      │  GET /options-chain?ticker=SPY  │                          │
      │────────────────────────────────►│                          │
      │                                 │                          │
      │                                 │  GET /v2/options/contracts│
      │                                 │  ?underlying_symbols=SPY │
      │                                 │─────────────────────────►│
      │                                 │                          │
      │                                 │  ← Option contracts      │
      │                                 │◄─────────────────────────│
      │                                 │                          │
      │                                 │  GET /v1beta1/options/   │
      │                                 │  snapshots?symbols=...   │
      │                                 │─────────────────────────►│
      │                                 │                          │
      │                                 │  ← Snapshots (bid/ask)   │
      │                                 │◄─────────────────────────│
      │                                 │                          │
      │  ← JSON con strikes + griegas   │                          │
      │◄────────────────────────────────│                          │
      │                                 │                          │
      │  Renderiza tabla de options     │                          │
      │  chain (bid/ask/mid/griegas)    │                          │
      │                                 │                          │
```

### Flujo 2: Ejecutar Estrategia

```
Usuario (Frontend)                    Backend                    Alpaca API
      │                                 │                          │
      │  1. Usuario selecciona:        │                          │
      │     - Estrategia: Iron Condor  │                          │
      │     - Strikes: 530/535/555/560 │                          │
      │     - Portfolio: $100K         │                          │
      │     - Contratos: 1             │                          │
      │                                 │                          │
      │  2. Click "Ejecutar"           │                          │
      │  POST /from-chain              │                          │
      │────────────────────────────────►│                          │
      │                                 │                          │
      │  3. Fetch options chain         │                          │
      │                                 │──── GET /contracts ────►│
      │                                 │◄─── contracts ─────────│
      │                                 │──── GET /snapshots ───►│
      │                                 │◄─── snapshots ─────────│
      │                                 │                          │
      │  4. Match strikes 530/535      │                          │
      │     contra datos reales         │                          │
      │     - 530 put bid: $1.20        │                          │
      │     - 535 put bid: $1.80        │                          │
      │     - 555 call bid: $1.50       │                          │
      │     - 560 call bid: $0.90       │                          │
      │                                 │                          │
      │  5. Validate Iron Condor        │                          │
      │     - 4 patas ✅                │                          │
      │     - 2 puts + 2 calls ✅       │                          │
      │     - Long put < Short put ✅   │                          │
      │     - Short call < Long call ✅ │                          │
      │                                 │                          │
      │  6. CalculateProfile            │                          │
      │     - Net credit: $120          │                          │
      │     - Max loss: $380            │                          │
      │     - BEs: $533.80 / $556.20   │                          │
      │     - Payoff curve (150 pts)    │                          │
      │                                 │                          │
      │  7. Simulate (10K Monte Carlo)  │                          │
      │     - Prob éxito: 72.3%         │                          │
      │     - Sharpe: 0.85              │                          │
      │     - Drawdown: $250            │                          │
      │                                 │                          │
      │  8. Evaluate Risk (10 checks)   │                          │
      │     - Todos los controles ✅    │                          │
      │     - Risk score: 15/100        │                          │
      │                                 │                          │
      │  9. Generate Report             │                          │
      │                                 │                          │
      │  ← Response completa            │                          │
      │◄────────────────────────────────│                          │
      │                                 │                          │
      │  10. Renderiza:                 │                          │
      │      - Payoff chart SVG         │                          │
      │      - Resumen perfil           │                          │
      │      - Simulación               │                          │
      │      - Evaluación de riesgo     │                          │
      │      - Primas reales usadas     │                          │
```

---

## 7. Especificación de Tasks

### Mapeo de Tasks TEAM-08 → Archivos

| Task | Descripción | Archivos |
|------|-------------|----------|
| T000 | Setup estructura de feature | `specs/` |
| T001 | Alpaca Options Service | `alpacaOptionsService.ts` |
| T002 | Complex Strategy Contract | `complexStrategyContract.ts` |
| T003 | Iron Condor Engine | `ironCondorEngine.ts` |
| T004 | Iron Butterfly Engine | `ironButterflyEngine.ts` |
| T005 | Butterfly Spread Engine | `butterflySpreadEngine.ts` |
| T006 | Condor Engine | `condorEngine.ts` |
| T007 | Complex Simulation Engine | `complexSimulationEngine.ts` |
| T008 | Complex Risk Engine | `complexRiskEngine.ts` |
| T009 | Complex Report Engine | `complexReportEngine.ts` |
| T010 | Shared Strategy Handler | `strategyFromChainHandler.ts` |
| T011 | From-Chain API Route | `fromChain.ts` |
| T012 | Options Chain API Route | `optionsChain.ts` |
| T013 | Legacy Routes (refactor) | `ironCondor.ts`, `ironButterfly.ts`, `butterflySpread.ts`, `condor.ts` |
| T014 | Route Wiring in index.ts | `index.ts` |
| T015 | Frontend: API Service | `strategyApi.ts` |
| T016 | Frontend: Strategy Lab Page | `StrategyLab.tsx` |
| T017 | Frontend: App Router | `App.tsx` |
| T018 | Frontend: Dashboard Button | `MainDashboard.tsx` |

### Dependencias

```
T000 (setup)
  │
  ├── T001 (Alpaca Service) ───┐
  ├── T002 (Contract) ─────────┤
  │                            │
  ├── T003 (Iron Condor) ──────┤
  ├── T004 (Iron Butterfly) ───┤
  ├── T005 (Butterfly Spread) ─┼── T010 (Shared Handler) ── T011 (From-Chain Route)
  ├── T006 (Condor) ───────────┤         │                          │
  │                            │         ├── T012 (Options Chain)   │
  ├── T007 (Simulation) ───────┘         │                          │
  ├── T008 (Risk Engine) ────────────────┘                          │
  └── T009 (Report Engine) ─────────────────────────────────────────┘
                                                                      │
                                            T013 (Legacy Routes) ─────┘
                                                                      │
                                            T014 (Route Wiring) ──────┘
                                                                      │
                                            T015 (Frontend API) ──────┐
                                            T016 (Strategy Lab) ──────┤
                                            T017 (App Router) ────────┤
                                            T018 (Dashboard Button) ──┘
```

---

## 8. Arranque y Pruebas

### Requisitos

- Node.js 22 LTS
- Cuenta de Alpaca Markets (Paper Trading)
- Variables de entorno configuradas

### Variables de Entorno

```bash
# projects/rest-api/inversions_api/.env
ALPACA_API_KEY=your_paper_api_key
ALPACA_SECRET_KEY=your_paper_secret_key
JWT_SECRET=your_jwt_secret
AUTH_BYPASS=true  # Para pruebas locales
```

### Arranque

```bash
# 1. Backend (puerto 3000)
cd projects/rest-api/inversions_api
AUTH_BYPASS=true NODE_ENV=development npx tsx src/index.ts

# 2. Frontend (puerto 5173)
cd projects/pwa/inversions_app
npx vite --host
```

### Acceso

| URL | Contenido |
|-----|-----------|
| `http://localhost:3000/health` | Health check backend |
| `http://localhost:5173/` | Dashboard principal |
| `http://localhost:5173/#strategy-lab` | 🧪 Strategy Lab |

### Prueba Rápida con curl

```bash
# 1. Consultar options chain de SPY
curl "http://localhost:3000/api/strategies/complex/options-chain?ticker=SPY"

# 2. Construir Iron Condor real
curl -X POST http://localhost:3000/api/strategies/complex/from-chain \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "strategy_type": "iron_condor",
    "ticker": "SPY",
    "strikes": [
      {"strike": 530, "tipo": "put", "posicion": "long"},
      {"strike": 535, "tipo": "put", "posicion": "short"},
      {"strike": 555, "tipo": "call", "posicion": "short"},
      {"strike": 560, "tipo": "call", "posicion": "long"}
    ],
    "portfolio": {
      "valor_portafolio_usd": 100000,
      "poder_compra_usd": 50000,
      "margen_actual_usd": 0,
      "posiciones_actuales": 0
    }
  }'
```

### Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| `ALPACA_API_KEY not set` | Faltan variables de entorno | Configurar `.env` o exportar variables |
| `Alpaca API error: 401` | API keys inválidas | Verificar keys en Alpaca Dashboard |
| `Error de autenticacion con Alpaca` | Keys no autorizadas para options | Activar options trading en cuenta paper |
| Ventana en blanco en frontend | Error de compilación | Abrir F12 → Console para ver error |
| `localhost` no carga en OperaGX | Resolución DNS IPv6 | Usar `http://127.0.0.1:5173/` |
| 400 Bad Request en from-chain | Portfolio no enviado | El body requiere `portfolio` completo |
| 400 Bad Request en from-chain | strategy_type inválido | Usar: iron_condor, iron_butterfly, butterfly_spread, condor |
| 404 en options-chain | Sin opciones para ticker | Verificar ticker y vencimiento |

---

## Apéndice A: Glosario

| Término | Definición |
|---------|-----------|
| **Pata (Leg)** | Una posición individual de opción dentro de una estrategia multi-pata |
| **Strike** | Precio de ejercicio de la opción |
| **ATM** | At The Money — strike más cercano al precio actual del subyacente |
| **OTM** | Out of The Money — strike sin valor intrínseco |
| **ITM** | In The Money — strike con valor intrínseco |
| **DTE** | Days To Expiration — días hasta el vencimiento |
| **Prima** | Precio de la opción (por acción) |
| **Crédito** | Estrategia donde recibes prima neta al abrir |
| **Débito** | Estrategia donde pagas prima neta al abrir |
| **Break-even** | Precio del subyacente donde P&L = 0 al vencimiento |
| **Payoff** | Gráfico de ganancia/pérdida vs precio del subyacente |
| **Theta Decay** | Pérdida de valor temporal de la opción con el paso del tiempo |
| **Delta** | Sensibilidad del precio de la opción al cambio en el subyacente |
| **Gamma** | Tasa de cambio de delta |
| **Vega** | Sensibilidad a la volatilidad implícita |
| **Theta** | Sensibilidad al paso del tiempo (decaimiento temporal) |
| **IV** | Implied Volatility — volatilidad implícita del mercado |
| **Ala (Wing)** | Las patas extremas de una estrategia (la más alejada del ATM) |
| **Monte Carlo** | Simulación que genera miles de escenarios aleatorios |

## Apéndice B: Estado de Archivos

### Backend (11 archivos, ~3000 líneas)

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `alpacaOptionsService.ts` | ~200 | Conexión con Alpaca Markets API |
| `complexStrategyContract.ts` | ~320 | Contrato base, tipos, validación, utilidades |
| `ironCondorEngine.ts` | ~260 | Motor de Iron Condor |
| `ironButterflyEngine.ts` | ~280 | Motor de Iron Butterfly |
| `butterflySpreadEngine.ts` | ~270 | Motor de Butterfly Spread |
| `condorEngine.ts` | ~310 | Motor de Condor |
| `complexSimulationEngine.ts` | ~450 | Simulación Monte Carlo + determinística + backtesting |
| `complexRiskEngine.ts` | ~480 | Evaluación de riesgo (10 controles, kill-switch) |
| `complexReportEngine.ts` | ~280 | Generación de reportes |
| `strategyFromChainHandler.ts` | ~320 | Handler compartido (7 pasos) |
| `fromChain.ts` | ~100 | Endpoint POST universal |
| `optionsChain.ts` | ~110 | Endpoint GET options chain |

### Frontend (4 archivos, ~550 líneas)

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `StrategyLab.tsx` | ~400 | Página completa con 3 tabs |
| `strategyApi.ts` | ~80 | API service con tipos |
| `App.tsx` | ~40 | Router hash-based |
| `MainDashboard.tsx` | (mod) | Botón 🧪 Strategy Lab |

---

*Documentación generada automáticamente — TEAM-08: Estrategias Complejas de Opciones*
