# Quickstart: App Shell VS Code + AI Chat Panel

**Feature**: 005-app-shell-chat | **Fecha**: 2026-05-28

---

## Prerrequisitos

Los mismos del proyecto base:

```bash
# Desde la raíz del monorepo
npm install

# Variables de entorno (ya configuradas en proyecto)
# .env en projects/rest-api/inversions_api/
```

## Iniciar el entorno de desarrollo

```bash
# Desde la raíz del monorepo
npm run dev:clean-start
# O con logs en streaming:
npm run dev:clean-start:logs
```

Esto inicia:
- PWA en `http://localhost:5173`
- REST API en `http://localhost:3000`

## Ejecutar tests

```bash
# Tests de la PWA (Vitest)
npm run -w @inversions/pwa test

# Con UI interactiva
npm run -w @inversions/pwa test -- --ui

# Tests de la REST API
npm run -w @inversions/rest-api test
```

## Verificar la feature manualmente

1. Abrir `http://localhost:5173`
2. Verificar que aparece la barra de actividad izquierda (48px, 3 íconos)
3. Hacer clic en cada ícono → el panel izquierdo cambia de contenido
4. Hacer clic en el ícono activo → el panel se colapsa/expande
5. En Watchlist: agregar un ticker (ej. "TSLA") → aparece en el árbol
6. En Análisis: hacer clic en chip "Opciones" → el dashboard muestra OptionGreeksRow
7. Abrir el panel de chat (derecha) → escribir pregunta sobre el instrumento activo
8. Verificar que el badge de contexto muestra el símbolo/timeframe actual
9. Recargar la página → verificar que el layout recuerda la última configuración de paneles

## Archivos clave de esta feature

```
projects/pwa/inversions_app/src/
├── store/appShell.ts                        # Store del layout (nuevo)
├── layouts/AppShell.tsx                     # Layout 4 zonas (nuevo)
├── components/ui/ActivityBar.tsx            # Barra de actividad (nuevo)
├── features/sidebar/
│   ├── LeftPanel.tsx                        # Panel izquierdo contenedor (nuevo)
│   ├── views/WatchlistView.tsx              # Vista Watchlist adaptada (nuevo)
│   ├── views/AnalysisCategoriesView.tsx     # Chips de análisis (nuevo)
│   └── views/StrategiesView.tsx            # Cards de estrategias (nuevo)
├── features/chat/
│   ├── ChatPanel.tsx                        # Panel de chat contenedor (nuevo)
│   ├── ChatMessageList.tsx                  # Lista de mensajes (nuevo)
│   ├── ChatInputBar.tsx                     # Input + botón envío (nuevo)
│   ├── ChatContextBadge.tsx                 # Badge de contexto (nuevo)
│   └── types.ts                             # ChatMessage, ChatContext (nuevo)
├── services/chat/chatApi.ts                 # sendChatMessage() (nuevo)
├── styles/tokens.css                        # +3 variables CSS (modificado)
└── features/dashboard/MainDashboard.tsx     # Usa AppShell + filtro por categoría (modificado)
```

## Convenciones FIC obligatorias

Todo archivo nuevo debe incluir comentarios bilingües:

```ts
// FIC: [descripción en inglés]
// FIC: [descripción en español]
```

Cobertura mínima: módulo, servicios públicos, hooks públicos, lógica crítica.
