Parche directo para integrar el Team 06 (Noticias principales / A_NOTICIAS) dentro de inversions_app_pwa-main (2), sin reemplazar el módulo Noticias 2.

Aplicar desde la raíz de inversions_app_pwa-main:

Expand-Archive -Path "$env:USERPROFILE\Downloads\team06_to_main2_overlay_patch.zip" -DestinationPath "." -Force

Después:

npm install
npm run -w @inversions/pwa dev
npm run -w @inversions/rest-api dev

Notas:
- Se conserva Noticias 2.
- La versión del Team 06 se integró como noticias principales/A_NOTICIAS.
- El componente visual del Team 06 queda aislado en src/features/news-team06 para no pisar src/features/news, que usa Noticias 2.
