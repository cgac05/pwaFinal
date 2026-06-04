Integración realizada sobre inversions_app_pwa-main-4.zip

Base respetada:
- Se usó como raíz el proyecto principal inversions_app_pwa-main-4.
- No se copiaron node_modules, dist, .vite ni .env.
- Se mantuvieron las rutas y módulos ya presentes de otros equipos, incluyendo estrategias complejas, fundamental, institucional, técnico y opciones.

Se integró desde la versión funcional:
- Módulo de Noticias multi-API.
- Frontend de noticias: features/news, NewsSection y services/news.
- Backend de noticias: modules/news, routes/news y requests/news.http.
- Registro de rutas /api/news y /api/news/relevant en src/index.ts.
- Core A_NOTICIAS conservado para tabla de confluencia y simulación.

Se corrigieron estrategias faltantes:
- Debit Spread · Bull Call
- Debit Spread · Bear Put
- Credit Spread · Bull Put
- Credit Spread · Bear Call

Archivos tocados principalmente:
- projects/pwa/inversions_app/src/features/dashboard/MainDashboard.tsx
- projects/pwa/inversions_app/src/features/dashboard/NewsSection.tsx
- projects/pwa/inversions_app/src/features/news/*
- projects/pwa/inversions_app/src/services/news/*
- projects/pwa/inversions_app/src/services/signals/confluenceTableApi.ts
- projects/pwa/inversions_app/src/features/dashboard/simulation/SimulationControlPanel.tsx
- projects/pwa/inversions_app/src/features/dashboard/simulation/SpreadParamsModal.tsx
- projects/pwa/inversions_app/src/features/dashboard/simulation/SimulatorStrategySection.tsx
- projects/rest-api/inversions_api/src/index.ts
- projects/rest-api/inversions_api/src/modules/news/*
- projects/rest-api/inversions_api/src/routes/news/*
- projects/rest-api/inversions_api/src/modules/simulation/runner.ts

Validación realizada:
- npm install
- npm run -w @inversions/rest-api lint: OK
- npm run -w @inversions/pwa build: OK

Notas:
- Para ejecutar, correr npm install desde la raíz.
- No subir .env al repositorio.
- Para que funcionen todas las APIs de noticias configurar en el .env del backend:
  FINNHUB_API_KEY
  NEWSAPI_API_KEY
  ALPHA_VANTAGE_API_KEY
  POLYGON_API_KEY
- Yahoo Finance RSS puede responder sin API key.
