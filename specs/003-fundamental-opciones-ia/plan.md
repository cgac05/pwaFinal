# Plan de Implementación: TEAM-03 SQLitoNo - Análisis Fundamental y Estrategias de Opciones con IA

**Feature**: TEAM-03-FUNDAMENTAL-OPTIONS-AI
**Equipo**: TEAM-03 (SQLitoNo)
**Idioma**: es
**Fecha**: 2026-05-22
**Fuente canónica**:
- .drfic/diana-sdk/projects/diana-inversions/initiatives/001-inversions/teams/TEAM-03/plan.md
- .drfic/diana-sdk/projects/diana-inversions/initiatives/001-inversions/teams/TEAM-03/spec.md

## Resumen Ejecutivo

Este plan Speckit para TEAM-03 preserva el canon de Diana y lo traduce a una implementación técnica de alto nivel, con fases claras, entregables operativos y criterios de aceptación medibles.

TEAM-03 debe entregar un core desacoplado de frontend y broker que produce:
- análisis fundamental normalizado y trazable,
- familia de estrategias base de opciones (Long Call, Long Put, Short Call, Short Put),
- una capa de explicación IA que justifique decisiones y supuestos,
- una API estructurada lista para consumo por otros equipos.

## Objetivo del Plan

Convertir el alcance definido por el canon de TEAM-03 en una hoja de ruta de implementación que soporte `/speckit.tasks`, manteniendo:
- Alcance funcional y no funcional intactos.
- Restricciones de desacoplo, trazabilidad y control humano.
- Integración con los contratos operativos y los artefactos globales del proyecto.

## Principios del Plan

- **Canon Preservado**: No se omiten requisitos, decisiones o restricciones validadas por Diana.
- **Expansión Controlada**: El plan añade estructura técnica, hitos e interfaces sin reinterpretar el alcance del equipo.
- **Desacople**: TEAM-03 no implementa frontend ni lógica de broker; expone API y contratos de datos.
- **Trazabilidad**: Cada fase incluye artefactos y criterios que permiten mapear de vuelta a los RF/RNF del canon.

## Alcance del Plan

### Incluye
- Normalización y contrato de datos financieros base.
- Cálculo de métricas de viabilidad y fundamentos.
- Motor de recomendación de estrategias de opciones.
- Generación de escenarios de riesgo/recompensa y reglas de evaluación.
- Servicio de explicación IA con disclaimers y contexto.
- Contrato de salida JSON para consumo multi-equipo.
- Validación de coherencia, auditoría y readiness para Speckit.

### Excluye
- Ejecución de operaciones de trading automática.
- UI de consumo directo.
- Integración broker de ejecución final.
- Análisis técnico o institucional externo al scope de TEAM-03.

## Fases Técnicas

### Fase 1: Motor de Datos Fundamentales
- Definir entidades básicas de datos financieros normalizados.
- Establecer contratos de ingestión y validación de entradas.
- Implementar cálculo de métricas clave: volatilidad, viabilidad, ratios financieros, salud de activo.
- Registrar metadatos de trazabilidad: fuente, timestamp, supuestos, versión.
- Entregable: `Contrato de datos fundamentales` y `Módulo de validación de entrada`.

### Fase 2: Estrategias Base de Opciones
- Diseñar la familia de estrategias: Long Call, Long Put, Short Call, Short Put.
- Definir reglas de elegibilidad, escenarios de riesgo, profit/reward y puntos de corte.
- Implementar motor de decisión que genera recomendaciones compatibles con el contrato de salida.
- Validar la no recomendación cuando el activo es no viable o marginal.
- Entregable: `Módulo de estrategia de opciones` y `Tabla de calibración de escenarios`.

### Fase 3: Chat IA Explicativo y API de Exposición
- Definir el contrato de la API REST del core TEAM-03.
- Implementar la capa de explicación IA: justificación de fundamentos, supuestos y limitaciones.
- Incluir disclaimer automático que deje explícito el carácter no ejecutor y no asesor.
- Asegurar que la salida es estructurada, versionada y consumible por otros equipos.
- Entregable: `Endpoint /api/team-03/fundamental-analysis/{ticker}` y `Documento de contrato JSON`.

### Fase 4: Validación Operativa y Readiness
- Probar coherencia sobredeterminada entre análisis, estrategia y explicación.
- Verificar la trazabilidad de cada resultado hacia su evidencia de cálculo.
- Asegurar que el plan respeta el modelo semi-automático y control humano.
- Entregable: `Checklist de validación` y `Readiness para /speckit.tasks`.

## Entregables Clave

- `specs/003-fundamental-opciones-ia/plan.md`
- Contratos de datos y API.
- Definiciones de métricas y escenarios de riesgo.
- Puntos de integración con otros equipos.
- Criterios de aceptación operativos.

## Criterios de Aceptación

- El core calcula y expone métricas fundamentales de manera trazable.
- Las estrategias base se generan con reglas claras y escenarios definidos.
- La API de salida es explícita, con campos de `viability`, `strategies`, `risk`, `assumptions`, `confidence` y metadatos.
- La explicación IA justifica decisiones y asume límites sin dar señales de ejecución.
- El plan no modifica el alcance ni las restricciones del canon TEAM-03.

## Dependencias Canónicas

- `.drfic/diana-sdk/projects/diana-inversions/initiatives/001-inversions/teams/TEAM-03/plan.md`
- `.drfic/diana-sdk/projects/diana-inversions/initiatives/001-inversions/teams/TEAM-03/spec.md`
- `.drfic/diana-sdk/projects/diana-inversions/inv-constitution.md`
- `.drfic/diana-sdk/projects/diana-inversions/initiatives/001-inversions/scope_primario.md`
- `.drfic/diana-sdk/projects/diana-inversions/initiatives/001-inversions/meta.md`

## Riesgos y Mitigaciones

- Riesgo: Datos financieros incompletos o inconsistentes.
  - Mitigación: Validación de contrato e inclusión de fallback controlado.
- Riesgo: Recomendaciones ambiguas.
  - Mitigación: Escenarios de riesgo/recompensa y advertencias específicas.
- Riesgo: Explicación IA fuera de alcance.
  - Mitigación: Disclaimers automáticos y limitación a justificación de fundamentos.
- Riesgo: Invasión de scope técnico.
  - Mitigación: Desacople estricto del frontend y integración de broker.

## Traza a Diana Canon

- Objetivo, alcance y restricciones: `preserved`
- Fases del plan: `expanded`
- Reglas de control humano y no trading: `preserved`
- Salidas estructuradas y contratos: `expanded`
- Trazabilidad y gobernanza: `preserved`

## Siguiente Paso

- Ejecutar `/speckit.tasks` con este plan como base.
- Asegurar que la descomposición preserve la cobertura canonica y no introduzca `dropped elements`.
