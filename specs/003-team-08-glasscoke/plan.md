# Plan Tecnico de Implementacion: Estrategias Complejas de Opciones - TEAM-08

**Feature Branch**: `003-team-08-glasscoke`  
**Created**: 2026-05-20  
**Status**: Active  
**Input**: Plan de Diana en `.drfic/diana-sdk/projects/diana-inversions/initiatives/001-inversions/teams/TEAM-08/plan.md`

## Objetivos del Plan

Definir y desarrollar la arquitectura de software desacoplada para modelar, simular, auditar y comparar estrategias de opciones multi-patas (Iron Condor, Iron Butterfly, Butterfly Spread, Condor) en el backend REST-API.

## Arquitectura de Archivos y Componentes

Crearemos toda la estructura de backend requerida para cumplir con las especificaciones del equipo:

```
projects/rest-api/inversions_api/src/
  modules/strategies/complex/
    complexStrategyContract.ts      <- Validaciones de patas y esquemas de entrada/salida
    ironCondorEngine.ts             <- Lógica y cálculos matemáticos para Iron Condor
    ironButterflyEngine.ts          <- Lógica y cálculos para Iron Butterfly
    butterflySpreadEngine.ts        <- Lógica y cálculos para Butterfly Spread
    condorEngine.ts                 <- Lógica y cálculos para Condor convencional
    complexSimulationEngine.ts      <- Simulador de P&L, shocks de IV y precio (Monte Carlo)
    complexRiskEngine.ts            <- Evaluador de riesgos, márgenes y stop-loss
    complexReportEngine.ts          <- Generador de curvas de payoff y dataframes de reportes
  routes/strategies/complex/
    ironCondor.ts                   <- Endpoint de simulación para Iron Condor
    ironButterfly.ts                <- Endpoint para Iron Butterfly
    butterflySpread.ts              <- Endpoint para Butterfly Spread
    condor.ts                       <- Endpoint para Condor
    complexComparator.ts            <- Comparador de estrategias y generación de recomendación IA
```

## Fases Técnicas

1. **Fase 1: Contratos y Estructuras Base**: Implementar validaciones estructuradas con Tipado fuerte para evitar patas incoherentes.
2. **Fase 2: Motores de Estrategia**: Construcción matemática de Iron Condor, Iron Butterfly, Butterfly y Condor con sus respectivos cálculos de payoff, márgenes y break-evens.
3. **Fase 3: Simulación, Riesgo y Reporte**: Integrar backtesting, shocks en precio/IV, alertas de asignación temprana y generación de payoff-curves en texto/JSON.
4. **Fase 4: Enrutamiento y Explicación IA**: Crear endpoints REST y simular un explicador de estrategias basado en condiciones de mercado y perfiles de volatilidad.
5. **Fase 5: Pruebas y Comentarios FIC**: Asegurar que toda la lógica tenga tests unitarios y de integración robustos (>80% de cobertura) y comentarios bilingües `FIC:`.
