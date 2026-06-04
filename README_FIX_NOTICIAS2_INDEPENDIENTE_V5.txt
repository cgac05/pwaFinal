FIX V5 - Noticias 2 separado de A_NOTICIAS / Noticias 1

Qué hace:
1. Noticias 2 ya NO renderiza el panel Team-06 / A_NOTICIAS.
2. Agrega un panel independiente en:
   projects/pwa/inversions_app/src/features/news2/Noticias2Panel.tsx
3. El panel de Noticias 2 usa una ruta separada:
   POST /api/news2/analyze-sources
4. A_NOTICIAS / Noticias normales siguen usando NewsSection y /api/news.
5. Se mantiene el arreglo para que al activar solo Noticias 2 no truene coresHabilitados vacío.

Aplicar en PowerShell desde la raíz del proyecto:
Expand-Archive -Path "$env:USERPROFILE\Downloads\fix_noticias2_independiente_v5.zip" -DestinationPath "." -Force

Reiniciar:
taskkill /F /IM node.exe
npm run -w @inversions/rest-api dev
npm run -w @inversions/pwa dev
