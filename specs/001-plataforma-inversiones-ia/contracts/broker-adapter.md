# Contract: Broker Adapter

## Proposito

Definir interfaz interna estable para integracion de brokers soportados en v1.

## Brokers Soportados

- `IBKR`
- `ALPACA`

## Capacidades Obligatorias

1. Validar conectividad y estado de sesion.
2. Consultar market data en formato normalizado.
3. Sincronizar cuenta/posiciones.
4. Preparar orden aprobada (`MARKET`/`LIMIT`).
5. Enviar orden solo si existe aprobacion humana valida.
6. Normalizar estados de ejecucion a contrato canonico.
7. Normalizar errores tecnicos/negocio para auditoria.

## Estado Canonico de Orden

- `SUBMITTED`
- `PARTIALLY_FILLED`
- `FILLED`
- `CANCELLED`
- `REJECTED`
- `FAILED`

## Invariants

- El dominio nunca consume SDK/REST broker de forma directa.
- Cualquier timeout/error transitorio se registra como `FAILED` con metadata de retry.
- Un reintento requiere nueva aprobacion humana previa.
- Debe existir idempotency key por intento para evitar duplicados.

## Resultado Minimo de Submission

- `proposal_id`
- `broker`
- `broker_order_id` (nullable en timeout)
- `status` (canonico)
- `error_code` (nullable)
- `error_message` (nullable)
- `occurred_at`
