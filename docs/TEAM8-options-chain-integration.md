# Integración de la Cadena de Opciones TEAM-8 en el Dashboard

## Endpoints

| Actual | TEAM-8 |
|--------|--------|
| `GET /api/options/chain?symbol=X&expiration=YYYY-MM-DD` | `GET /api/strategies/complex/options-chain?ticker=X&expiration=YYYY-MM-DD` |
| `GET /api/options/expirations?symbol=X` | `GET /api/strategies/complex/expirations?ticker=X&rangeMonths=N` |

## Formato de respuesta

### Actual (`OptionChainResponse`)
```ts
{ rows: [{ strike, callBid, callAsk, callIV, callDelta, callVolume, callOpenInterest, putBid, putAsk, putIV, putDelta, putVolume, putOpenInterest }] }
```
Calls y puts combinados en una sola fila por strike.

### TEAM-8 (`OptionsChainResponse`)
```ts
{
  grouped: {
    calls: [{ symbol, strike, bid, ask, mid, greeks?: { delta, gamma, theta, vega }, tradable }],
    puts: [{ symbol, strike, bid, ask, mid, greeks?: { delta, gamma, theta, vega }, tradable }]
  }
}
```
Cada contrato es una entrada independiente. Calls y puts separados.

## Pasos para sustituir

### 1. Cambiar el servicio de import

**Archivo:** `src/features/options/OptionChainTable.tsx`

**Eliminar:**
```tsx
import { fetchOptionChain, fetchExpirations, type OptionChainResponse, type OptionChainRow } from "../../services/options/optionChainApi";
```

**Agregar:**
```tsx
import { fetchOptionsChain, fetchExpirations, type OptionsChainResponse as OptionChainResponse, type OptionsChainEntry } from "../../services/strategies/strategyApi";
```

### 2. Cambiar el fetch de expiraciones

**Actual:**
```tsx
fetchExpirations(symbol)
```

**Nuevo:**
```tsx
fetchExpirations(symbol, 6) // rangeMonths=6
```

### 3. Cambiar el fetch de la cadena

**Actual:**
```tsx
fetchOptionChain(symbol, selectedExpiration)
```

**Nuevo:**
```tsx
fetchOptionsChain(symbol, selectedExpiration)
```

### 4. Adaptar el merge de calls/puts por strike

La tabla actual itera `chain.rows` donde cada fila tiene call+put.
Con TEAM-8 hay que mergear `grouped.calls` y `grouped.puts` por strike:

```tsx
const callMap = new Map(chain.grouped.calls.map(c => [c.strike, c]));
const putMap = new Map(chain.grouped.puts.map(p => [p.strike, p]));
const strikes = Array.from(new Set([...callMap.keys(), ...putMap.keys()])).sort((a, b) => a - b);

const rows = strikes.map(strike => ({
  strike,
  callBid: callMap.get(strike)?.bid ?? 0,
  callAsk: callMap.get(strike)?.ask ?? 0,
  callIV: callMap.get(strike)?.greeks?.implied_volatility ?? 0,
  callDelta: callMap.get(strike)?.greeks?.delta ?? 0,
  callVolume: 0, // No disponible en TEAM-8
  putBid: putMap.get(strike)?.bid ?? 0,
  putAsk: putMap.get(strike)?.ask ?? 0,
  putIV: putMap.get(strike)?.greeks?.implied_volatility ?? 0,
  putDelta: putMap.get(strike)?.greeks?.delta ?? 0,
  putVolume: 0, // No disponible en TEAM-8
}));
```

### 5. Ajustar handleCallClick/handlePutClick

Los premiums ahora se obtienen de `bid/ask/mid` en vez de `callBid/callAsk`:

```tsx
const callPremium = callMap.get(row.strike)?.mid ?? 0;
```

### 6. Eliminar imports/servicios no usados

Una vez que `OptionChainTable` ya no use el servicio actual, se puede eliminar:

- `src/options/optionChainApi.ts`
- `src/options/OptionChainTable.tsx` (duplicado en `src/options/`)
- `src/services/options/optionChainApi.ts`

## Lo que se pierde vs lo que se gana

| Campo | Actual | TEAM-8 |
|-------|--------|--------|
| Bid/Ask por strike | ✅ callBid/callAsk + putBid/putAsk | ✅ bid/ask (separado) |
| Volumen | ✅ callVolume + putVolume | ❌ No disponible |
| Open Interest | ✅ callOpenInterest + putOpenInterest | ❌ No disponible |
| IV (implied volatility) | ✅ callIV + putIV | ✅ greeks.implied_volatility |
| Delta | ✅ callDelta + putDelta | ✅ greeks.delta |
| Gamma | ❌ No disponible | ✅ greeks.gamma |
| Theta | ❌ No disponible | ✅ greeks.theta |
| Vega | ❌ No disponible | ✅ greeks.vega |
| Last Price | ✅ callLastPrice + putLastPrice | ❌ No disponible |
| Underlying Price | ✅ underlyingPrice | ❌ No disponible (null) |
| Datos reales | ❌ (YAHOO_BLOCKED) | ✅ Alpaca |
