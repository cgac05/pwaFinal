IMPLEMENTACIÓN: RESUMEN GLOBAL DE NOTICIAS + RECOMENDACIÓN CALL / PUT / HOLD

Base usada:
- inversions_app_pwa-main-6-rango-noticias-integrado.zip

Objetivo:
- Después de recibir todas las noticias del ticker dentro del rango seleccionado de estrategia,
  el sistema genera un resumen global y una recomendación final para opciones: CALL, PUT o HOLD.

Qué hace ahora:
1. Consulta noticias reales del ticker respetando el rango de estrategia.
2. Amplía la ventana de análisis 7 días antes y 7 días después.
3. Filtra noticias por fecha y relevancia.
4. Analiza cada noticia con sentimiento, confianza y credibilidad.
5. Calcula el impacto de cada noticia:
   impacto = dirección(BUY/HOLD/SELL) * confianza * credibilidad.
6. Resume todas las noticias recibidas.
7. Cuenta noticias alcistas, bajistas y neutrales.
8. Detecta las noticias que más influyeron.
9. Genera una recomendación final:
   - BUY  -> CALL
   - SELL -> PUT
   - HOLD -> HOLD
10. Muestra en frontend:
   - resumen global,
   - recomendación CALL/PUT/HOLD,
   - conteo alcista/bajista/neutral,
   - noticias que más influyeron,
   - explicación del razonamiento,
   - nota de riesgo,
   - estrategia sugerida.

Archivos agregados:
- projects/rest-api/inversions_api/src/modules/news/newsRecommendationSummary.ts

Archivos modificados:
- projects/rest-api/inversions_api/src/modules/news/types.ts
- projects/rest-api/inversions_api/src/modules/news/newsImpactEngine.ts
- projects/rest-api/inversions_api/src/modules/news/investmentAdvisor.ts
- projects/pwa/inversions_app/src/services/news/newsApi.ts
- projects/pwa/inversions_app/src/features/news/AnalysisResult.tsx
- projects/pwa/inversions_app/src/features/styles/NewsSourcesAnalyzer.css

Cómo probar:
1. npm install
2. npm run -w @inversions/rest-api dev
3. npm run -w @inversions/pwa dev
4. Activar A_NOTICIAS.
5. Seleccionar ticker y rango de estrategia.
6. Cargar noticias reales.
7. Verificar que aparezca el bloque "Resumen global de noticias".

Nota:
- Esta recomendación no es una orden financiera.
- Es una señal explicativa basada en sentimiento, confianza y credibilidad.
