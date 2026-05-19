# Backlog de Equipo: TEAM-05

**Iniciativa**: 001-inversions
**Proyecto**: diana-inversions
**Equipo**: TEAM-05
**Fuente**: 001-inv-tasks.md + team-task-allocation.md

## Tareas (literal del canon, con checkbox)

- [x] T030 [P] [US2] Adaptador Alpaca en backend/src/modules/brokers/alpacaAdapter.ts
- [x] T054 Reporte de cobertura MFA en backend/src/observability/mfaCoverageReport.ts
- [ ] T106 Definir contrato de parámetros para análisis institucional en backend/src/modules/institutional/institutionalContract.ts incluyendo instrumento/ticker, strike, periodos (intradiario/diario/mensual/trimestral), volumen, liquidez, plazo (corto/mediano/largo), porcentaje en manos de fondos, flujos de entrada/salida y posiciones abiertas
- [ ] T107 Implementar servicio de integración con fuentes externas institucionales en backend/src/modules/institutional/institutionalDataService.ts consumiendo SEC EDGAR 13F filings, FINRA short interest, Unusual Whales, Finviz institutional y alternativas gratuitas/de paga configurables, con normalización de respuesta, caché, fallback y manejo de rate limits
- [ ] T108 Implementar motor de zonas institucionales en backend/src/modules/institutional/institutionalZonesEngine.ts para identificar soportes y resistencias donde fondos acumulan o distribuyen usando volumen institucional, análisis de velas OHLC y filtros de alta liquidez
- [ ] T109 Implementar motor de tendencias institucionales en backend/src/modules/institutional/institutionalTrendEngine.ts con MAs de 50 y 200 días, detección de cruces, correlación entre reportes trimestrales y volumen diario creciente, y cálculo de probabilidad de continuidad de tendencia
- [ ] T110 Implementar motor de análisis de vencimientos en backend/src/modules/institutional/expirationAnalysisEngine.ts que detecta fechas clave de opciones y futuros (mensual/trimestral) donde los institucionales ajustan posiciones y evalúa impacto esperado en precio del subyacente
- [ ] T111 Implementar API de análisis institucional en backend/src/routes/institutional/institutionalAnalysis.ts retornando zonas S/R institucionales, tendencias MAs largas, cruce de períodos y métricas de posicionamiento como overlay para gráfico de velas
- [ ] T112 Implementar API de posiciones y reportes regulatorios en backend/src/routes/institutional/regulatoryPositions.ts retornando posiciones abiertas de fondos, flujos y datos 13F para visualización en modal/panel de interfaz
- [ ] T113 Definir contrato base de estrategias de cobertura en backend/src/modules/strategies/coverage/coverageStrategyContract.ts con interfaz unificada de inputs (ticker, cantidad de acciones, strikes, fechas de vencimiento, primas, capital, tolerancia al riesgo) y validación de consistencia
- [ ] T114 Implementar core de Protective Put / Married Put en backend/src/modules/strategies/coverage/protectivePutEngine.ts con cálculo de protección máxima (strike – precio actual), simulación de escenarios de caída del subyacente, análisis costo-beneficio de cobertura, alertas de ejercicio anticipado y stop-loss cuando el subyacente se acerca al strike
- [ ] T115 Implementar core de Collar Put en backend/src/modules/strategies/coverage/collarEngine.ts con simulación de rango de protección (put) y techo de ganancia (call), cálculo de costo neto (prima put – prima call), proyección de payoff en tiempo real y stop-loss automático si el subyacente rompe el rango esperado
- [ ] T116 Implementar core de Covered Straddle en backend/src/modules/strategies/coverage/coveredStraddleEngine.ts con cálculo de ingresos por primas vendidas, simulación de escenarios de alta volatilidad y riesgo ilimitado, cuantificación de pérdidas potenciales en movimientos fuertes, alertas de margen y stop-loss en niveles críticos
- [ ] T117 Implementar motor de simulación avanzada en backend/src/modules/strategies/coverage/coverageSimulationEngine.ts con Monte Carlo, escenarios determinísticos (subida/bajada %), backtesting con datos históricos de Supabase y proyección de payoff en tiempo real para las tres estrategias de cobertura
- [ ] T118 Implementar servicio de alertas y gestión de riesgos en backend/src/modules/strategies/coverage/coverageRiskService.ts con stop-loss automático configurable, alertas de margen, notificaciones push/email al alcanzar niveles críticos y solicitud de cierre de operación vía broker
- [ ] T119 Implementar módulo de reporting de cobertura en backend/src/modules/strategies/coverage/coverageReportService.ts con resumen de resultados esperados por estrategia, estadísticas de riesgo/beneficio, logs de simulación y ejecución y reportes exportables
- [ ] T120 Implementar comparador de estrategias de cobertura en backend/src/modules/strategies/coverage/coverageComparator.ts que evalúa Protective Put, Collar Put y Covered Straddle según P&L esperado, costo neto, nivel de riesgo y contexto multi-core para recomendar la estrategia más adecuada
- [ ] T121 Implementar chat IA de análisis institucional y estrategias de cobertura en backend/src/modules/ai/institutionalCopilotChat.ts con acceso de solo lectura a Supabase sobre tablas de datos institucionales, posiciones regulatorias y resultados de simulación de estrategias
- [ ] T173 Ejecutar ajuste de TEAM-05 al estándar transversal en backend/src/modules/strategies/coverage/ (protective/married put, collar, covered straddle)

## Tareas de Tests Automatizados

- [ ] T184 [P] Tests unitarios para institutionalZonesEngine, institutionalTrendEngine y expirationAnalysisEngine en tests/unit/institutional/
- [ ] T185 [P] Tests unitarios para protectivePutEngine, collarEngine, coveredStraddleEngine y coverageComparator en tests/unit/strategies/coverage/
- [ ] T186 [P] Tests de integracion para routes/institutional/institutionalAnalysis y routes/institutional/regulatoryPositions en tests/integration/institutional/
