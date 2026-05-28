# Contrato: Endpoint de Cotizaciones de Mercado

**Versión**: 1.0 | **Fecha**: 2026-05-28

## Propósito

Proveer precios actuales y cambios porcentuales del día para los instrumentos de la watchlist del usuario. Necesario para cumplir FR-014 (WatchlistTree con precio + % cambio).

## Endpoint

```
GET /api/market/quotes
```

## Parámetros de consulta

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `symbols` | string | Sí | Lista de tickers separados por coma. Ej: `AAPL,MSFT,NVDA,SPY`. Máximo 50 símbolos por request. |

## Respuesta exitosa (200)

```json
{
  "quotes": [
    {
      "symbol": "AAPL",
      "price": 213.45,
      "change": 2.30,
      "changePercent": 1.09,
      "timestamp": "2026-05-28T14:32:00Z"
    },
    {
      "symbol": "MSFT",
      "price": 424.10,
      "change": -1.85,
      "changePercent": -0.43,
      "timestamp": "2026-05-28T14:32:00Z"
    }
  ]
}
```

## Tipos TypeScript

```typescript
// PWA (src/services/signals/marketApi.ts)

export interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;  // ISO 8601
}

export interface MarketQuotesResponse {
  quotes: MarketQuote[];
}

export async function getMarketQuotes(symbols: string[]): Promise<MarketQuotesResponse> {
  const params = symbols.join(',');
  const response = await fetch(`/api/market/quotes?symbols=${params}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error(`Quotes fetch failed: ${response.status}`);
  return response.json() as Promise<MarketQuotesResponse>;
}
```

## Respuestas de error

| Código | Condición | Body |
|--------|-----------|------|
| 400 | `symbols` vacío o faltante | `{ "error": "symbols parameter required" }` |
| 400 | Más de 50 símbolos | `{ "error": "max 50 symbols per request" }` |
| 502 | Error al obtener datos del broker | `{ "error": "upstream data unavailable" }` |
| 503 | Modo offline activo | `{ "error": "market data unavailable in offline mode" }` |

## Comportamiento en modo offline

Cuando el sistema está en modo `offline`, el endpoint retorna 503. La PWA debe manejar este caso mostrando `—` en los campos de precio/cambio sin error visible al usuario.

## Contrato de polling (PWA)

El hook `useWatchlistPrices` en la PWA consume este endpoint con las siguientes reglas:
- Polling cada 30 segundos mientras el componente está montado.
- Si el request falla, se retienen los últimos valores conocidos (stale-while-revalidate).
- Si 3 requests consecutivos fallan, se limpian los valores y se muestra `—`.
- El polling se pausa cuando `document.visibilityState === 'hidden'` y se reanuda al volver.

## Notas de implementación

- Este endpoint requiere implementación en la REST API (`projects/rest-api/`).
- Debe enrutar al broker activo (IBKR o Alpaca según modo) para obtener datos reales en modo `real`, o datos de mercado de referencia en modo `demo`.
- En modo offline, retornar 503 inmediatamente sin intentar llamar al broker.
