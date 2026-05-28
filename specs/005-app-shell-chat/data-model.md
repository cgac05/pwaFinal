# Modelo de Datos: App Shell VS Code + AI Chat Panel

**Branch**: `005-app-shell-chat` | **Fecha**: 2026-05-28
**Referencia**: `specs/005-app-shell-chat/spec.md`

---

## Entidad 1 — AppShellState

Estado global del layout de la aplicación. Persiste en localStorage.

| Campo | Tipo | Valores | Default | Persistencia |
|-------|------|---------|---------|-------------|
| `activeSection` | `"watchlist" \| "analysis" \| "strategies"` | enum | `"watchlist"` | localStorage |
| `leftPanelCollapsed` | `boolean` | — | `false` | localStorage |
| `chatPanelCollapsed` | `boolean` | — | `false` | localStorage |
| `analysisCategory` | `"technical" \| "institutional" \| "fundamental" \| "news" \| "ai"` | enum | `"technical"` | localStorage |

**Invariantes**:
- Si `leftPanelCollapsed = true`, la barra de actividad permanece visible.
- Si `activeSection` cambia mientras `leftPanelCollapsed = true`, el panel se expande automáticamente.
- Clic en el ícono de la sección activa → toggle `leftPanelCollapsed`.

**Claves localStorage**:
```
inversions.appshell.section         → activeSection
inversions.appshell.left-collapsed  → leftPanelCollapsed (string "true"/"false")
inversions.appshell.chat-collapsed  → chatPanelCollapsed (string "true"/"false")
inversions.appshell.analysis-cat    → analysisCategory
```

---

## Entidad 2 — ChatMessage

Unidad mínima del historial de conversación con el asistente de IA.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | UUID generado al crear el mensaje |
| `role` | `"user" \| "assistant" \| "system"` | Origen del mensaje |
| `content` | `string` | Texto del mensaje |
| `context` | `ChatContext \| null` | Contexto del instrumento activo al enviar |
| `timestamp` | `number` | Unix epoch ms (Date.now()) |
| `status` | `"pending" \| "ok" \| "error"` | Estado del mensaje del asistente |

**Reglas**:
- Mensajes con `role = "user"` tienen siempre `status = "ok"`.
- Mensajes con `role = "assistant"` y `status = "pending"` muestran indicador de carga.
- Mensajes con `role = "assistant"` y `status = "error"` muestran mensaje de error + botón de reintentar.
- Mensajes con `role = "system"` son informaciones del sistema (ej. "historial comprimido").
- El historial se trunca cuando supera 100 mensajes → se eliminan los 20 más antiguos con `role !== "system"`.

**Persistencia**: `sessionStorage["inversions.chat.history"]` → JSON array de `ChatMessage[]`.

---

## Entidad 3 — ChatContext

Contexto del instrumento activo capturado al momento de enviar un mensaje.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `symbol` | `string` | Símbolo del instrumento activo (e.g., `"AAPL"`) |
| `timeframe` | `string` | Timeframe activo en el dashboard (e.g., `"1d"`) |
| `analysisCategory` | `string` | Categoría de análisis activa al momento del envío |

**Reglas**:
- Si no hay instrumento activo en el store, `context` del mensaje es `null`.
- Cuando `context = null`, el chat muestra un badge neutro "Sin contexto" y la pregunta se envía sin `symbol`/`timeframe` → el usuario ve un error del backend que el ChatPanel convierte en mensaje de sistema amigable.

---

## Entidad 4 — WatchlistItem (existente en backend)

Instrumento financiero seguido por el usuario. Gestionado por el endpoint `/api/watchlist` (existente).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | ID único del ítem (UUID) |
| `symbol` | `string` | Símbolo del instrumento (e.g., `"AAPL"`) |
| `name` | `string` | Nombre del instrumento (e.g., `"Apple Inc."`) |
| `category` | `string` | Categoría del instrumento para agrupación en el árbol |
| `isFavorite` | `boolean` | Si el ítem está marcado como favorito |

**Operaciones existentes**:
- `GET /api/watchlist` → lista de ítems
- `POST /api/watchlist` → agregar ítem (body: `{symbol}`)
- `DELETE /api/watchlist/:id` → eliminar ítem

**Precios**: provienen de `useWatchlistPrices(symbols)` → `GET /api/market/quotes?symbols=...`

---

## Entidad 5 — AnalysisCategory

Enum de categorías de análisis disponibles en el panel izquierdo.

| ID | Label | Secciones del dashboard que activa |
|----|-------|------------------------------------|
| `technical` | Técnico | SuperChart, TimeControls, IndicatorsMenu, ConfluenceSignalsTable, ExplainabilityTable |
| `options` | Opciones | OptionGreeksRow, ConfluenceSignalsTable |
| `institutional` | Institucional | ConfluenceSignalsTable, SignalOverlay + mensaje "Sección en construcción" |
| `fundamental` | Fundamental | Mensaje "Sección en construcción" |
| `news` | Noticias | Mensaje "Sección en construcción" |
| `ai` | IA | ExplainabilityTable, SignalOverlay, ConfluenceSignalsTable |

**Estado inicial**: `technical` (por defecto y por defecto de localStorage).

---

## Entidad 6 — StrategyCard

Card estática de estrategia de opciones. Datos hardcodeados en el frontend (no hay endpoint).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | Identificador único (e.g., `"iron-condor"`) |
| `name` | `string` | Nombre de la estrategia |
| `icon` | `string` | Nombre del ícono de lucide-react |
| `description` | `string` | Descripción breve (1-2 líneas) |
| `riskProfile` | `"limited" \| "unlimited"` | Perfil de riesgo |
| `marketContext` | `string` | Cuándo se usa (e.g., "Mercado lateral, baja volatilidad") |

**Catálogo inicial (hardcodeado)**:

```ts
[
  {
    id: "iron-condor",
    name: "Iron Condor",
    icon: "TrendingUp",
    description: "Venta simultánea de call spread y put spread. Profit máximo en mercado lateral.",
    riskProfile: "limited",
    marketContext: "Mercado lateral, baja volatilidad implícita"
  },
  {
    id: "collar-put",
    name: "Collar Put",
    icon: "Shield",
    description: "Compra de put protectora financiada con venta de call. Limita upside y downside.",
    riskProfile: "limited",
    marketContext: "Posición larga existente que se quiere proteger"
  },
  {
    id: "married-put",
    name: "Married Put",
    icon: "Lock",
    description: "Compra de acción + compra de put. Seguro contra caídas.",
    riskProfile: "limited",
    marketContext: "Alcista con necesidad de protección ante evento de riesgo"
  }
]
```

---

## Transiciones de estado del AppShell

```
Usuario clic ícono barra de actividad:
  IF section == activeSection AND !leftPanelCollapsed → colapsar panel
  IF section == activeSection AND leftPanelCollapsed  → expandir panel
  IF section != activeSection                         → cambiar sección + expandir si colapsado

Usuario clic botón colapso/expansión panel izquierdo:
  toggle leftPanelCollapsed

Usuario clic botón colapso/expansión panel chat:
  toggle chatPanelCollapsed

Usuario clic chip de análisis:
  setAnalysisCategory(chipId)
  → MainDashboard reactiva visibilidad de secciones

Usuario envía mensaje en chat:
  IF status == "pending" → no permitir nuevo envío
  ELSE:
    agregar ChatMessage(role="user") al historial
    agregar ChatMessage(role="assistant", status="pending") al historial
    llamar POST /api/chat/explain
    IF ok → actualizar último mensaje con content + status="ok"
    IF error → actualizar último mensaje con error content + status="error"
```
