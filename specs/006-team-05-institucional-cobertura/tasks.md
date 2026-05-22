# Tasks: 006-team-05-institucional-cobertura

Fuente canónica: `.drfic/diana-sdk/projects/diana-inversions/initiatives/001-inversions/teams/TEAM-05/tasks.md`
Derivado por: Speckit (run_only="tasks") — preservación estricta del canon Diana.

## Preserved (Canonical) Tasks
Se incluyen sin omisión todas las tareas canónicas del backlog del equipo (literal):

- [x] T030 [P] [US2] Adaptador Alpaca en backend/src/modules/brokers/alpacaAdapter.ts
- [x] T054 Reporte de cobertura MFA en backend/src/observability/mfaCoverageReport.ts
- [x] T106 Definir contrato de parámetros para análisis institucional en backend/src/modules/institutional/institutionalContract.ts incluyendo instrumento/ticker, strike, periodos (intradiario/diario/mensual/trimestral), volumen, liquidez, plazo (corto/mediano/largo), porcentaje en manos de fondos, flujos de entrada/salida y posiciones abiertas
- [x] T107 Implementar servicio de integración con fuentes externas institucionales en backend/src/modules/institutional/institutionalDataService.ts consumiendo SEC EDGAR 13F filings, FINRA short interest, Unusual Whales, Finviz institutional y alternativas gratuitas/de paga configurables, con normalización de respuesta, caché, fallback y manejo de rate limits
- [x] T108 Implementar motor de zonas institucionales en backend/src/modules/institutional/institutionalZonesEngine.ts para identificar soportes y resistencias donde fondos acumulan o distribuyen usando volumen institucional, análisis de velas OHLC y filtros de alta liquidez
- [x] T109 Implementar motor de tendencias institucionales en backend/src/modules/institutional/institutionalTrendEngine.ts con MAs de 50 y 200 días, detección de cruces, correlación entre reportes trimestrales y volumen diario creciente, y cálculo de probabilidad de continuidad de tendencia
- [x] T110 Implementar motor de análisis de vencimientos en backend/src/modules/institutional/expirationAnalysisEngine.ts que detecta fechas clave de opciones y futuros (mensual/trimestral) donde los institucionales ajustan posiciones y evalúa impacto esperado en precio del subyacente
- [x] T111 Implementar API de análisis institucional en backend/src/routes/institutional/institutionalAnalysis.ts retornando zonas S/R institucionales, tendencias MAs largas, cruce de períodos y métricas de posicionamiento como overlay para gráfico de velas
- [x] T112 Implementar API de posiciones y reportes regulatorios en backend/src/routes/institutional/regulatoryPositions.ts retornando posiciones abiertas de fondos, flujos y datos 13F para visualización en modal/panel de interfaz
- [x] T113 Definir contrato base de estrategias de cobertura en backend/src/modules/strategies/coverage/coverageStrategyContract.ts con interfaz unificada de inputs (ticker, cantidad de acciones, strikes, fechas de vencimiento, primas, capital, tolerancia al riesgo) y validación de consistencia
- [x] T114 Implementar core de Protective Put / Married Put en backend/src/modules/strategies/coverage/protectivePutEngine.ts con cálculo de protección máxima (strike – precio actual), simulación de escenarios de caída del subyacente, análisis costo-beneficio de cobertura, alertas de ejercicio anticipado y stop-loss cuando el subyacente se acerca al strike
- [x] T115 Implementar core de Collar Put en backend/src/modules/strategies/coverage/collarEngine.ts con simulación de rango de protección (put) y techo de ganancia (call), cálculo de costo neto (prima put – prima call), proyección de payoff en tiempo real y stop-loss automático si el subyacente rompe el rango esperado
- [x] T116 Implementar core de Covered Straddle en backend/src/modules/strategies/coverage/coveredStraddleEngine.ts con cálculo de ingresos por primas vendidas, simulación de escenarios de alta volatilidad y riesgo ilimitado, cuantificación de pérdidas potenciales en movimientos fuertes, alertas de margen y stop-loss en niveles críticos
- [x] T117 Implementar motor de simulación avanzada en backend/src/modules/strategies/coverage/coverageSimulationEngine.ts con Monte Carlo, escenarios determinísticos (subida/bajada %), backtesting con datos históricos de Supabase y proyección de payoff en tiempo real para las tres estrategias de cobertura
- [x] T118 Implementar servicio de alertas y gestión de riesgos en backend/src/modules/strategies/coverage/coverageRiskService.ts con stop-loss automático configurable, alertas de margen, notificaciones push/email al alcanzar niveles críticos y solicitud de cierre de operación vía broker
- [x] T119 Implementar módulo de reporting de cobertura en backend/src/modules/strategies/coverage/coverageReportService.ts con resumen de resultados esperados por estrategia, estadísticas de riesgo/beneficio, logs de simulación y ejecución y reportes exportables
- [x] T120 Implementar comparador de estrategias de cobertura en backend/src/modules/strategies/coverage/coverageComparator.ts que evalúa Protective Put, Collar Put y Covered Straddle según P&L esperado, costo neto, nivel de riesgo y contexto multi-core para recomendar la estrategia más adecuada
- [x] T121 Implementar chat IA de análisis institucional y estrategias de cobertura en backend/src/modules/ai/institutionalCopilotChat.ts con acceso de solo lectura a Supabase sobre tablas de datos institucionales, posiciones regulatorias y resultados de simulación de estrategias
- [x] T173 Ejecutar ajuste de TEAM-05 al estándar transversal en backend/src/modules/strategies/coverage/ (protective/married put, collar, covered straddle)

## Derived (Speckit-added) Tasks — expandidos para implementación y pruebas
Estas tareas complementan el backlog canónico sin omitir nada validado por Diana.

- [x] T200 Crear contratos JSON de API para coverage (`/api/contracts/coverage/institutional_context.v1.json`, `/api/contracts/coverage/strategy.v1.json`, `/api/contracts/coverage/explanation.v1.json`) y ejemplos de payloads en `docs/contracts/coverage/`.
- [x] T201 Implementar esquema de persistencia de trazas y evidencias (tables: `institutional_contexts`, `evidence_blobs`, `explanation_responses`) con versión de documento y `response_hash` en backend/src/db/migrations/.
- [x] T202 Implementar job de purge/retención que mueve datos older than 365d to archival tier and deletes after verification (backend/src/jobs/purgeEvidenceJob.ts).
- [x] T203 Implementar métricas e instrumentación (coverage.response.latency_ms, coverage.response.p95_ms, coverage.ai.unavailable.count) en backend/src/observability/coverageMetrics.ts y dashboards.
- [x] T204 Implementar fixtures de pruebas A/B/C (nominal, stress tail, low-liquidity) en tests/fixtures/coverage/ y pipelines CI para ejecutarlos.
- [x] T205 Implementar el procedimiento de reconstrucción de auditoría (replay) como herramienta interna `tools/reconstruct_explanation.ts` que toma `context_id` y produce audit bundle.
- [x] T206 Añadir compatibilidad de versionado semántico en contratos y CI validation (scripts/validate-contract-compat.sh).
- [x] T207 Implementar validadores de contratos JSON (ajustando `schema` y `examples`) y tests de compatibilidad en CI.
- [x] T208 Añadir medidas de resiliencia y recovery flows: partial-data handlers, stale-input flags, retry policy for external sources (exponential backoff with max attempts), and circuit-breaker metrics in backend/src/lib/resilience/.
- [x] T209 Crear playbooks de pruebas de integración y escenarios extremos (catalogs/market-scenarios.md) y asignar responsables para completarlos.
- [x] T210 Añadir documentación operativa para Storage & Retention (S3 lifecycle, KMS key rotation, purge audit) en ops/docs/retention.md.

## Tests & Acceptance

- Unit tests: T184, T185 (canonical) plus T204 (fixtures) and contract validators T207.
- Integration tests: T186 (canonical) plus end-to-end scenario runs using fixtures (T204).

## Coverage Report (canonical preservation)

- preserved: All canonical tasks listed in `./.drfic/.../teams/TEAM-05/tasks.md` (T030..T121, T173, T184..T186) — preserved 100%.
- expanded: Derived tasks (T200..T210) to implement contracts, tracing, retention, metrics, fixtures, reconstruction, versioning, resilience.
- merged: none.
- dropped: none.

## Ready / Next Steps

- Estado: READY_FOR_IMPLEMENTATION_PREP
- Bloqueos: materializar catálogos de escenarios extremos por mercado (T209) — OWNER: TEAM-05
- Recomendación: Ejecutar pipeline CI con fixtures T204 y contract validators T207, luego asignar tareas a sprints.
