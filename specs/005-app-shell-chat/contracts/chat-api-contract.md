# Contrato: Chat API (cliente → backend existente)

**Feature**: 005-app-shell-chat  
**Tipo**: HTTP REST — endpoint existente en backend  
**Archivo cliente**: `projects/pwa/inversions_app/src/services/chat/chatApi.ts`  
**Endpoint backend**: `POST /api/chat/explain` (existente, sin cambios)

---

## Función cliente

```ts
export interface ChatRequest {
  symbol: string;
  timeframe: string;
  question: string;
  context?: string;
}

export interface ChatResponse {
  explanation: string;
  model?: string;
  cached?: boolean;
}

export async function sendChatMessage(req: ChatRequest): Promise<ChatResponse>
```

## Request

```http
POST /api/chat/explain
Authorization: <getAuthHeaders()>
Content-Type: application/json

{
  "symbol": "AAPL",
  "timeframe": "1d",
  "question": "¿Por qué el RSI está sobrecomprado?",
  "context": "technical"
}
```

## Response 200 OK

```json
{
  "explanation": "El RSI de AAPL está en 78, indicando ...",
  "model": "claude-opus-4-7",
  "cached": false
}
```

## Errores esperados

| Código | Caso | Manejo en UI |
|--------|------|-------------|
| 400 | `symbol` vacío o `question` vacía | Mostrar error inline en el chat |
| 400 | Timeframe inválido | Mostrar error inline en el chat |
| 404 | Symbol sin datos OHLC | Mensaje: "No hay datos para [SYMBOL]" |
| 429 | Rate limit (10/min) | Mensaje: "Límite de consultas alcanzado. Intenta en 1 minuto." |
| 5xx | Error del servidor | Mensaje: "El asistente no está disponible. Intenta de nuevo." + botón Reintentar |

## Notas

- Auth: `getAuthHeaders()` de `src/services/signals/signalApi.ts` (patrón existente).
- Rate limit: 10 req/min por usuario. La UI debe degradar con mensaje amigable sin bloquear la interfaz.
- Si `context` es la categoría de análisis activa, se pasa como string ("technical", "ai", etc.).
