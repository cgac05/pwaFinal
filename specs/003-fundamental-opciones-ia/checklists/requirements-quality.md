# Checklist: Calidad de Requisitos - TEAM-03

**Purpose**: Verificar que los requisitos del feature TEAM-03 sean completos, claros, consistentes, medibles y cubran escenarios clave antes de avanzar a `/speckit.tasks`.
**Created**: 2026-05-22
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [ ] CHK001 - ¿Se documentan explícitamente los contratos de entrada para el análisis fundamental (ticker, histórico, métricas, supuestos)? [Completeness, Spec §RF-001]
- [ ] CHK002 - ¿Se definen claramente las cuatro estrategias de opciones (Long Call, Long Put, Short Call, Short Put) y la lógica de elegibilidad para cada una? [Completeness, Spec §RF-003]
- [ ] CHK003 - ¿Se describe un esquema de salida estructurada que otros equipos puedan consumir sin ambigüedades? [Completeness, Spec §RF-005]
- [ ] CHK004 - ¿Se especifican los requisitos de trazabilidad y auditoría para cada recomendación y cambio de clasificación? [Completeness, Spec §User Story 4]
- [ ] CHK005 - ¿Se cubren las condiciones de datos insuficientes o incompletos para el activo y el comportamiento esperado del sistema en esos casos? [Completeness, Spec §User Story 1]
- [ ] CHK006 - ¿Se describen los escenarios de fallo del Chat IA y su respuesta cuando no hay contexto suficiente? [Completeness, Spec §User Story 3]

## Requirement Clarity

- [ ] CHK007 - ¿Está cuantificado el significado de “VIABLE”, “MARGINAL” y “NO_VIABLE” con umbrales de métricas específicas? [Clarity, Spec §RF-002]
- [ ] CHK008 - ¿Están definidos los resultados de riesgo/recompensa requeridos para cada estrategia en términos medibles (BEP, ROI, pérdida máxima, probabilidad ITM)? [Clarity, Spec §RF-003]
- [ ] CHK009 - ¿Está claramente delimitado el alcance del Chat IA: qué puede explicar y qué debe rechazar como fuera de alcance? [Clarity, Spec §RF-004]
- [ ] CHK010 - ¿Se especifica con claridad el desacople entre TEAM-03, el frontend y la capa de broker? [Clarity, Spec §RF-004 / RF-005]
- [ ] CHK011 - ¿Están definidos los límites del permiso humano y la necesidad de confirmación explícita en estrategias de alto riesgo? [Clarity, Spec §User Story 2]

## Requirement Consistency

- [ ] CHK012 - ¿Son consistentes las reglas de recomendación de estrategia entre la definición de estrategias y los requisitos de riesgo/advertencia? [Consistency, Spec §User Story 2]
- [ ] CHK013 - ¿Coinciden las suposiciones de disponibilidad de datos en el análisis fundamental y en las explicaciones del Chat IA? [Consistency, Spec §User Story 1 y User Story 3]
- [ ] CHK014 - ¿Son coherentes los requisitos de no-auto-trading y control humano entre las secciones de RF, RNF y auditoría? [Consistency, Spec §RNF-001]
- [ ] CHK015 - ¿Los criterios de éxito del plan mantienen la misma interpretación de “trazabilidad” y “reproducibilidad” que el spec? [Consistency, Spec §User Story 4]

## Acceptance Criteria Quality

- [ ] CHK016 - ¿Los criterios de aceptación se expresan en términos de entradas/salidas concretas y no solo metas generales? [Acceptance Criteria, Spec §User Story 1]
- [ ] CHK017 - ¿Se define un criterio medible para cuándo un activo tiene “datos suficientes”? [Acceptance Criteria, Spec §User Story 1]
- [ ] CHK018 - ¿Se especifican métricas de éxito para la respuesta API estructurada que consumen otros equipos? [Acceptance Criteria, Spec §User Story 5]
- [ ] CHK019 - ¿Hay criterios de aceptación explícitos para la calidad de la explicación IA (por ejemplo, citar datos, enumerar supuestos, declarar límites)? [Acceptance Criteria, Spec §User Story 3]

## Scenario Coverage

- [ ] CHK020 - ¿Se cubren escenarios de baja volatilidad y alta volatilidad por separado en la lógica de recomendación? [Coverage, Spec §User Story 2]
- [ ] CHK021 - ¿Se incluyen escenarios para activos con histórico muy corto o datos parciales? [Coverage, Spec §User Story 1]
- [ ] CHK022 - ¿Se definen escenarios para preguntas del Chat IA que no pueden ser respondidas con los datos disponibles? [Coverage, Spec §User Story 3]
- [ ] CHK023 - ¿Se cubren los escenarios de versión/cambio para consumidores de la API externa? [Coverage, Spec §User Story 5]

## Edge Case Coverage

- [ ] CHK024 - ¿Se documenta el comportamiento cuando el activo es nuevo con menos de 30 días de datos? [Edge Case, Spec §User Story 1]
- [ ] CHK025 - ¿Se especifican los requisitos para manejar estrategias con riesgo ilimitado (por ejemplo, Short Call sin hedge)? [Edge Case, Spec §User Story 2]
- [ ] CHK026 - ¿Se cubren casos de datos atípicos o ajustes de precios (splits, divisiones de acciones) con impacto en el análisis? [Edge Case, Spec §User Story 1]
- [ ] CHK027 - ¿Se define el comportamiento si un consumidor solicita datos históricos no disponibles o archivados? [Edge Case, Spec §User Story 5]

## Non-Functional Requirements

- [ ] CHK028 - ¿Están cuantificados los requisitos de auditabilidad y reproducibilidad para las recomendaciones? [Non-Functional, Spec §User Story 4]
- [ ] CHK029 - ¿Se define un objetivo de rendimiento o latencia para el API de análisis y la generación de explicaciones? [Non-Functional, Spec §RF-005]
- [ ] CHK030 - ¿Se establece la métrica de calidad de la explicación IA, como número mínimo de criterios justificados por respuesta? [Non-Functional, Spec §User Story 3]
- [ ] CHK031 - ¿Se especifica la disponibilidad mínima o la tolerancia a fallos requerida para el servicio de salida estructurada? [Non-Functional, Spec §RF-005]

## Dependencies & Assumptions

- [ ] CHK032 - ¿Se documentan las suposiciones sobre datos financieros normalizados y su fuente de verdad? [Assumption, Spec §Supuestos]
- [ ] CHK033 - ¿Se identifican explícitamente las dependencias con Claude API y equipos consumidores como TEAM-01? [Dependency, Spec §User Story 6 / User Story 5]
- [ ] CHK034 - ¿Se aclara la dependencia de la topología multi-team para que no se reinterprete el alcance en una ejecución unipersonal? [Dependency, Spec §Supuestos]

## Ambiguities & Conflicts

- [ ] CHK035 - ¿Está suficientemente preciso el término “consumible por otros equipos” para garantizar compatibilidad de contrato? [Ambiguity, Spec §RF-005]
- [ ] CHK036 - ¿Hay alguna tensión entre los requisitos de confirmación humana y la automatización implícita en las recomendaciones? [Conflict, Spec §User Story 2]
- [ ] CHK037 - ¿La definición de control humano es consistente entre el plan del equipo y la especificación del Chat IA? [Conflict, Spec §RNF-001]

## Traceability

- [ ] CHK038 - ¿Los requisitos de este feature incluyen referencias claras a los artefactos canónicos de Diana y a sus secciones relevantes? [Traceability, Spec §Propósito Ejecutivo]
- [ ] CHK039 - ¿Se mantiene la trazabilidad 1:1 entre los requisitos del spec y los criterios de aceptación del plan? [Traceability, Spec §COBERTURA_ESPECIFICACION.md]
- [ ] CHK040 - ¿Se identifica cualquier gap de requisitos que deba ser revisado antes de generar tareas? [Traceability, Spec §COBERTURA_ESPECIFICACION.md]
