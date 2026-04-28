# Quickstart: Plataforma de Inversiones con IA

## Proposito

Secuencia minima para iniciar implementacion tecnica sobre la base del plan de esta feature.

## 1. Preparar estructura base

Estructura esperada:

```text
frontend/
backend/
tests/
specs/001-plataforma-inversiones-ia/
```

## 2. Levantar cimientos de backend primero

1. Implementar middleware JWT + resolucion de usuario activo (`FR-012`).
2. Implementar RBAC por roles (`viewer`,`trader`,`admin`) (`FR-017`).
3. Implementar challenge MFA para aprobacion/ejecucion (`FR-019`).
4. Definir entidades operativas en Supabase y politicas de retencion (`FR-007`).
5. Definir auditoria estructurada para auth, aprobacion y ejecucion (`FR-006`,`FR-011`).

## 3. Implementar contratos de dominio y flujo operativo

1. Ciclo `PENDING_APPROVAL -> APPROVED -> SUBMITTED -> ...` con optimistic locking (`FR-016`).
2. Regla fail-fast: `FAILED -> PENDING_APPROVAL` con nueva aprobacion obligatoria (`FR-009`).
3. Validacion de tipos de orden `MARKET` y `LIMIT` (`FR-014`).
4. Rate limiting por usuario/endpoint con `429` y cooldown (`FR-015`).

## 4. Integrar brokers y market data

1. Implementar adaptadores internos IBKR y Alpaca (`FR-008`).
2. Normalizar estados de orden broker a estado canonico interno.
3. Implementar pipeline realtime con contrato normalizado de market data (`SC-006`).
4. Instrumentar metricas p95 de frescura y alertas de degradacion.

## 5. Completar frontend PWA

1. Vista de evaluacion de senales y evidencia (`FR-001`,`FR-002`).
2. Configuracion de fuentes analiticas (`FR-003`).
3. Flujo de aprobacion/rechazo con MFA para roles sensibles (`FR-004`,`FR-005`,`FR-019`).
4. Historial trazable de senales, decisiones e intentos (`FR-011`).
5. Mostrar disclaimer de no asesoria en puntos de decision/ejecucion (`FR-013`).

## 6. Verificaciones operativas y de resiliencia

1. Probar simulacros de recovery contra objetivos `RTO<=30m` y `RPO<=5m` (`FR-018`).
2. Verificar cobertura de auditoria al 100% en acciones de aprobacion/ejecucion (`SC-008`).
3. Validar disponibilidad mensual objetivo >=99.5% (`SC-005`).

## 7. Comandos base de calidad

```bash
npm run lint
npm test
```
