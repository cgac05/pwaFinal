Integración final realizada

Base usada:
- Final_bonito_combinado.zip

Se conservaron las noticias multi-API del módulo funcional:
- Yahoo Finance RSS
- Finnhub Company News
- NewsAPI Everything
- Alpha Vantage News Sentiment
- Polygon Ticker News

Se agregaron las técnicas/estrategias de inversión pendientes:
- Debit Spread: Bull Call Spread
- Debit Spread: Bear Put Spread
- Credit Spread: Bull Put Spread
- Credit Spread: Bear Call Spread

Archivos clave actualizados:
- projects/pwa/inversions_app/src/features/dashboard/simulation/SimulationControlPanel.tsx
- projects/pwa/inversions_app/src/features/dashboard/simulation/SpreadParamsModal.tsx
- projects/pwa/inversions_app/src/features/dashboard/simulation/SimulatorStrategySection.tsx
- projects/pwa/inversions_app/src/features/dashboard/MainDashboard.tsx
- projects/pwa/inversions_app/src/services/signals/confluenceTableApi.ts
- projects/rest-api/inversions_api/src/modules/simulation/runner.ts

Validación realizada:
- Frontend build correcto: npm run -w @inversions/pwa build
- Backend TypeScript correcto: npm run -w @inversions/rest-api lint

Nota:
- El lint completo del frontend con tsc --noEmit sigue reportando errores preexistentes en src/store/appShell.test.ts, no relacionados con esta integración.
