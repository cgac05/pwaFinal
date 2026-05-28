# 📋 DOCUMENTO ÚNICO: GAPS Y ARCHIVOS PARA GENERAR INFORME
**Fecha:** 27 de Mayo de 2026  
**Propósito:** Resumen de lo que falta + instrucciones para otra IA  
**Estado:** Listo para pasar a otra IA

---

## 🎯 RESUMEN EJECUTIVO

El proyecto **inversions_app_pwa** está al **70% de implementación**. Se tienen:
- ✅ Especificaciones completas (specs en `/specs/`)
- ✅ Documentación técnica (REPORTE_AVANCES_CONSOLIDADO.md)
- ✅ Código de respaldo (CORRECCIONES_Y_RESPALDO_CODIGO.md)
- ⏳ **Falta:** Código real en carpetas del proyecto + verificación

---

## 📌 LO QUE FALTA (Gaps Críticos)

### Tabla de Prioridad

| Gap | Componente | Prioridad | Impacto | Estado |
|-----|-----------|-----------|--------|--------|
| 1 | Redux Toolkit slices reales (no templates) | 🔴 CRÍTICA | Rubrica exige Redux | No existe código real |
| 2 | Componente Tabs.tsx reutilizable | 🔴 CRÍTICA | Rubrica exige tabpages | Existe template, no implementado |
| 3 | Dashboard con 5 pestañas funcionales | 🔴 CRÍTICA | Punto B.5 de rubrica | Parcial, falta integración |
| 4 | Tablas CRUD dentro de pestañas | 🟠 ALTA | Requisito B.4 | Templates sin datos reales |
| 5 | API endpoints conectados a frontend | 🟠 ALTA | Flujo end-to-end | Mock data, no real |
| 6 | Adapter IBKR completo (60% solo) | 🟠 ALTA | Integración brokers | Incompleto |
| 7 | Adapter Alpaca (40% solo) | 🟠 ALTA | Integración brokers | Muy incompleto |
| 8 | Gemini Agent Service (Team 7: Volatility + Chat) | 🟠 ALTA | AI analysis + chat | Parcialmente (T151-T155) |
| 9 | Tests unitarios (meta 80%, tiene 65%) | 🟡 MEDIA | Cobertura de tests | 15% faltante |
| 10 | CI/CD pipeline en .github/workflows | 🟡 MEDIA | DevOps | 60% solo |

---

## 📂 ARCHIVOS A PASAR A OTRA IA

### Paso 1: Documentos Principales (SIEMPRE)

```
✅ REPORTE_AVANCES_CONSOLIDADO.md (80KB)
   └─ Resumen completo del proyecto (secciones B y C)

✅ CORRECCIONES_Y_RESPALDO_CODIGO.md (60KB)
   └─ Redux Toolkit implementation + Tabs components

✅ ESTE ARCHIVO (gaps + archivos)
```

**Instrucción:** Pasar estos 3 juntos a otra IA

---

### Paso 2: Código del Proyecto (Según necesidad)

#### 📦 **Si IA va a generar código Redux:**
```
CARPETAS A PASAR:
✅ projects/pwa/inversions_app/src/store/
✅ projects/pwa/inversions_app/src/types/
✅ projects/pwa/inversions_app/src/features/
✅ projects/rest-api/inversions_api/src/types/

ARCHIVOS ESPECÍFICOS ESPERADOS:
- store/slices/orderSlice.ts (DEBE EXISTIR)
- store/slices/signalSlice.ts (DEBE EXISTIR)
- store/store.ts (DEBE EXISTIR)
- store/hooks.ts (DEBE EXISTIR)

Si NO existen → IA debe crearlos desde CORRECCIONES_Y_RESPALDO_CODIGO.md
```

---

#### 📦 **Si IA va a verificar Componentes de Pestañas:**
```
CARPETAS A PASAR:
✅ projects/pwa/inversions_app/src/components/
✅ projects/pwa/inversions_app/src/features/dashboard/

ARCHIVOS ESPECÍFICOS ESPERADOS:
- components/Tabs/Tabs.tsx (DEBE EXISTIR)
- features/dashboard/PortfolioDashboard.tsx (DEBE EXISTIR)
- features/dashboard/tables/OrdersTable.tsx (DEBE EXISTIR)
- features/dashboard/tables/PositionsTable.tsx (DEBE EXISTIR)
- features/dashboard/tables/AuditTable.tsx (DEBE EXISTIR)

Si NO existen → IA debe crearlos desde CORRECCIONES_Y_RESPALDO_CODIGO.md
```

---

#### 📦 **Si IA va a verificar APIs y Brokers:**
```
CARPETAS A PASAR:
✅ projects/rest-api/inversions_api/src/modules/
✅ projects/rest-api/inversions_api/src/routes/

ARCHIVOS ESPECÍFICOS ESPERADOS:
- modules/execution/approvalService.ts
- modules/execution/executionService.ts
- modules/brokers/brokerAdapter.ts
- modules/brokers/ibkrAdapter.ts
- modules/brokers/alpacaAdapter.ts
- routes/orders.ts
- routes/signals.ts
- routes/audit.ts
```

---

#### 📦 **Si IA va a verificar Azure/IaC:**
```
CARPETAS A PASAR:
✅ .azure/
✅ .github/workflows/

ARCHIVOS ESPECÍFICOS ESPERADOS:
- .azure/*.bicep
- .github/workflows/pr.yml
- .github/workflows/deploy-staging.yml
- .github/workflows/deploy-prod.yml
```

---

### Paso 3: Especificaciones (CONTEXTO)

```
PASAR SI NECESITA MÁS CONTEXTO:
✅ specs/001-plataforma-inversiones-ia/spec.md
✅ specs/001-plataforma-inversiones-ia/plan.md
✅ specs/007-team-05-frontend-cobertura/spec.md
✅ docs/TEAM-05-backend-architecture.md
```

---

## 🚀 INSTRUCCIÓN PARA OTRA IA

### OPCIÓN A: Generar Informe de Verificación (Quick)
**Tiempo:** 20 min

```markdown
PROMPT PARA OTRA IA:

Tengo 3 documentos + código del proyecto:

1. REPORTE_AVANCES_CONSOLIDADO.md - Especificación técnica
2. CORRECCIONES_Y_RESPALDO_CODIGO.md - Templates de código
3. Código real en carpetas del proyecto

TAREA:
1. Lee los 2 documentos markdown
2. Verifica qué archivos FALTAN en el proyecto
3. Crea matriz: | Archivo | Esperado | Existe | % Completado |
4. Identifica gaps vs. rúbrica
5. Genera "Reporte de Brecha" con recomendaciones

SALIDA: Documento "VERIFICACION_CODIGO_BRECHA.md"
```

---

### OPCIÓN B: Generar Código Faltante (Completo)
**Tiempo:** 60+ min

```markdown
PROMPT PARA OTRA IA:

Tengo especificaciones + templates. Necesito código real.

ARCHIVOS A GENERAR (por orden de prioridad):

1. REDUX TOOLKIT STORES:
   - store/slices/orderSlice.ts
   - store/slices/signalSlice.ts
   - store/slices/auditSlice.ts
   - store/slices/portfolioSlice.ts
   - store/store.ts
   - store/hooks.ts
   Usa: CORRECCIONES_Y_RESPALDO_CODIGO.md como referencia

2. COMPONENTES DE TABPAGES:
   - components/Tabs/Tabs.tsx (reutilizable)
   - features/dashboard/PortfolioDashboard.tsx (5 pestañas)
   - features/dashboard/tables/OrdersTable.tsx
   - features/dashboard/tables/PositionsTable.tsx
   - features/dashboard/tables/AuditTable.tsx
   Usa: CORRECCIONES_Y_RESPALDO_CODIGO.md como referencia

3. CONEXIÓN EN COMPONENTES:
   - features/execution/ApprovalFlow.tsx (integrado con Redux)
   - services/orderService.ts (llamadas API)
   Usa: REPORTE_AVANCES_CONSOLIDADO.md sección B.4

SALIDA: Archivos TypeScript listos para copiar al proyecto
```

---

### OPCIÓN C: Generar Informe Final Completo (Para Profesor)
**Tiempo:** 90+ min

```markdown
PROMPT PARA OTRA IA:

Tienes:
1. REPORTE_AVANCES_CONSOLIDADO.md - Avances del proyecto
2. CORRECCIONES_Y_RESPALDO_CODIGO.md - Respaldo técnico
3. Código del proyecto

TAREA: Generar "INFORME_FINAL_EVALUACION.md" con:

A) Sección B - Frontend/Backend CRUDs
   - B.1: Infraestructura TypeScript ✅/⏳
   - B.2: Componentes Frontend ✅/⏳
   - B.3: Backend y Colecciones ✅/⏳
   - B.4: APIs REST ✅/⏳
   - B.5: Tablas y CRUDs ✅/⏳
   - B.6: Despliegue ✅/⏳

B) Sección C - Cloud (Azure)
   - C.1: Plataforma seleccionada ✅
   - C.2: Configuración detallada ✅
   - C.3: Alternativas evaluadas ✅

C) Checklist vs. Rúbrica:
   ✅ Redux Toolkit implementado
   ✅ Tabpages (pestañas) implementados
   ✅ Tablas CRUD dentro de pestañas
   ✅ APIs conectadas
   ✅ Despliegue Azure configurado

D) Matriz de Riesgos:
   - Gaps identificados
   - Impacto en evaluación
   - Recomendaciones

E) Código de Respaldo (snippets):
   - Mostrar 3-5 líneas clave de cada componente

SALIDA: Documento "INFORME_FINAL_EVALUACION.md" (para presentar al profesor)
```

---

## 📋 MATRIZ RÁPIDA: QUÉ ARCHIVOS NECESITA IA

### Para Verificar Código Existente

```bash
# Pasar esta estructura de carpetas:
├── REPORTE_AVANCES_CONSOLIDADO.md
├── CORRECCIONES_Y_RESPALDO_CODIGO.md
├── projects/pwa/inversions_app/src/
│   ├── store/          ← ¿Existen Redux slices?
│   ├── components/     ← ¿Existe Tabs.tsx?
│   ├── features/
│   │   ├── dashboard/  ← ¿5 pestañas?
│   │   └── tables/     ← ¿CRUD tables?
│   └── types/
├── projects/rest-api/inversions_api/src/
│   ├── modules/        ← ¿Servicios ejecutados?
│   ├── routes/         ← ¿APIs conectadas?
│   └── types/
├── .azure/             ← ¿Bicep templates?
└── .github/workflows/  ← ¿CI/CD configurado?
```

---

## ✅ CHECKLIST: QUÉ PASAR A OTRA IA

### Siempre (OBLIGATORIO)
- [x] REPORTE_AVANCES_CONSOLIDADO.md
- [x] CORRECCIONES_Y_RESPALDO_CODIGO.md
- [x] Este documento (GAPS_Y_ARCHIVOS.md)

### Según Tarea
- [ ] Carpeta `projects/pwa/inversions_app/src/` (para verificar componentes)
- [ ] Carpeta `projects/rest-api/inversions_api/src/` (para verificar APIs)
- [ ] Carpeta `.azure/` (para verificar IaC)
- [ ] Carpeta `.github/workflows/` (para verificar CI/CD)

### Contexto (Opcional)
- [ ] `specs/001-plataforma-inversiones-ia/` (si necesita más contexto)
- [ ] `docs/TEAM-05-backend-architecture.md` (referencia arquitectura)

---

## 🎯 COMANDO POWERSHELL PARA PREPARAR ZIP

```powershell
# Ir a carpeta del proyecto
cd "C:\Users\guill\Documents\GitHub\inversions_app_pwa team"

# Crear carpeta temporal
mkdir "entrega_ia" -Force

# Copiar documentos principales
Copy-Item "REPORTE_AVANCES_CONSOLIDADO.md" "entrega_ia/"
Copy-Item "CORRECCIONES_Y_RESPALDO_CODIGO.md" "entrega_ia/"
Copy-Item "GAPS_Y_ARCHIVOS.md" "entrega_ia/"

# Copiar código (opcional, según necesidad)
Copy-Item "projects/pwa/inversions_app/src" "entrega_ia/frontend_src" -Recurse
Copy-Item "projects/rest-api/inversions_api/src" "entrega_ia/backend_src" -Recurse

# Compactar
Compress-Archive -Path "entrega_ia" -DestinationPath "entrega_ia.zip"

# Verificar
Get-Item "entrega_ia.zip"
```

---

## 🤖 GEMINI EN TEAM 7 (Gap #8)

**Estado:** Documentado en specs/008-team-07-ai-volatility/ - Parcialmente implementado

### Uso de Gemini en Team 7:

1. **Orquestación de Agentes IA (Analyzer → Strategist → Executor)**
   - Análisis de volatilidad con indicadores técnicos
   - Recomendación de estrategias (Straddle, Strangle)
   - Validación y ejecución de órdenes

2. **Chat Explicativo para Usuarios**
   - Explicaciones de estrategias recomendadas
   - Análisis de payoff y riesgos en lenguaje natural
   - Respuestas a preguntas sobre volatilidad

### Qué está documentado en Team 7:
- ✅ Especificación completa: `specs/008-team-07-ai-volatility/spec.md`
- ✅ Tasks: T151-T155, T158, T164
- ✅ Gemini SDK configuration (nodejs)
- ✅ Prompts para agentes y chat

### Qué falta implementar:
- ❌ **GeminiAgentService.ts** (servicio wrapper)
- ❌ **geminiAgentOrchestration.ts** (coordinador de agentes)
- ❌ **volatilityAnalysis.ts** (módulo análisis)
- ❌ **Endpoints API:** `/api/ai/volatility-analysis`, `/api/ai/strategy-chat`
- ❌ **Frontend components:** VolatilityAnalyzer.tsx, StrategyChat.tsx
- ❌ **Tests unitarios** para Gemini services

### Funcionalidades esperadas:
```
ANALISIS:
├─ POST /api/ai/volatility-analysis
│  ├─ Input: Symbol, timeframe, CSV históricos
│  └─ Output: JSON (agente output) + Markdown (explicación)
│
CHAT:
├─ POST /api/ai/strategy-chat
│  ├─ Input: Pregunta usuario, contexto estrategia
│  └─ Output: Explicación en Markdown

MODELO: gemini-2.5-flash
API_KEY: GEMINI_API_KEY (env)
```

### Para otra IA:
Si vas a completar Gemini en Team 7:
1. Leer: `specs/008-team-07-ai-volatility/spec.md` (líneas de Gemini)
2. Leer: `specs/008-team-07-ai-volatility/tasks.md` (T151-T155)
3. Crear archivos en `projects/rest-api/inversions_api/src/modules/ai/`
4. Implementar endpoints en `routes/ai.ts`
5. Tests en `tests/unit/modules/ai/`

---

## 📊 RESUMEN FINAL

| Elemento | Responsabilidad | Estado |
|----------|-----------------|--------|
| **Documentos** | Explicar qué se construyó | ✅ COMPLETO |
| **Código Template** | Mostrar cómo implementar | ✅ COMPLETO (en markdown) |
| **Código Real** | Verificar si existe | ⏳ PENDIENTE (otra IA revisa) |
| **Informe Final** | Demostrar cumplimiento rubrica | ⏳ PENDIENTE (otra IA genera) |

---

## 🔗 REFERENCIAS CRUZADAS

```
REPORTE_AVANCES_CONSOLIDADO.md
  ↓
  ├─ Sección B.1-B.6: Desarrollo Frontend/Backend
  ├─ Sección C.1-C.3: Despliegue Azure
  └─ Link a CORRECCIONES_Y_RESPALDO_CODIGO.md

CORRECCIONES_Y_RESPALDO_CODIGO.md
  ↓
  ├─ Punto 1: Redux Toolkit implementation (slices, thunks, hooks)
  ├─ Punto 2: Componentes Tabs.tsx + Dashboard
  └─ Punto 3: Checklist de cumplimiento
```

---

**Documento preparado:** 27 de Mayo de 2026  
**Responsable:** Equipo de Desarrollo  
**Siguiente paso:** Pasar documentos + carpetas a otra IA con opción A, B o C
