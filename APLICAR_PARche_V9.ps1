# Ejecutar desde la raíz de inversions_app_pwa-main
Remove-Item -Recurse -Force ".\projects\pwa\inversions_app\src\features\news" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\projects\pwa\inversions_app\src\features\news2" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\projects\pwa\inversions_app\src\features\news-team06" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\projects\pwa\inversions_app\src\services\news2" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\projects\pwa\inversions_app\src\services\newsTeam06" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\projects\rest-api\inversions_api\src\routes\news2" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\projects\rest-api\inversions_api\src\modules\news2" -ErrorAction SilentlyContinue
Expand-Archive -Path "$env:USERPROFILE\Downloads\noticias1_noticias2_separados_v9.zip" -DestinationPath "." -Force
Remove-Item -Recurse -Force ".\projects\pwa\inversions_app\node_modules\.vite" -ErrorAction SilentlyContinue
