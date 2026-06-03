Implementación: Noticias por rango de estrategia ±7 días

Base: inversions_app_pwa-main-6.zip

Cambio solicitado:
Cuando el usuario seleccione un rango de estrategia, por ejemplo 2026-06-12 a 2026-07-15, el módulo A_NOTICIAS ya no toma noticias fuera de contexto. Ahora usa una ventana informativa ampliada:

  fecha_inicio_estrategia - 7 días
  fecha_fin_estrategia + 7 días

Ejemplo:
  Estrategia: 2026-06-12 → 2026-07-15
  Noticias analizadas: 2026-06-05 → 2026-07-22

Archivos modificados:
- projects/pwa/inversions_app/src/features/dashboard/simulation/SimulationControlPanel.tsx
- projects/pwa/inversions_app/src/features/dashboard/MainDashboard.tsx
- projects/pwa/inversions_app/src/features/dashboard/NewsSection.tsx
- projects/pwa/inversions_app/src/features/news/NewsSourcesAnalyzer.tsx
- projects/pwa/inversions_app/src/services/news/newsApi.ts
- projects/rest-api/inversions_api/src/modules/news/newsDataService.ts
- projects/rest-api/inversions_api/src/modules/news/newsConfluenceRows.ts
- projects/rest-api/inversions_api/src/routes/news/relevant.ts

Qué hace ahora:
1. El panel de simulación emite el rango de estrategia seleccionado.
2. El dashboard manda ese rango a la sección de noticias.
3. El frontend consulta /api/news/confluence y /api/news/relevant con from/to.
4. El backend amplía la ventana ±7 días.
5. Las APIs que soportan fechas reciben el rango ampliado.
6. Todas las noticias se filtran por fecha y relevancia al ticker.
7. A_NOTICIAS ya no cae a todas las noticias cuando el rango no coincide.

Validación realizada:
- npm run -w @inversions/rest-api lint: OK
- npm run -w @inversions/pwa build: OK

Nota:
El ZIP final no incluye node_modules, dist, .env ni __MACOSX.
