Parche Team 06 - Noticias solo despues de ejecutar

Que cambia:
- Oculta completamente el area de noticias al abrir el dashboard.
- El area de noticias solo aparece despues de presionar Ejecutar y si el core A_NOTICIAS estuvo activo en esa ejecucion.
- No toca backend ni proveedores de noticias.

Comando para aplicar desde la raiz del proyecto:

Expand-Archive -Path "$env:USERPROFILE\Downloads\team06_news_hide_until_execute_v1_patch.zip" -DestinationPath "." -Force

Luego corre normalmente:

npm run -w @inversions/pwa dev
