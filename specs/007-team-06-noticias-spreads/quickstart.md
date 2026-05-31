# Guía de Inicio Rápido (Quickstart): TEAM-06

**Identificador**: 007-TEAM-06-QUICKSTART  
**Fase**: Fase 1 (Diseño y Contratos)  
**Idioma**: Español  
**Estado**: Finalizado  

---

## 1. Requisitos Previos

Antes de levantar el entorno del feature `007-team-06-noticias-spreads`, asegúrate de cumplir con los siguientes prerequisitos:

1. **Node.js**: Versión 22 LTS o superior instalada.
2. **Supabase**: Base de datos de Supabase configurada local o remotamente (variables del `.env` completadas).
3. **Variables de Entorno**:
   - En `projects/rest-api/inversions_api/.env`:
     ```env
     PORT=3000
     JWT_SECRET=super-secure-dev-jwt-secret-key-tmnt-06
     SUPABASE_URL=https://tu-proyecto.supabase.co
     SUPABASE_ANON_KEY=tu-anon-key
     SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
     FINNHUB_API_KEY=tu-finnhub-key
     POLYGON_API_KEY=tu-polygon-key
     ```
   - En `projects/pwa/inversions_app/.env`:
     ```env
     VITE_API_URL=http://localhost:3000
     VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
     VITE_SUPABASE_ANON_KEY=tu-anon-key
     ```

---

## 2. Script de Arranque Limpio (`dev-clean-start.ps1`)

Para automatizar la instalación de dependencias, limpieza de caché de compilación, levantamiento silencioso de servicios y sincronización de tokens JWT locales, se provee el script de PowerShell `dev-clean-start.ps1`.

### 2.1 Ubicación Recomendada
Guarda el script en la raíz de tu workspace o ejecuta directamente con los siguientes pasos.

### 2.2 Acciones Realizadas por el Script
1. **Limpieza**: Borra carpetas `node_modules`, `.vite`, `dist` y temporales en el frontend y backend para asegurar compilaciones limpias.
2. **Instalación**: Instala las dependencias del monorepo mediante `npm install`.
3. **Bootstrap de Auth**: Genera un token JWT de desarrollo firmado con la variable `JWT_SECRET` del backend y lo inyecta localmente en un archivo `dev-token.json` accesible por la PWA para evitar el bloqueo `401 AUTH_CONTEXT`.
4. **Ejecución Silenciosa**: Levanta el API REST en el puerto `3000` y la PWA en el puerto `5173` enviando los logs en segundo plano a archivos temporales para no saturar la terminal.

### 2.3 Comando de Ejecución
Ejecuta la consola en modo PowerShell y corre:

```powershell
# Iniciar todo el entorno local en modo silencioso (por defecto)
.\scripts\dev-clean-start.ps1 -Mode silent

# Iniciar todo el entorno mostrando terminales activas de depuración
.\scripts\dev-clean-start.ps1 -Mode visible
```

---

## 3. Generación y Sincronización del Token JWT de Desarrollo

Durante el desarrollo local offline o sandbox, las políticas RLS de Supabase requieren que las llamadas al backend lleven una cabecera `Authorization: Bearer <TOKEN>`.

El backend de `inversions_api` cuenta con un script de bootstrap que genera un token simulado con los claims requeridos por la Constitución (`authenticated`, rol de operador, id de usuario dev).

### Sincronización Manual de Credenciales
Si necesitas regenerar el token sin reiniciar los servidores:

```powershell
# Ejecuta el script de sincronización desde la raíz
npm run sync:dev-token
```
Esto creará el archivo `projects/pwa/inversions_app/public/dev-token.json` con el siguiente formato:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "00000000-0000-0000-0000-000000000006",
  "role": "authenticated",
  "generated_at": "2026-05-22T05:00:00Z"
}
```
El cliente HTTP de la PWA detectará automáticamente este archivo en modo `demo` u `offline` para adjuntarlo a las peticiones sin requerir login en Supabase Auth real.

---

## 4. Comando de Diagnóstico y Estado Operativo (`dev-status.ps1`)

Para verificar que el entorno local esté operando de forma óptima sin abrir navegadores o inspeccionar puertos manualmente, corre el comando de diagnóstico:

```powershell
.\scripts\dev-status.ps1
```

### Resultados Esperados
El script validará en menos de 5 segundos:
- Disponibilidad del puerto `3000` (Backend API).
- Disponibilidad del puerto `5173` (Frontend React PWA).
- Conexión de red de Supabase local o externa.
- Presencia y validez del archivo de Token JWT local.
- Extracción de las últimas 5 líneas del log del servidor de base de datos e API.
