RESTORE NOTICIAS 2 EXACTO V6

Este parche revierte el cambio experimental de V5 que creaba:
  src/features/news2/Noticias2Panel.tsx

y vuelve a conectar el chip "Noticias 2" al módulo original del main:
  src/features/news/NewsSourcesAnalyzer.tsx

Importante:
- Noticias / A_NOTICIAS sigue usando src/features/news-team06 por medio de NewsSection.tsx.
- Noticias 2 vuelve a usar src/features/news.
- Se elimina el montaje /api/news2 del backend porque no existía en el main original.
- El folder src/features/news2 no se necesita; bórralo con el comando indicado.

Comando recomendado antes de extraer el ZIP:
Remove-Item -Recurse -Force ".\projects\pwa\inversions_app\src\features\news2" -ErrorAction SilentlyContinue
