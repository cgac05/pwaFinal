Parche: Team 06 A_NOTICIAS desde inversions_app_pwa-main-6-3 hacia inversions_app_pwa-main

Objetivo:
- Agregar el panel del video: noticias reales por proveedor, sentimiento, evidencia y resumen CALL/PUT/HOLD.
- Mantener intacto Noticias 2: NO se modifica projects/pwa/inversions_app/src/features/news.
- El panel Team 06 queda aislado en projects/pwa/inversions_app/src/features/news-team06.
- A_NOTICIAS se muestra solo despues de ejecutar la simulacion con el core A_NOTICIAS activo.

Aplicacion desde PowerShell, parado en la raiz del proyecto inversions_app_pwa-main:

Expand-Archive -Path "$env:USERPROFILE\Downloads\team06_a_noticias_main_patch.zip" -DestinationPath "." -Force

Luego corre:

npm install
npm run -w @inversions/rest-api dev
npm run -w @inversions/pwa dev

Rutas principales que debe pegar el frontend:
- GET /api/news/confluence?symbol=SPY&limit=100
- GET /api/news/relevant?ticker=SPY&limit=4
- POST /api/news/analyze-sources

Notas:
- Si activas un rango de estrategia, A_NOTICIAS manda from/to y el backend analiza una ventana ampliada de 7 dias antes y 7 dias despues.
- Si quieres llaves reales, configura FINNHUB_API_KEY, NEWSAPI_KEY, POLYGON_API_KEY y ALPHA_VANTAGE_API_KEY en el .env del backend. Yahoo RSS funciona sin key.
