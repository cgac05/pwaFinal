# 🎯 TEAM-07 SixPackDevs - Guía Rápida

**Equipo**: TEAM-07 (SixPackDevs)  
**Lead**: Guillermo Ávila Camberos  
**Objetivo**: Sistema IA de análisis de volatilidad con opciones (Straddle/Strangle)

---

## 🚀 Inicio Rápido (5 minutos)

### 1. Verificar Que Estés en la Rama Correcta
```powershell
git branch -vv
# Deberías ver: * feature/008-team-07-ai-volatility
```

### 2. Ejecutar Proyecto Localmente
```powershell
# Terminal 1 - Backend
cd projects/rest-api/inversions_api
npm run dev

# Terminal 2 - Frontend
cd projects/pwa/inversions_app
npm run dev
```

### 3. Abrir GitHub Copilot Chat y Ejecutar SpecKit
```
/speckit.specify          ← Mejora la especificación (10 min)
/speckit.plan             ← Genera plan detallado (10 min)
/speckit.tasks            ← Expande tareas T151-T170 (15 min)
/speckit.checklist        ← Valida calidad (5 min)
/speckit.analyze          ← Valida consistencia (5 min)
```

**Total**: ~45 minutos para tener especificaciones completas ✅

---

## 📋 Tareas Asignadas (T151-T170)

### Grupo 1: Core AI (T151-T154)
- **T151**: Setup de entorno multi-agente
- **T152**: Implementar agente Analyzer (analiza mercado)
- **T153**: Implementar agente Strategist (selecciona estrategia)
- **T154**: Implementar agente Executor (ejecuta órdenes)

### Grupo 2: Estrategias (T155-T158)
- **T155**: Implementar Straddle (Call + Put mismo strike)
- **T156**: Implementar Strangle (Call strike alto + Put strike bajo)
- **T157**: Adaptadores de brokers (IBKR, Alpaca)
- **T158**: Backtesting de estrategias

### Grupo 3: Análisis Técnico (T159-T162)
- **T159**: Indicadores (RSI, MACD, Bollinger)
- **T160**: IV/HV (volatilidad implícita e histórica)
- **T161**: Detección de patrones (breakouts, support/resistance)
- **T162**: Motor de señales (agregador)

### Grupo 4: Historial (T163-T166)
- **T163**: Modelo de datos de trades
- **T164**: Logging de operaciones (audit trail)
- **T165**: Dashboard de análisis histórico
- **T166**: Exportación de datos (CSV, PDF, MongoDB)

### Grupo 5: Testing (T167-T170)
- **T167**: Unit tests (agentes, estrategias, indicadores)
- **T168**: Integration tests (con brokers/BD)
- **T169**: E2E tests (flujo completo)
- **T170**: Documentación final

---

## 💻 Flujo de Desarrollo para Cada Tarea

### Paso 1: Crear Rama
```powershell
git checkout -b feature/t151-setup-ai-core
# Formato: feature/t{número}-{descripción}
```

### Paso 2: Implementar
```
Backend:  projects/rest-api/inversions_api/src/
Frontend: projects/pwa/inversions_app/src/
Tests:    projects/{rest-api,pwa}/tests/
```

### Paso 3: Tests
```powershell
npm test              # Unit tests
npm run test:integration  # Integration tests
npm run lint:fix      # Linting
```

### Paso 4: Commit
```powershell
git add .
git commit -m "feat(t151): Setup AI multi-agent core

- Configure Claude API
- Implement AgentConfig interface
- Create analyzer/strategist/executor agents

Closes #T151"
```

### Paso 5: Merge a Feature Branch
```powershell
git checkout feature/008-team-07-ai-volatility
git merge feature/t151-setup-ai-core
git push origin feature/008-team-07-ai-volatility
```

---

## 📁 Estructura de Archivos

```
specs/008-team-07-ai-volatility/
├── README.md                      ← TÚ ESTÁS AQUÍ
├── spec.md                        ← Especificación (mejora con /speckit.specify)
├── plan.md                        ← Plan (genera con /speckit.plan)
├── tasks.md                       ← Tareas (expande con /speckit.tasks)
├── checklists/
│   └── requirements.md            ← Checklist (valida con /speckit.checklist)
└── contracts/
    ├── ai-agent-lifecycle.md      ← Interfaces TypeScript (Analyzer/Strategist/Executor)
    ├── volatility-adapter.md      ← Interfaces (Straddle/Strangle)
    └── strategy-context.md        ← Interfaces (contexto de decisión)

Backend:
projects/rest-api/inversions_api/src/
├── agents/                        ← T151-T154
│   ├── analyzer.ts
│   ├── strategist.ts
│   └── executor.ts
├── strategies/volatility/         ← T155-T158
│   ├── straddle.ts
│   └── strangle.ts
├── analysis/                      ← T159-T162
│   ├── indicators/
│   └── signals.ts
└── repositories/                  ← T163-T166
    └── tradesRepository.ts

Frontend:
projects/pwa/inversions_app/src/
└── features/volatility-strategies/
    ├── StrategySelector.tsx
    ├── StrategyChart.tsx
    └── HistoricalTradesTable.tsx
```

---

## 🔗 Dependencias (Orden de Desarrollo)

```
T151 (Setup Core) 
  ↓
T152, T153, T154 (Agentes: Analyzer → Strategist → Executor)
  ↓
T155, T156, T157, T158 (Estrategias: Straddle/Strangle)
  ↓
T159, T160, T161, T162 (Análisis Técnico)
  ↓
T163, T164, T165, T166 (Historial)
  ↓
T167, T168, T169, T170 (Testing & Docs)
```

⚠️ **Importante**: No iniciar una tarea sin que sus dependencias estén ✅ completas

---

## ⚙️ Configuración Inicial

### Variables de Entorno Backend (.env)
```
NODE_ENV=development
PORT=3000
SUPABASE_URL=<tu-url>
SUPABASE_ANON_KEY=<tu-key>
CLAUDE_API_KEY=<tu-key>
```

### Variables de Entorno Frontend (.env)
```
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=<tu-url>
VITE_SUPABASE_ANON_KEY=<tu-key>
```

---

## 🆘 Troubleshooting

| Problema | Solución |
|----------|----------|
| `npm install` falla | `npm cache clean --force && npm install` |
| SpecKit no encontrado | `specify version` (si no está: `python -m pip install uv` luego `uv tool install speckit`) |
| Tests fallan | `npm test -- --verbose` para ver detalles |
| Merge conflicts | Ver archivo, resolver conflictos (<<<<<<, =======, >>>>>>), luego commit |

---

## 📚 Documentación Adicional

- **Especificaciones**: Leer `spec.md` (mejora con SpecKit)
- **Plan detallado**: Ver `plan.md` (genera con SpecKit)
- **Contracts TypeScript**: Ver carpeta `contracts/`
- **Workflow completo**: Ver session memory (TEAM-07-WORKFLOW-GUIDE.md)

---

## ✅ Checklist Pre-Desarrollo

- [ ] ¿Estoy en rama `feature/008-team-07-ai-volatility`?
- [ ] ¿Node.js 22 LTS instalado? (`node --version`)
- [ ] ¿npm 11.x instalado? (`npm --version`)
- [ ] ¿Dependencias instaladas? (`npm install`)
- [ ] ¿Variables de entorno configuradas? (`.env` archivos)
- [ ] ¿Backend inicia? (`npm run dev` en `projects/rest-api/...`)
- [ ] ¿Frontend inicia? (`npm run dev` en `projects/pwa/...`)
- [ ] ¿SpecKit ejecutado? (5 comandos en Copilot Chat)
- [ ] ¿Tasks.md completo? (Abrir y revisar T151-T170)

---

## 🎯 Próximos Pasos

1. ✅ Ejecutar SpecKit (45 min)
2. 👉 Comenzar con T151 (Setup AI Core)
3. Desarrollar T152-T154 (Agentes)
4. Desarrollar T155-T158 (Estrategias)
5. Desarrollar T159-T162 (Análisis)
6. Desarrollar T163-T166 (Historial)
7. Desarrollar T167-T170 (Testing)

**Tiempo total estimado**: 80-120 horas (si es un solo dev) o 2-3 semanas (si es equipo)

---

**¿Preguntas?** Consulta TEAM-07-WORKFLOW-GUIDE.md en session memory para instrucciones detalladas.

**Buena suerte, SixPackDevs! 🚀**
