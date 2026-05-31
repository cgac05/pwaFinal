Proyecto integrado: base principal + módulo funcional de noticias.

Se tomó como base el primer ZIP y se sobreescribieron/agregaron los archivos del segundo ZIP donde noticias funciona.

Archivos clave de noticias integrados:
- projects/pwa/inversions_app/src/features/news/
- projects/pwa/inversions_app/src/services/news/newsApi.ts
- projects/pwa/inversions_app/src/features/dashboard/NewsSection.tsx
- projects/pwa/inversions_app/src/features/dashboard/ConfluenceSignalsTable.tsx
- projects/pwa/inversions_app/src/features/dashboard/MainDashboard.tsx
- projects/pwa/inversions_app/src/services/signals/confluenceTableApi.ts
- projects/rest-api/inversions_api/src/modules/news/
- projects/rest-api/inversions_api/src/routes/news/index.ts
- projects/rest-api/inversions_api/src/routes/signals/confluenceTable.ts
- projects/rest-api/inversions_api/src/routes/dashboard/orchestrator.ts

Para subirlo al repo:
1. Clona el repo oficial.
2. Copia el contenido de esta carpeta encima del repo clonado.
3. Ejecuta git status, git add ., git commit y git push.
