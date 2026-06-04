## Guía Rápida - Módulo de Análisis de Noticias (v1.1)

### ¿Qué se implementó?

Un módulo completo para análisis de fuentes financieras personalizadas que permite:

✅ **Agregar dominios** de sitios financieros (solo el dominio principal, ej: bloomberg.com)
✅ **Sistema busca automáticamente** noticias de la compañía en esos sitios
✅ **Validación flexible** que acepta los dominios financieros confiables
✅ **Listar expandible/contraíble** de fuentes agregadas
✅ **Analizar consolidadamente** múltiples fuentes con Claude AI
✅ **Obtener veredictos** (BUY/SELL/HOLD) basados en análisis de noticias de la compañía
✅ **Mostrar métricas** de confianza y sentimiento
✅ **Explicaciones textuales** del análisis

---

### Cambios Principales (v1.1)

✨ **Antes**: Ingresabas URLs completas → `https://bloomberg.com/quote/AAPL`  
✨ **Ahora**: Solo dominio → `bloomberg.com` + el sistema busca automáticamente noticias de tu compañía

✨ **Antes**: URLs se marcaban como inválidas → Validación demasiado estricta  
✨ **Ahora**: Validación flexible basada en dominios confiables verificados

✨ **Antes**: Analizaba contenido genérico de la página  
✨ **Ahora**: Busca específicamente información de la compañía (nombre + ticker)

---

### Archivos Creados/Actualizados

#### Backend (Node.js/Express)
```
src/modules/news/
  └─ urlAnalysisService.ts      ✅ ACTUALIZADO
     • fetchURLContent() → busca noticias de compañía
     • getTickerPatterns() → NUEVO busca por ticker
     • validateURL() → validación mejorada

src/routes/news/
  └─ urlAnalysis.ts             ✅ ACTUALIZADO
     • Acepta dominios y URLs

src/index.ts                     ✅ Rutas incluidas
```

#### Frontend (React/TypeScript)
```
src/features/news/
  ├─ NewsSourcesAnalyzer.tsx    ✅ ACTUALIZADO
  ├─ SourceInput.tsx            ✅ ACTUALIZADO
  ├─ SourceList.tsx             ✅
  ├─ AnalysisResult.tsx         ✅
  └─ index.ts                   ✅

src/features/styles/
  └─ NewsSourcesAnalyzer.css    ✅

src/features/AppShell.tsx        ✅ Navegación modular
src/main.tsx                     ✅ Usa AppShell
```

#### Documentación
```
CORRECTIONS-NEWS-ANALYZER.md     ✅ NUEVO - Lista de correcciones
QUICKSTART-NEWS-ANALYZER.md      ✅ Este archivo
```

---

### Cómo Usar (Flujo Correcto v1.1)

#### 1. Asegúrate que el backend esté corriendo
```bash
cd projects/rest-api/inversions_api
npm run dev
# Debería escuchar en http://localhost:3000
```

#### 2. Levanta el frontend
```bash
cd projects/pwa/inversions_app
npm run dev
# Debería abrir en http://localhost:5173
```

#### 3. Accede al módulo
- En la UI, verás dos tabs: **Dashboard** y **Análisis de Noticias** (📰)
- Haz clic en **"Análisis de Noticias"**

#### 4. Ingresa datos
**Importante**: Solo dominio, no URL completa

```
┌─────────────────────────────────────────────────────────┐
│ Agregar Fuente Financiera                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Entrada: bloomberg.com                       [ + ]     │
│                                                         │
│ 💡 Hint: Solo dominio (ej: bloomberg.com)             │
│    El sistema buscará automáticamente noticias        │
│    de tu compañía                                      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ ✅ bloomberg.com        (estado: Validando...)        │
│ ✅ cnbc.com             (estado: Válida)              │
│ ❌ mitioweb123.com      (estado: Inválida)            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Compañía a Analizar: Apple                            │
│                                                         │
│     [ Analizar Fuentes ]                             │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ RESULTADO:                                            │
│                                                         │
│ Apple    📈 COMPRAR                                   │
│                                                         │
│ Sentimiento:  ████░░ 0.65                            │
│ Confianza:    ███████░ 85%                           │
│                                                         │
│ Análisis: Bloomberg y CNBC reportan crecimiento      │
│ positivo en ventas de iPhone 16...                   │
│                                                         │
│ • Demanda fuerte de hardware en Q4                    │
│ • Expansión de servicios en crecimiento              │
│ • Competencia moderada en mercado                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 5. Ejemplos de uso

**Ejemplo 1: Análisis único**
```
Dominio: bloomberg.com
Compañía: Tesla
→ Sistema busca noticias de Tesla en Bloomberg
→ Genera veredicto consolidado
```

**Ejemplo 2: Múltiples fuentes**
```
Dominios: 
  • bloomberg.com
  • cnbc.com
  • reuters.com
Compañía: Microsoft
→ Sistema busca en 3 sitios por noticias de Microsoft
→ Consolida análisis
→ Genera veredicto más confiable
```

**Ejemplo 3: Compañías españolas**
```
Dominio: expansion.com o eleconomista.es
Compañía: Banco Santander, Ibex 35, etc.
→ Sistema busca en sitios españoles
```

#### 6. Dominios Soportados

| Sitio | Categoría |
|-------|-----------|
| bloomberg.com | Internacional |
| cnbc.com | Internacional |
| reuters.com | Internacional |
| wsj.com | Internacional |
| ft.com | Internacional |
| tradingview.com | Análisis técnico |
| investopedia.com | Educación |
| seeking.com, seekingalpha.com | Análisis |
| expansion.com | España |
| eleconomista.es | España |
| bolsamadrid.es | España |

---

### Verificación en Navegador

1. Abre DevTools (F12)
2. Ve a tab **Network**
3. Agreg un dominio (ej: bloomberg.com)
4. Verás llamada: `GET /api/news/validate-url?url=bloomberg.com`
   - Respuesta: `{ "valid": true, "message": "Dominio válido" }`
5. Haz clic en "Analizar Fuentes"
6. Verás llamada: `POST /api/news/analyze-sources`
   - Payload: `{ "company": "Apple", "urls": ["bloomberg.com"] }`
   - Respuesta: `{ "verdict": "BUY", "score": 0.65, ... }`

---

### Arquitectura

```
┌─────────────────────────────────────┐
│   Frontend (React 18 + TypeScript)  │
│   NewsSourcesAnalyzer Component     │
│   - SourceInput (agregar URL)       │
│   - SourceList (lista expandible)   │
│   - AnalysisResult (veredicto)      │
└────────────┬────────────────────────┘
             │ HTTP POST/GET
             ▼
┌─────────────────────────────────────┐
│   Backend (Express + TypeScript)    │
│   urlAnalysisService Module         │
│   - Fetch URL & extrae contenido    │
│   - Integra con Claude AI           │
│   - Integra con Alpaca API          │
└────────────┬────────────────────────┘
             │ API Calls
             ▼
┌──────────────┬──────────────┐
│  Claude AI   │  Alpaca API  │
└──────────────┴──────────────┘
```

---

### Variables de Entorno Necesarias

Asegúrate que en tu `.env` están configuradas:

```bash
# Backend (.env)
ANTHROPIC_API_KEY=sk-ant-...
ALPACA_API_KEY=...
ALPACA_API_SECRET=...
```

---

### Características Implementadas v1.1

| Característica | Estado | Detalles |
|---|---|---|
| Agregar dominios | ✅ Completo | Solo dominio, ej: bloomberg.com |
| Búsqueda de compañía | ✅ Completo | IA busca automáticamente noticias de la compañía |
| Mapeo de tickers | ✅ Completo | Busca AAPL para Apple, MSFT para Microsoft, etc. |
| Validación flexible | ✅ Completo | Acepta dominios confiables, rechaza maliciosos |
| Lista expandible | ✅ Completo | Muestra estado: pendiente/válida/inválida/analizada |
| Análisis con Claude | ✅ Completo | Prompt optimizado para análisis de compañía |
| Veredictos BUY/SELL/HOLD | ✅ Completo | Con score y confianza |
| Estilos tema oscuro | ✅ Completo | Consistente con UI existente |
| Responsivo | ✅ Completo | Se adapta a pantallas pequeñas |
| Manejo de errores | ✅ Completo | Mensajes claros y user-friendly |
| Navegación modular | ✅ Completo | AppShell con tabs para múltiples módulos |

---

### Pasos Siguientes (Sugerencias)

1. **Guardar análisis históricos** en Supabase
   - Tabla `news_analysis_results` con timestamps
   - Comparación histórica de veredictos

2. **Alertas** cuando score supera umbral
   - Push notification
   - Email

3. **Integración con Spreads**
   - Usar análisis para ajustar stop-loss
   - Correlacionar con simulaciones

4. **Backtesting**
   - Verificar precisión histórica de veredictos
   - Mejorar prompt de Claude

---

**Implementado por**: GitHub Copilot  
**Versión**: v1.1  
**Última actualización**: 2026-05-24  
**Estado**: ✅ Listo para usar

### Cambios en v1.1
- ✅ Validación flexible (sin rechazar URLs)
- ✅ Búsqueda automática de compañía en dominios
- ✅ Mapeo de tickers para buscar por símbolo bursátil
- ✅ Input simplificado (solo dominio)
- ✅ Mejora en prompts de Claude para análisis específico

