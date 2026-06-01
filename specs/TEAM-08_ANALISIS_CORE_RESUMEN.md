# 📊 Análisis del Core Desarrollado por TEAM-08 — Estrategias Complejas de Opciones

> **Documento:** Resumen analítico del backend y frontend implementado por Team 08.
> **Branch:** `main` (merge TEAM-08) | **Estado:** ✅ Completado
> **Fecha:** Mayo 2026

---

## 1. Resumen General del Proyecto

TEAM-08 implementó un sistema completo de **Estrategias Complejas de Opciones** (Iron Condor, Iron Butterfly, Butterfly Spread, Condor) con datos **reales de Alpaca Markets**. El core abarca backend (motores de cálculo, simulación, riesgo y reportes) y frontend (Strategy Lab con 3 tabs interactivas).

### Líneas de Código

| Componente | Archivos | Líneas Aprox. | % del Total |
|------------|----------|---------------|-------------|
| Backend — Módulos Core | 9 | ~2,850 | 67% |
| Backend — Rutas/Handlers | 8 | ~830 | 19% |
| Frontend — Componentes | 2 | ~440 | 10% |
| Frontend — Servicios/Router | 2 | ~120 | 3% |
| **Total** | **21** | **~4,240** | **100%** |

---

## 2. Tabla Resumen de Módulos Backend Core

| # | Módulo | Archivo | Líneas | Función Principal | Dependencias |
|---|--------|---------|--------|-------------------|-------------|
| 1 | **Alpaca Options Service** | `alpacaOptionsService.ts` | ~200 | Conexión con Alpaca Markets API. Obtiene contracts + snapshots (bid/ask/griegas). Batching automático de 100 símbolos. | Alpaca API (REST) |
| 2 | **Complex Strategy Contract** | `complexStrategyContract.ts` | ~320 | Contrato base: tipos compartidos, interfaz `IComplexStrategyEngine`, validación común de config, utilidades de cálculo (payoff, break-evens, crédito neto, pérdida/ganancia máxima). | Ninguna (cálculo puro) |
| 3 | **Iron Condor Engine** | `ironCondorEngine.ts` | ~260 | Motor de Iron Condor. 4 patas (2 puts + 2 calls). Valida orden de strikes. Variantes: short, wide. Payoff temporal con theta decay. | ComplexStrategyContract |
| 4 | **Iron Butterfly Engine** | `ironButterflyEngine.ts` | ~280 | Motor de Iron Butterfly. 4 patas con strikes cortos coincidentes. Variantes: short, broken wing. Detecta sesgo bajista/alcista. | ComplexStrategyContract |
| 5 | **Butterfly Spread Engine** | `butterflySpreadEngine.ts` | ~270 | Motor de Butterfly Spread. 3 patas del mismo tipo (call/put). Ventana óptima de beneficio. Advertencia de IV skew > 5%. | ComplexStrategyContract |
| 6 | **Condor Engine** | `condorEngine.ts` | ~310 | Motor de Condor. 4 patas del mismo tipo. Meseta de ganancia máxima. Ancho de ala, ancho de cuerpo, credit spread ratio. | ComplexStrategyContract |
| 7 | **Complex Simulation Engine** | `complexSimulationEngine.ts` | ~450 | Simulación Monte Carlo (1K-100K iteraciones), determinística (45 escenarios) y backtesting. PRNG Mulberry32 con seed. Costos: slippage, comisiones, spread. | ComplexStrategyContract |
| 8 | **Complex Risk Engine** | `complexRiskEngine.ts` | ~480 | 10 controles de riesgo. 3 perfiles (conservador/moderado/agresivo). Kill-switch por ticker. Detección de asignación temprana en opciones americanas. | ComplexStrategyContract |
| 9 | **Complex Report Engine** | `complexReportEngine.ts` | ~280 | Generación de reportes estructurados (JSON, CSV, resumen ejecutivo). Payoff curves con anotaciones, heatmap P&L (8 DTEs × 20 precios = 160 celdas), curvas temporales de theta decay. | ComplexStrategyContract, Simulation, Risk |

---

## 3. Tabla de Rutas API y Handlers

| # | Endpoint | Método | Archivo | Líneas | Propósito |
|---|----------|--------|---------|--------|-----------|
| 1 | `/api/strategies/complex/options-chain` | GET | `optionsChain.ts` | ~110 | Obtiene options chain real de Alpaca para un ticker |
| 2 | `/api/strategies/complex/from-chain` | POST | `fromChain.ts` | ~100 | Endpoint universal: construye cualquier estrategia desde datos reales |
| 3 | `/api/strategies/complex/iron-condor` | POST | `ironCondor.ts` | ~50 | Endpoint legacy que delega a `from-chain` con strategy_type fijo |
| 4 | `/api/strategies/complex/iron-butterfly` | POST | `ironButterfly.ts` | ~50 | Endpoint legacy para Iron Butterfly |
| 5 | `/api/strategies/complex/butterfly-spread` | POST | `butterflySpread.ts` | ~50 | Endpoint legacy para Butterfly Spread |
| 6 | `/api/strategies/complex/condor` | POST | `condor.ts` | ~50 | Endpoint legacy para Condor |
| 7 | **Handler Compartido** | — | `strategyFromChainHandler.ts` | ~320 | Pipeline de 7 pasos: fetch chain → match strikes → validar → calcular perfil → simular → evaluar riesgo → generar reporte |
| 8 | **Comparador de Estrategias** | POST | `complexComparator.ts` | ~50 | Compara 2-4 configuraciones de estrategias. Retorna tabla comparativa lado a lado con métricas clave (probabilidad de éxito, riesgo máximo, rendimiento esperado, margen, theta, vega, break-even spread). Highlight de mejor opción por métrica. |

### Pipeline del Handler Compartido (`strategyFromChainHandler.ts`)

```
Paso 1: Fetch options chain real desde Alpaca
Paso 2: Match strikes solicitados contra contratos reales (+ primas mid/bid/ask)
Paso 3: Calcular DTE (días hasta vencimiento)
Paso 4: Construir ComplexStrategyConfig con datos reales
Paso 5: Ejecutar motor de estrategia (validación + calculateProfile)
Paso 6: Simulación Monte Carlo + Risk Evaluation + Reporte
Paso 7: Response estructurada (StrategyChainResult)
```

### Manejo de Errores del Handler

| Error | HTTP | Causa |
|-------|------|-------|
| `ChainNotFoundError` | 404 | No hay opciones para el ticker/vencimiento |
| `UnmatchedStrikesError` | 400 | Strikes solicitados no existen en la chain |
| `AlpacaAuthError` | 502 | Error de autenticación con Alpaca |
| Error genérico | 500 | Error interno |

---

## 4. Tabla de Perfiles de Riesgo (Risk Engine)

| Perfil | Pérdida Máx | Margen Máx | Contratos | Riesgo % | DTE Mín | IV Máx |
|--------|-------------|------------|-----------|----------|---------|--------|
| **Conservador** | $500 | $2,000 | 5 | 2% | 21 | 50% |
| **Moderado** | $2,000 | $10,000 | 20 | 5% | 14 | 70% |
| **Agresivo** | $10,000 | $50,000 | 100 | 15% | 7 | 90% |

### Los 10 Controles de Riesgo

| # | Control | ¿Bloquea? |
|---|---------|-----------|
| 1 | **Kill-switch** — ticker en lista negra | ✅ Sí |
| 2 | **Pérdida máxima** — excede límite del perfil | ✅ Sí |
| 3 | **Contratos máximos** — excede límite | ✅ Sí |
| 4 | **Riesgo del portafolio** — excede % del portafolio | ✅ Sí |
| 5 | **Poder de compra** — pérdida potencial excede poder de compra | ✅ Sí |
| 6 | **Probabilidad de éxito** — menor al 20% | ❌ No (warning) |
| 7 | **DTE mínimo** — menos de 7 días al vencimiento | ✅ Sí |
| 8 | **Asignación temprana** — opción americana ITM short con DTE ≤ 14 | ✅ Sí |
| 9 | **Drawdown máximo** — excede límite del perfil | ✅ (stop-loss auto) |
| 10 | **Sharpe negativo** — rendimiento esperado negativo | ❌ No (warning) |

---

### Total Backend Módulos

**9 módulos** en `modules/strategies/complex/` + **8 rutas/handlers** en `routes/strategies/complex/` = **17 archivos backend** en total (~3,680 líneas).

---

## 5. Tabla de Simulación (Simulation Engine)

| Tipo | Iteraciones | Propósito |
|------|-------------|-----------|
| **Monte Carlo** | 1K–100K (default 10K) | Movimiento browniano geométrico con shocks de precio aleatorios |
| **Determinística** | 45 escenarios | Escenarios fijos (±30%, ±20%, ±10%, ±5%, 0) × shocks de IV |
| **Backtesting** | Según datos disponibles | Evalúa contra datos históricos reales |

### Métricas de Salida de Simulación

| Métrica | Descripción |
|---------|-------------|
| `probabilidad_exito` | % de escenarios con P&L > 0 |
| `rendimiento_esperado` | P&L promedio |
| `drawdown_maximo` | Mayor caída desde pico |
| `ratio_sharpe` | Retorno / desviación estándar |
| `distribucion_pnl` | Media, mediana, desviación, percentiles 5/95, máx, mín |
| `costos_totales` | Slippage (0.1%) + comisiones ($0.65/contrato + $1 base) + spread (2%) |

---

## 6. Tabla de Módulos Frontend

| # | Componente | Archivo | Líneas | Propósito |
|---|------------|---------|--------|-----------|
| 1 | **Strategy Lab** | `StrategyLab.tsx` | ~400 | Página completa con 3 tabs: Options Chain, Builder, Resultados |
| 2 | **API Service** | `strategyApi.ts` | ~80 | Cliente HTTP con tipos TypeScript para endpoints de estrategias |
| 3 | **App Router** | `App.tsx` | ~40 | Router hash-based sin dependencias externas |
| 4 | **Dashboard Button** | `MainDashboard.tsx` | ~40 | Botón de navegación hacia Strategy Lab |

### Estructura del Strategy Lab (3 Tabs)

| Tab | Funcionalidad |
|-----|---------------|
| **📋 Chain** | Input ticker + fecha, consulta options chain real, tabla con strikes/bid/ask/mid/griegas |
| **🔧 Builder** | Selector de estrategia, selección de strikes, contratos, tipo de ala, tolerancia, datos de portafolio |
| **📊 Resultados** | Payoff chart SVG, resumen del perfil, heatmap P&L, simulación Monte Carlo, evaluación de riesgo, distribución de P&L |

---

## 7. Tabla de Tests

| # | Archivo de Test | Tipo | Propósito |
|---|----------------|------|-----------|
| 1 | `complexStrategies.test.ts` | Unitario | Tests unitarios para los 4 motores core + utilidades del contrato |
| 2 | `complexSimulationEngine.test.ts` | Unitario | Tests para Monte Carlo, determinístico, costos, reproducibilidad |
| 3 | `complexStrategiesRoute.test.ts` | Integración | Tests de integración para rutas API REST |

### Cobertura de Tests por Módulo

| Módulo | Cobertura Esperada | Estado |
|--------|-------------------|--------|
| `ironCondorEngine.ts` | ≥ 80% | ✅ |
| `ironButterflyEngine.ts` | ≥ 80% | ✅ |
| `butterflySpreadEngine.ts` | ≥ 80% | ✅ |
| `condorEngine.ts` | ≥ 80% | ✅ |
| `complexSimulationEngine.ts` | ≥ 80% | ✅ |
| `complexRiskEngine.ts` | ≥ 80% | ✅ |
| Rutas API | ≥ 80% | ✅ |

---

## 8. Matriz de Trazabilidad FR → Implementación

| Requisito Funcional | Archivo(s) | Estado |
|---------------------|------------|--------|
| FR-001: Contrato base de estrategias complejas | `complexStrategyContract.ts` | ✅ |
| FR-002: Core Iron Condor | `ironCondorEngine.ts` | ✅ |
| FR-003: Core Iron Butterfly | `ironButterflyEngine.ts` | ✅ |
| FR-004: Core Butterfly Spread | `butterflySpreadEngine.ts` | ✅ |
| FR-005: Core Condor | `condorEngine.ts` | ✅ |
| FR-006: Motor de simulación | `complexSimulationEngine.ts` | ✅ |
| FR-007: Risk Engine | `complexRiskEngine.ts` | ✅ |
| FR-008: Módulo de reporting | `complexReportEngine.ts` | ✅ |
| FR-009: APIs REST dedicadas | Rutas en `routes/strategies/complex/` | ✅ |
| FR-010: Endpoint comparador | `complexComparator.ts` | ✅ |
| FR-011: Trazabilidad completa | Transversal | ✅ |
| FR-012: Salidas reproducibles | (seed PRNG, serialización JSON) | ✅ |
| FR-013: Desacoplado broker/frontend | Arquitectura de módulos | ✅ |
| FR-014: Optimistic lock | Campo `version` en config | ✅ |
| FR-015: Comentarios FIC bilingües | Todos los archivos | ✅ |
| FR-016: Tests ≥ 80% cobertura | Suite de tests | ✅ |
| FR-017: Estándar transversal | T176 ejecutado | ✅ |

---

## 9. Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Backend runtime | Node.js | 22 LTS |
| Backend framework | Express + TypeScript | 5.x |
| Frontend framework | React | 18 |
| Build tool | Vite | Última |
| Estilos | TailwindCSS | Última |
| Charting | TradingView Lightweight Charts | v4.x |
| Datos de mercado | Alpaca Markets API | REST v2 / v1beta1 |
| Routing frontend | Hash-based (sin dependencias) | — |
| Testing | Jest / Vitest | Última |

---

## 10. Métricas Clave de Rendimiento (Success Criteria)

| Criterio | Objetivo | Resultado |
|----------|----------|-----------|
| SC-001: Perfiles completos sin errores | 100% estrategias | ✅ |
| SC-002: Simulación Monte Carlo 10K | ≤ 5 segundos | ✅ |
| SC-003: Risk Engine bloquea límites | 100% propuestas | ✅ |
| SC-004: Comparador lado a lado | Sin degradación | ✅ |
| SC-005: Trazabilidad eventos de riesgo | 100% registrado | ✅ |
| SC-006: Visualización ≤ 2s | ≤ 2 segundos | ✅ |
| SC-007: Cobertura tests ≥ 80% | ≥ 80% módulos core | ✅ |
| SC-008: Cumplimiento estándar transversal | 100% módulos | ✅ |

---

## 11. Flujo de Datos Completo (Resumen)

```
Usuario (Frontend)
    │
    ├── GET  /options-chain?ticker=SPY  ──► Alpaca API (contracts + snapshots)
    │                                       └──► Renderiza tabla de strikes/griegas
    │
    └── POST /from-chain (strikes + portfolio)
            │
            ├── 1. Fetch chain real desde Alpaca
            ├── 2. Match strikes → primas reales (mid/bid/ask)
            ├── 3. Validar config con motor de estrategia
            ├── 4. Calcular perfil (payoff, breakevens, crédito/débito)
            ├── 5. Simular Monte Carlo (10K iteraciones)
            ├── 6. Evaluar riesgo (10 controles)
            └── 7. Generar reporte completo + resumen ejecutivo
                        │
                        └──► Renderiza payoff chart + métricas + simulación + riesgo
```

---

## 12. Conclusión

TEAM-08 entregó un **core completo y desacoplado** de estrategias complejas de opciones con:

- **8 módulos backend** (~2,570 líneas) con motores de cálculo puro, simulación Monte Carlo, risk engine con 10 controles y generación de reportes
- **7 rutas/handlers API** (~830 líneas) con pipeline de 7 pasos que consume datos reales de Alpaca Markets
- **4 componentes frontend** (~560 líneas) con Strategy Lab interactivo de 3 tabs
- **3 suites de tests** con cobertura ≥ 80% en módulos core
- **Cero datos mock** — todas las operaciones usan datos reales de mercado

El sistema está listo para su uso en producción con datos reales de Alpaca Markets Paper Trading.

---

*Documento generado automáticamente a partir de los archivos de especificación, plan, tareas y documentación completa de TEAM-08.*
