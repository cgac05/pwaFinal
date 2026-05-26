# T5 - Actividad 3: Presentación y Entrega del Proyecto Integrador Final con Arquitectura SAP CDS

**Proyecto:** InversionesPWA-NOSQL — Core de Indicadores Técnicos + Chat IA Explicativo
**Equipo:** TEAM-02 *CocaDe6Lts*
**Integrantes:**
- Hansel (*Team Lead* — Chat IA + e2e + calidad)
- Edgar (Tendencia / Volatilidad — EMA, ADX, Bollinger)
- Kevin (Momentum — RSI, MACD)
- Mauricio (Confluencia + Health + Trazabilidad)

**Feature:** `003-team-02-core-indicadores`
**Repositorio:** https://github.com/BetoCW/InversionsPWA-NOSQL-COREINDICADORES
**Fecha de entrega:** 2026-05-24

---

## Tabla de Contenidos

- [A) Documentación de Desarrollo del Proyecto](#a-documentación-de-desarrollo-del-proyecto)
  - [A.1 Manual Técnico](#a1-manual-técnico)
  - [A.2 Manual de Usuario](#a2-manual-de-usuario)
- [B) Guía de Presentación y Metodología](#b-guía-de-presentación-y-metodología)
  - [B.1 Análisis y Diseño](#b1-análisis-y-diseño)
  - [B.2 Metodología de Desarrollo](#b2-metodología-de-desarrollo)
  - [B.3 Codificación e Implementación del Core](#b3-codificación-e-implementación-del-core)
  - [B.4 Pruebas Funcionales](#b4-pruebas-funcionales)
  - [B.5 Enlaces de Videos](#b5-enlaces-de-videos-placeholder)

---

# A) Documentación de Desarrollo del Proyecto

## A.1 Manual Técnico

### A.1.1 Visión General de la Arquitectura

El proyecto **InversionesPWA-NOSQL** es una plataforma de análisis técnico de mercados
financieros, materializada como **Progressive Web App (PWA)** con un backend REST en
Node.js / TypeScript. Sigue un enfoque **monorepo multi-workspace (npm workspaces)**
y se inspira en los principios de **SAP Cloud Application Programming Model (CAP)** y
**SAP Core Data Services (CDS)** para la capa de modelado de datos, separación de
preocupaciones y exposición declarativa de servicios.

**Capas principales:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Frontend PWA (React + Vite)        →  projects/pwa/inversions_app │
│  Service Worker / Cache offline                                  │
└──────────────────────────────────────────────────────────────────┘
                            │  HTTPS / JSON
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  REST API (Express 4 + TypeScript 5.6)                           │
│  projects/rest-api/inversions_api                                │
│  ├── /api/indicators/*    (RSI, MACD, EMA, ADX, Bollinger)       │
│  ├── /api/indicators/confluence  (motor de confluencia)          │
│  ├── /api/indicators/health      (health-check del core)         │
│  └── /api/chat/explain           (Chat IA explicativo)           │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  Capa de Datos (NoSQL + fuente OHLC determinista mock)           │
│  Diseño inspirado en SAP CDS: entidades, vistas, asociaciones    │
└──────────────────────────────────────────────────────────────────┘
```

### A.1.2 Arquitectura SAP CDS Aplicada

Aunque el proyecto no usa el runtime nativo de SAP CAP, **aplica los principios
arquitectónicos de SAP CDS**:

| Principio SAP CDS | Aplicación en InversionesPWA-NOSQL |
|---|---|
| **Entidades declarativas** | Tipos TypeScript en `projects/packages/types/` definen entidades `Candle`, `IndicatorResult`, `ConfluenceVerdict`, `ChatExplanation` como contratos compartidos. |
| **Vistas proyectadas** | Las funciones de indicadores actúan como *projections*: a partir de la entidad `Candle[]` derivan vistas como `RsiSeries`, `MacdSeries`, etc. |
| **Servicios expuestos** | Cada router Express en `src/routes/indicators/*` expone un servicio CRUD-like de solo lectura sobre la entidad calculada. |
| **Asociaciones** | `ConfluenceVerdict.components[]` asocia el veredicto con los 5 indicadores subyacentes mediante referencia por nombre y peso. |
| **Anotaciones de calidad** | Cada respuesta incluye `algorithm_version`, `source_input_hash` y `bars_used` como metadatos de trazabilidad, equivalentes a las *annotations* de CDS. |
| **Contratos OpenAPI** | Los archivos `specs/003-team-02-core-indicadores/contracts/*.openapi.yaml` actúan como el equivalente a los CDS `service definitions` (`service.cds`). |

### A.1.3 Estructura del Repositorio (Monorepo)

```
InversionesPWA-NOSQL/
├── projects/
│   ├── pwa/inversions_app/          → PWA React (TEAM-01)
│   ├── rest-api/inversions_api/     → API REST (TEAM-02 core)
│   └── packages/
│       ├── types/                   → Tipos compartidos (contratos CDS)
│       ├── ui-library/              → Componentes UI compartidos
│       └── utils/                   → Utilerías comunes
├── specs/
│   ├── 001-plataforma-inversiones-ia/
│   ├── 002-team-01-dashboard-brokers/
│   └── 003-team-02-core-indicadores/  ← Feature TEAM-02
│       ├── spec.md                  → Requisitos funcionales
│       ├── plan.md                  → Plan técnico
│       ├── tasks.md                 → Desglose de tareas T000–T072
│       └── contracts/*.openapi.yaml → Contratos del servicio (CDS-like)
├── scripts/                         → Scripts de validación (FIC linter)
├── package.json                     → Workspaces npm
└── README.md
```

### A.1.4 Modelo de Datos / Enfoque NoSQL

El proyecto adopta un enfoque **NoSQL documental** porque los datos de mercado
(candelas OHLC, resultados de indicadores, conversaciones del chat) son:

- **Semi-estructurados** y de esquema flexible (parámetros variables por indicador).
- **Time-series intensivos** (alta frecuencia, lectura secuencial).
- **Idempotentes y reproducibles** por `source_input_hash`.

**Entidades principales (estilo CDS):**

```typescript
// Entidad raíz — fuente OHLC
entity Candle {
  symbol      : String;       // p.ej. "AAPL"
  timeframe   : Timeframe;    // 1m | 5m | 15m | 1h | 4h | 1d
  time        : Timestamp;
  open        : Decimal;
  high        : Decimal;
  low         : Decimal;
  close       : Decimal;
  volume      : Decimal;
}

// Vista proyectada — resultado de un indicador
entity IndicatorResult {
  symbol            : String;
  timeframe         : Timeframe;
  algorithm_version : String;
  source_input_hash : String;
  bars_used         : Integer;
  current_value     : Decimal;
  series            : Array of IndicatorPoint;
  zone              : Zone;       // alcista | bajista | neutral | unknown
}

// Agregado — veredicto de confluencia
entity ConfluenceVerdict {
  verdict     : Verdict;          // alcista | neutral | bajista
  score       : Decimal;          // [-1, 1]
  components  : Composition of many {
    indicator    : String;
    weight       : Decimal;
    contribution : Decimal;
    available    : Boolean;
  };
  degraded    : Boolean;
  missing     : Array of String;
}

// Servicio — Chat explicativo
entity ChatExplanation {
  explanation   : String;
  citations     : Array of String;  // mínimo 3 de 5 indicadores
  disclaimer    : String;           // constitucional, siempre presente
  refused       : Boolean;
  reason        : String;
}
```

### A.1.5 Lógica del Core de Indicadores

Cada indicador es una **función pura** en `src/modules/indicators/`:

| Indicador | Archivo | Algoritmo | Owner |
|---|---|---|---|
| **RSI** | `rsi.ts` | RSI de Wilder con suavizado exponencial; `period=14` por defecto. | Kevin |
| **MACD** | `macd.ts` | EMA(12) − EMA(26), señal EMA(9), histograma y detección de cruce (`bullish`/`bearish`/`none`). | Kevin |
| **EMA** | `ema.ts` | Media móvil exponencial con `period=20` por defecto. | Edgar |
| **ADX** | `adx.ts` | ADX + `+DI`/`-DI` con suavizado de Wilder; clasifica fuerza (`sin_tendencia`/`debil`/`fuerte`/`muy_fuerte`). | Edgar |
| **Bollinger** | `bollinger.ts` | Bandas con `period=20`, `stdDev=2`; expone `bandwidth` y `%B`. | Edgar |
| **Confluencia** | `confluence.ts` | Combinación ponderada de los 5 indicadores, con política de degradación. | Mauricio |
| **Chat IA** | `chatExplainer.ts` | Orquestador con interfaz `LlmExplainer` y mock determinista. | Hansel |

**Política de degradación (Mauricio):**
- Si falta 1 indicador → `degraded: true` y se lista en `missing[]`.
- Si hay menos de 3 disponibles → `verdict = neutral` (nunca 500).
- Garantiza disponibilidad y nunca rompe el contrato del servicio.

**Regla constitucional (NFR-01):**
> La IA y los indicadores **solo evalúan/explican**, nunca ejecutan ni recomiendan.
> Toda respuesta del Chat IA incluye el disclaimer:
> *"esta explicación no constituye orden ni recomendación ejecutable"*.

### A.1.6 Endpoints REST (Contrato del Servicio)

| Método | Ruta | Descripción | Owner |
|---|---|---|---|
| GET | `/api/indicators/rsi` | RSI de Wilder | Kevin |
| GET | `/api/indicators/macd` | MACD + detección de cruce | Kevin |
| GET | `/api/indicators/ema` | Media móvil exponencial | Edgar |
| GET | `/api/indicators/adx` | ADX + `+DI`/`-DI` + fuerza | Edgar |
| GET | `/api/indicators/bollinger` | Bandas + `bandwidth` + `%B` | Edgar |
| GET | `/api/indicators/confluence` | Veredicto consolidado | Mauricio |
| GET | `/api/indicators/health` | Salud del core | Mauricio |
| POST | `/api/chat/explain` | Chat IA explicativo | Hansel |

**Parámetros comunes:** `symbol` (obligatorio), `timeframe` (default `1h`), `count`
(default 300), más parámetros propios de cada indicador.

**Errores estructurados:** `{ error_code, message, hint? }`
- `400` parámetros inválidos · `404` symbol sin datos · `422` velas insuficientes.

### A.1.7 Requisitos del Sistema

| Componente | Versión mínima | Notas |
|---|---|---|
| Node.js | 20.x | LTS recomendada |
| npm | 10.x | Soporte de workspaces |
| TypeScript | 5.6 | Configurado en cada workspace |
| Express | 4.x | Framework HTTP |
| Vitest | 4.x | Test runner + cobertura |
| Supertest | 7.x | Integración HTTP |
| RAM | 4 GB | Para tests + dev server |
| Navegador | Chrome 120+ / Edge 120+ / Firefox 120+ | Para la PWA |

### A.1.8 Configuración e Instalación

```bash
# 1. Clonar repositorio
git clone https://github.com/BetoCW/InversionsPWA-NOSQL-COREINDICADORES.git
cd InversionsPWA-NOSQL-COREINDICADORES

# 2. Instalar dependencias (todos los workspaces)
npm install

# 3. Levantar API REST en modo dev
npm run -w @inversions/rest-api dev
# → http://localhost:3000

# 4. Validar los 3 gates obligatorios
npm run -w @inversions/rest-api lint          # tsc --noEmit
npm run -w @inversions/rest-api test          # 177 tests
npm run lint:fic                              # convención de comentarios
```

**Variables de entorno (opcionales):**

```
PORT=3000
NODE_ENV=development
LLM_PROVIDER=mock          # mock | openai | anthropic (pendiente T070)
LLM_API_KEY=               # solo si LLM_PROVIDER != mock
OHLC_SOURCE=mock           # mock | team01 (pendiente T071)
```

### A.1.9 Estado de Calidad y Cobertura

| Gate | Resultado |
|---|---|
| `lint` (tsc --noEmit) | ✅ sin errores |
| Tests del core de indicadores | ✅ **116 tests en verde** (16 archivos) |
| Suite REST API completa | ✅ **177 tests en verde** (31 archivos) |
| `lint:fic` | ✅ OK |
| Cobertura `src/modules/indicators/**` | ✅ **94.75% statements / 97.02% lines** (gate ≥ 80%) |

---

## A.2 Manual de Usuario

### A.2.1 Acerca de la Aplicación

InversionesPWA-NOSQL es una **PWA de análisis técnico** que permite a inversionistas
e investigadores:

- Consultar 5 indicadores técnicos clásicos (RSI, MACD, EMA, ADX, Bollinger).
- Obtener un **veredicto de confluencia** consolidado de los 5.
- Solicitar una **explicación en lenguaje natural** (Chat IA) de la señal técnica
  actual, en español, con citas a los indicadores que la sustentan.

> ⚠️ **Aviso constitucional:** La plataforma es exclusivamente **explicativa**.
> No ejecuta órdenes, no recomienda compras/ventas. Cualquier decisión de inversión
> es responsabilidad del usuario.

### A.2.2 Acceso e Instalación de la PWA

1. Abra el navegador (Chrome / Edge / Firefox).
2. Visite la URL de la aplicación (en local: `http://localhost:5173`).
3. En la barra de URL, haga clic en el ícono **"Instalar app"** para instalarla como
   PWA. Quedará disponible como aplicación nativa en su escritorio/menú.
4. Funciona **offline parcialmente** (gracias al Service Worker) para los datos ya
   consultados.

### A.2.3 Navegación Principal

```
┌──────────────────────────────────────────────────────────┐
│  [Logo]  Watchlist | Dashboard | Chat IA | Configuración │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Panel Izquierdo:        Panel Central:                  │
│  ▸ Watchlist Tree        ▸ SuperChart (OHLC + overlays)  │
│  ▸ Símbolos favoritos    ▸ Indicadores activos           │
│                                                          │
│  Panel Derecho:                                          │
│  ▸ Tabla de Confluencia (5 indicadores + veredicto)      │
│  ▸ Botón "Explicar con IA"                               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### A.2.4 Guía Paso a Paso

**Caso de uso 1 — Consultar un indicador individual (RSI de AAPL en 1h):**

1. En el panel izquierdo, busque y seleccione `AAPL`.
2. En el SuperChart, elija el timeframe `1h`.
3. Active el indicador **RSI** desde el menú "Indicadores".
4. Se mostrará la serie RSI alineada con las velas; el `current_value` y la `zone`
   aparecen a la derecha.

**Caso de uso 2 — Ver veredicto de confluencia:**

1. Con un símbolo seleccionado, abra el panel derecho **"Confluencia"**.
2. Verá los 5 indicadores con su peso y contribución.
3. El veredicto consolidado aparece en grande: `alcista` / `neutral` / `bajista`.
4. Si algún indicador no tiene datos suficientes, verá la etiqueta `degraded` con
   la lista de los que faltan.

**Caso de uso 3 — Solicitar explicación con Chat IA:**

1. Haga clic en **"Explicar con IA"** o vaya a la pestaña `Chat IA`.
2. Escriba su pregunta (en cualquier idioma): *"¿Por qué la señal está así?"*
3. El sistema responderá **en español**, citando al menos 3 de los 5 indicadores.
4. La respuesta incluye siempre el disclaimer constitucional.
5. Si pregunta algo del tipo *"ejecuta una compra de AAPL"*, el chat responderá con
   `refused: true` y una explicación de por qué no puede ejecutar órdenes.

### A.2.5 Descripción de Funcionalidades

| Funcionalidad | Descripción |
|---|---|
| **Watchlist Tree** | Árbol jerárquico de símbolos favoritos (TEAM-01). |
| **SuperChart** | Gráfico OHLC con overlays de indicadores. |
| **Tabla de Confluencia** | Veredicto consolidado + desglose por indicador. |
| **Chat IA Explicativo** | Conversación en lenguaje natural sobre la señal técnica. |
| **Health-check** | Indicador en vivo del estado del core (verde/amarillo/rojo). |
| **Runtime Mode Switches** | Cambiar entre modo demo / live / mock. |
| **Trazabilidad** | Cada respuesta muestra `algorithm_version` y `bars_used`. |

### A.2.6 Resolución de Problemas (Troubleshooting)

| Problema | Causa probable | Solución |
|---|---|---|
| "error_code: INVALID_PARAMS" | Timeframe o symbol mal escrito. | Verifique que el timeframe sea uno de `1m,5m,15m,1h,4h,1d`. |
| "error_code: NOT_FOUND" | El símbolo no existe en la fuente OHLC mock. | Use un símbolo válido (AAPL, MSFT, GOOGL, etc.). |
| "error_code: INSUFFICIENT_BARS" | El indicador requiere más velas. | Aumente `count` (por ejemplo a 500). ADX necesita `2 * period` mínimo. |
| Veredicto siempre `neutral` | Menos de 3 indicadores disponibles. | Aumente `count` o revise `/api/indicators/health`. |
| Chat IA responde con `refused:true` | Pregunta implica ejecutar órdenes. | Reformule en términos explicativos: *"¿qué indica este patrón?"* |
| PWA no carga offline | Service Worker no instalado. | Recargue la página una vez online y vuelva a probar. |
| Puerto 3000 ocupado | Otro proceso usa el puerto. | Cambie `PORT` en variables de entorno o cierre el proceso. |

---

# B) Guía de Presentación y Metodología

> Esta sección está diseñada como **guion completo** para la presentación en video
> del equipo. Cada integrante encontrará su parte detallada, con qué decir, qué
> mostrar en pantalla y qué demostrar en vivo.

## B.1 Análisis y Diseño

### B.1.1 Problema Inicial

**Contexto:** Los inversionistas minoristas tienen acceso a múltiples herramientas
de análisis técnico, pero éstas:

1. **Operan como cajas negras** — no explican *por qué* dan una señal.
2. **Mezclan análisis con ejecución** — empujan al usuario a operar sin contexto.
3. **No consolidan** los indicadores en un veredicto interpretable.
4. **Carecen de trazabilidad** — no se puede verificar la versión del algoritmo
   ni reproducir un resultado pasado.

**Pregunta de diseño:** *¿Cómo construir una plataforma que explique la señal
técnica de manera consolidada, en lenguaje natural, sin convertirse en un
recomendador de inversiones?*

### B.1.2 Levantamiento de Requisitos

Requisitos derivados del `spec.md` de la feature `003-team-02-core-indicadores`:

**Funcionales (FR):**
- FR-01: Calcular RSI, MACD, EMA, ADX y Bollinger sobre velas OHLC.
- FR-02: Consolidar los 5 indicadores en un veredicto de confluencia.
- FR-03: Exponer cada cálculo como endpoint REST con contrato OpenAPI.
- FR-04: Proveer Chat IA explicativo en español.
- FR-05: Reportar la salud del core (`/health`) sin lanzar excepciones.

**No funcionales (NFR):**
- NFR-01: **Constitucional** — solo explicación, jamás recomendación ejecutable.
- NFR-02: **Idempotencia** — mismas velas → mismo resultado (`source_input_hash`).
- NFR-03: **Resiliencia** — el endpoint de confluencia nunca devuelve 500.
- NFR-04: **Cobertura ≥ 80%** statements/lines en el módulo de indicadores.
- NFR-05: **Trazabilidad** — todo resultado expone `algorithm_version` y `bars_used`.

### B.1.3 Diseño del Sistema

**Patrones aplicados:**

- **Arquitectura hexagonal (Ports & Adapters):** las funciones puras de indicadores
  son el dominio; los routers Express son los adaptadores HTTP.
- **Inversión de dependencias:** `LlmExplainer` es una interfaz; en producción se
  conectaría a un proveedor real, en tests se inyecta `DeterministicMockExplainer`.
- **CDS-inspired projections:** cada indicador es una vista proyectada sobre la
  entidad `Candle[]`.
- **Trazabilidad por hash:** `source_input_hash` permite verificar reproducibilidad.

**Decisiones de diseño clave:**

| Decisión | Justificación |
|---|---|
| Funciones puras + routers delgados | Testabilidad y portabilidad. |
| NoSQL documental (no relacional) | Datos time-series con esquemas variables. |
| Mock OHLC determinista | Permite tests reproducibles sin depender de TEAM-01. |
| Disclaimer en cada respuesta del chat | Cumplimiento de NFR-01 (constitucional). |
| Degradación en confluencia | Resiliencia ante indicadores ausentes. |
| Contratos OpenAPI por endpoint | Documentación viva y validación de cliente. |

---

## B.2 Metodología de Desarrollo

### B.2.1 Metodología Adoptada: **Scrum Adaptado + Spec-Driven Development (SDD)**

El equipo TEAM-02 trabajó con una variante de **Scrum** combinada con **Spec-Driven
Development** (la metodología del SDD/Spec-Kit del proyecto). Esto significa:

1. **Toda funcionalidad comienza con un `spec.md`** (qué se va a construir y por qué).
2. Se desglosa en un `plan.md` (cómo se va a construir).
3. Se atomiza en `tasks.md` con identificadores `T000–T099`, asignados por owner.
4. Se ejecuta en sprints cortos con tests primero (TDD).

### B.2.2 Roles del Equipo

| Rol | Integrante | Responsabilidad |
|---|---|---|
| **Team Lead / Scrum Master** | Hansel | Coordinación, Chat IA, e2e, calidad. |
| **Dev — Momentum** | Kevin | RSI + MACD (T010–T020). |
| **Dev — Tendencia/Volatilidad** | Edgar | EMA + ADX + Bollinger (T030–T033). |
| **Dev — Confluencia + Infra** | Mauricio | Confluencia + Health + Trazabilidad (T040–T046). |

### B.2.3 Aplicación de Scrum

| Ceremonia | Frecuencia | Resultado |
|---|---|---|
| **Sprint Planning** | Inicio de cada sprint (semanal) | Selección de tareas `T0xx` del backlog. |
| **Daily Standup** | Diario (15 min) | Sincronización de bloqueos. |
| **Sprint Review** | Fin de sprint | Demo de endpoints en Postman/curl. |
| **Retrospectiva** | Fin de sprint | Mejoras al flujo (p.ej. PRs más pequeños). |

### B.2.4 Flujo de Trabajo Git

- **Branch principal:** `main`
- **Feature branches:** `003-team-02-core-indicadores/<owner>/<task>` (p.ej.
  `003-.../kevin/rsi-T010`).
- **Pull Requests obligatorios** con revisión de al menos un miembro.
- **Convención de commits:** `feat(team-02): ...`, `fix(...)`, `test(...)`.
- **Commit final del feature:** `7fac3ca feat(team-02): core de indicadores tecnicos + confluencia + Chat IA`.

### B.2.5 Definition of Done (DoD)

Una tarea se considera **terminada** sólo si cumple los **3 gates obligatorios**:

1. ✅ **Gate 1 — Tipado:** `tsc --noEmit` sin errores.
2. ✅ **Gate 2 — Tests:** tests unitarios + integración en verde.
3. ✅ **Gate 3 — Convención FIC:** `npm run lint:fic` OK (dos líneas de comentario
   inglés/español al inicio de cada archivo nuevo).

Además: cobertura ≥ 80% en el módulo y contrato OpenAPI actualizado.

---

## B.3 Codificación e Implementación del Core

> **Para la presentación:** esta sección está dividida por integrante. Cada uno
> debe poder explicar **su parte** mostrando el código real en pantalla.

### B.3.1 Kevin — Momentum (RSI + MACD) · T010–T020

**Archivos a mostrar:**
- `projects/rest-api/inversions_api/src/modules/indicators/rsi.ts`
- `projects/rest-api/inversions_api/src/modules/indicators/macd.ts`
- `projects/rest-api/inversions_api/src/routes/indicators/rsi.ts`
- `projects/rest-api/inversions_api/src/routes/indicators/macd.ts`

**Guion sugerido (3-4 min):**

1. *"Mi parte es el módulo de momentum: RSI y MACD. El RSI mide la fuerza relativa
   de las subidas vs. bajadas en un período."*
2. Mostrar `rsi.ts`: explicar el suavizado de Wilder (no es un promedio simple).
3. Mostrar la salida: `current_value` siempre en `[0,100]`, `zone` clasificada
   (`sobrecomprado` > 70, `sobrevendido` < 30, `neutral` en medio).
4. *"El MACD calcula la diferencia entre dos EMAs (12 y 26), su señal EMA(9) y el
   histograma; además detecta cruces."*
5. Mostrar `macd.ts`: explicar la detección de cruce (`bullish` / `bearish` / `none`).
6. Demo: `curl "http://localhost:3000/api/indicators/rsi?symbol=AAPL&timeframe=1h"`
7. *"Reproducibilidad: las mismas velas siempre dan el mismo `source_input_hash`."*

**Comandos para validar en vivo:**
```bash
npm run -w @inversions/rest-api test -- tests/unit/indicators/rsi.test.ts tests/unit/indicators/macd.test.ts tests/integration/indicators/rsiRoute.test.ts tests/integration/indicators/macdRoute.test.ts
```

### B.3.2 Edgar — Tendencia y Volatilidad (EMA + ADX + Bollinger) · T030–T033

**Archivos a mostrar:**
- `src/modules/indicators/ema.ts`
- `src/modules/indicators/adx.ts`
- `src/modules/indicators/bollinger.ts`
- `src/routes/indicators/{ema,adx,bollinger}.ts`

**Guion sugerido (3-4 min):**

1. *"Mi parte cubre tendencia (EMA, ADX) y volatilidad (Bollinger)."*
2. Mostrar `ema.ts`: explicar que la EMA da más peso a las velas recientes y por
   qué es base para MACD y otros indicadores.
3. Mostrar `adx.ts`: explicar `+DI` / `-DI`, el suavizado de Wilder, y la
   clasificación de `strength` en 4 niveles. Requiere `2 * period` velas mínimo.
4. Mostrar `bollinger.ts`: explicar que el `bandwidth` mide volatilidad y `%B`
   indica dónde está el precio dentro de las bandas.
5. Mostrar el registro de los 3 routers en `src/index.ts`.
6. Demo: `curl "http://localhost:3000/api/indicators/adx?symbol=AAPL&timeframe=1h"`

**Comandos para validar en vivo:**
```bash
npm run -w @inversions/rest-api test -- tests/unit/indicators/ema.test.ts tests/unit/indicators/adx.test.ts tests/unit/indicators/bollinger.test.ts tests/integration/indicators/emaRoute.test.ts tests/integration/indicators/adxRoute.test.ts tests/integration/indicators/bollingerRoute.test.ts
```

### B.3.3 Mauricio — Confluencia + Health + Trazabilidad · T040–T046

**Archivos a mostrar:**
- `src/modules/indicators/confluence.ts`
- `src/routes/indicators/confluence.ts`
- `src/routes/indicators/health.ts`
- `src/modules/indicators/types.ts` (`ConfluenceVerdict`)

**Guion sugerido (3-4 min):**

1. *"Mi parte es el cerebro consolidador: toma los 5 indicadores y emite UN solo
   veredicto."*
2. Mostrar `confluence.ts`: explicar la combinación ponderada de los 5 scores en
   un único `score ∈ [-1, 1]`.
3. Énfasis en la **política de degradación**: si falta 1 → `degraded:true`; si
   menos de 3 disponibles → `neutral`. **Nunca 500.**
4. Mostrar el endpoint `/health` que reporta el estado de la fuente OHLC y de
   cada indicador, sin lanzar excepciones.
5. Mostrar los campos de **trazabilidad**: `source_input_hash`, `algorithm_version`,
   `bars_used` — y por qué importan (reproducibilidad y auditoría).
6. Demo: `curl "http://localhost:3000/api/indicators/confluence?symbol=AAPL&timeframe=1h"`
7. Mostrar que con `count=10` (muy pocas velas) el veredicto cae a `neutral` con
   `degraded:true`, **pero no falla**.

**Comandos para validar en vivo:**
```bash
npm run -w @inversions/rest-api test -- tests/unit/indicators/confluence.test.ts tests/integration/indicators/confluenceRoute.test.ts tests/integration/indicators/healthRoute.test.ts
```

### B.3.4 Hansel — Chat IA + e2e + Calidad · T050–T062

**Archivos a mostrar:**
- `src/modules/indicators/chatExplainer.ts`
- `src/routes/indicators/chatExplain.ts`
- `tests/integration/indicators/e2eChat.test.ts`

**Guion sugerido (4-5 min):**

1. *"Mi parte es la capa explicativa: el Chat IA que traduce la señal técnica a
   lenguaje natural en español."*
2. Mostrar `chatExplainer.ts`: explicar la interfaz `LlmExplainer` (puerto) y el
   `DeterministicMockExplainer` (adaptador para tests).
3. **Reglas constitucionales que enforce el chat:**
   - Disclaimer **siempre** presente.
   - Pregunta que implica ejecutar orden → `refused:true` con `200` (no 4xx).
   - Cita al menos 3 de 5 indicadores cuando hay confluencia.
   - Responde en **español** aunque la pregunta venga en otro idioma.
4. Demo e2e: mostrar `e2eChat.test.ts` que recorre el flujo completo:
   `OHLC → 5 indicadores → confluencia → chat`.
5. Demo en vivo:
   ```bash
   curl -X POST http://localhost:3000/api/chat/explain \
     -H "Content-Type: application/json" \
     -d '{"symbol":"AAPL","timeframe":"1h","question":"why is the signal like this?"}'
   ```
6. Mostrar que la respuesta vuelve en español, cita indicadores, e incluye
   disclaimer.
7. Mostrar pregunta "rechazada":
   ```bash
   curl -X POST http://localhost:3000/api/chat/explain \
     -H "Content-Type: application/json" \
     -d '{"symbol":"AAPL","timeframe":"1h","question":"ejecuta una compra de AAPL"}'
   ```
   Responde con `200` y `refused:true`.
8. Cerrar con los **números de calidad**: 116 tests verdes en el core, 177 en la
   suite REST completa, cobertura 94.75% / 97.02%.

**Comandos para validar en vivo:**
```bash
npm run -w @inversions/rest-api test -- tests/unit/indicators/chatExplainer.test.ts tests/integration/indicators/chatExplainRoute.test.ts tests/integration/indicators/e2eChat.test.ts
```

---

## B.4 Pruebas Funcionales

### B.4.1 Estrategia de Testing

El equipo aplicó **Test-Driven Development (TDD)** con tres niveles de pruebas:

```
       ┌─────────────────────┐
       │   E2E (Hansel)      │  ← e2eChat.test.ts
       │   1 archivo         │
       ├─────────────────────┤
       │   Integración       │  ← Supertest sobre Express
       │   8 archivos        │
       ├─────────────────────┤
       │   Unitarios         │  ← Funciones puras
       │   8 archivos        │
       └─────────────────────┘
```

**Stack de testing:**
- **Vitest 4** (runner + cobertura)
- **Supertest 7** (HTTP integración)
- **Mocks deterministas** (`DeterministicMockExplainer`, `ohlcSource` mock)

### B.4.2 Casos de Prueba Principales

**Casos por indicador (resumen):**

| Caso | Resultado esperado | Owner |
|---|---|---|
| RSI con velas planas | `current_value = 50`, `zone = neutral`. | Kevin |
| RSI con subida pronunciada | `current_value > 70`, `zone = sobrecomprado`. | Kevin |
| MACD con cruce alcista | `cross = "bullish"`. | Kevin |
| EMA con `period=20` | Serie alineada con timestamps, `current_value` numérico. | Edgar |
| ADX con `< 2*period` velas | Error `422 INSUFFICIENT_BARS`. | Edgar |
| Bollinger en mercado lateral | `bandwidth` decrece, `%B ∈ [0,1]`. | Edgar |
| Confluencia con 5 indicadores | `verdict` ∈ {alcista, neutral, bajista}. | Mauricio |
| Confluencia con 2 indicadores | `verdict = "neutral"`, `degraded:true`. | Mauricio |
| Health con OHLC OK | Reporta cada indicador sin excepciones. | Mauricio |
| Chat con pregunta de ejecución | `refused:true`, `200`, disclaimer presente. | Hansel |
| Chat en inglés | Responde en español, cita ≥ 3 indicadores. | Hansel |
| e2e completo | OHLC → indicadores → confluencia → chat, todo verde. | Hansel |

### B.4.3 Casos de Error (Negative Testing)

| Caso | Endpoint | Respuesta esperada |
|---|---|---|
| `symbol` faltante | `GET /api/indicators/rsi` | `400 INVALID_PARAMS` |
| `symbol` inexistente | `GET /api/indicators/rsi?symbol=XYZ` | `404 NOT_FOUND` |
| `count` demasiado bajo para ADX | `GET /api/indicators/adx?symbol=AAPL&count=5` | `422 INSUFFICIENT_BARS` |
| Confluencia con todos los indicadores fallando | `GET /api/indicators/confluence` | `200` con `verdict=neutral`, `degraded:true` |
| Chat sin `question` | `POST /api/chat/explain` | `400 INVALID_PARAMS` |

### B.4.4 Validación Funcional Final

**Resultado de la corrida completa:**

```
$ npm run -w @inversions/rest-api test

✓ tests/unit/indicators/         (8 archivos) — 60+ tests
✓ tests/integration/indicators/  (9 archivos) — 56+ tests
✓ resto de suite                  (14 archivos) — 61 tests

Total: 31 archivos · 177 tests · ✅ PASS
Cobertura módulo indicators: 94.75% statements / 97.02% lines
```

### B.4.5 Validación Manual (smoke tests)

```bash
# 1. Levantar API
npm run -w @inversions/rest-api dev

# 2. Health
curl http://localhost:3000/api/indicators/health

# 3. Cada indicador
curl "http://localhost:3000/api/indicators/rsi?symbol=AAPL&timeframe=1h"
curl "http://localhost:3000/api/indicators/macd?symbol=AAPL&timeframe=1h"
curl "http://localhost:3000/api/indicators/ema?symbol=AAPL&timeframe=1h"
curl "http://localhost:3000/api/indicators/adx?symbol=AAPL&timeframe=1h"
curl "http://localhost:3000/api/indicators/bollinger?symbol=AAPL&timeframe=1h"

# 4. Confluencia
curl "http://localhost:3000/api/indicators/confluence?symbol=AAPL&timeframe=1h"

# 5. Chat IA
curl -X POST http://localhost:3000/api/chat/explain \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","timeframe":"1h","question":"por que la señal esta asi?"}'
```

### B.4.6 Tareas Pendientes (Clarifications, no bloquean entrega)

| ID | Tema | Estado |
|---|---|---|
| T070 | Proveedor y modelo LLM concreto para Chat IA. | ⏳ Coordinación |
| T071 | Fuente real de OHLC (acuerdo con TEAM-01). | ⏳ Coordinación |
| T072 | Política de caché (TTL) y rate limit por usuario. | ⏳ Coordinación |

---

## B.5 Enlaces de Videos (Placeholder)

> Los videos serán grabados por el equipo. Coloque aquí los enlaces públicos
> (YouTube, Vimeo o Drive con permiso público) una vez producidos.

### B.5.1 Video Maestro — Presentación Integradora

- **Título:** *Presentación Final — InversionesPWA-NOSQL Core de Indicadores + Chat IA*
- **Duración estimada:** 15-20 min
- **Enlace público:** `[ PEGAR AQUÍ EL LINK DEL VIDEO MAESTRO ]`
- **Contenido:** Introducción + Análisis y Diseño + Metodología + Demo integral + Cierre.

### B.5.2 Videos por Integrante (Codificación)

| # | Integrante | Tema | Duración | Enlace |
|---|---|---|---|---|
| 1 | **Hansel** | Chat IA + e2e + Calidad (T050–T062) | 4-5 min | `[ LINK HANSEL ]` |
| 2 | **Kevin** | Momentum: RSI + MACD (T010–T020) | 3-4 min | `[ LINK KEVIN ]` |
| 3 | **Edgar** | Tendencia/Volatilidad: EMA + ADX + Bollinger (T030–T033) | 3-4 min | `[ LINK EDGAR ]` |
| 4 | **Mauricio** | Confluencia + Health + Trazabilidad (T040–T046) | 3-4 min | `[ LINK MAURICIO ]` |

### B.5.3 Video de Pruebas Funcionales

- **Título:** *Pruebas Funcionales y Validación — 177 tests en verde*
- **Duración estimada:** 5-7 min
- **Enlace público:** `[ PEGAR AQUÍ EL LINK DEL VIDEO DE PRUEBAS ]`
- **Contenido:** Ejecución en vivo de los 3 gates, demo de cobertura, casos de
  error y smoke tests con `curl`.

### B.5.4 Video de Manual de Usuario (opcional)

- **Título:** *Manual de Usuario — Cómo usar la PWA InversionesPWA-NOSQL*
- **Duración estimada:** 5-7 min
- **Enlace público:** `[ PEGAR AQUÍ EL LINK DEL VIDEO DE MANUAL ]`

---

## Anexos

### Anexo A — Comandos de Validación Rápida

```bash
# Validación completa (3 gates)
npm run -w @inversions/rest-api lint
npm run -w @inversions/rest-api test
npm run lint:fic

# Validación por integrante
# Kevin (RSI + MACD)
npm run -w @inversions/rest-api test -- tests/unit/indicators/rsi.test.ts tests/unit/indicators/macd.test.ts tests/integration/indicators/rsiRoute.test.ts tests/integration/indicators/macdRoute.test.ts

# Edgar (EMA + ADX + Bollinger)
npm run -w @inversions/rest-api test -- tests/unit/indicators/ema.test.ts tests/unit/indicators/adx.test.ts tests/unit/indicators/bollinger.test.ts tests/integration/indicators/emaRoute.test.ts tests/integration/indicators/adxRoute.test.ts tests/integration/indicators/bollingerRoute.test.ts

# Mauricio (Confluencia + Health)
npm run -w @inversions/rest-api test -- tests/unit/indicators/confluence.test.ts tests/integration/indicators/confluenceRoute.test.ts tests/integration/indicators/healthRoute.test.ts

# Hansel (Chat IA + e2e)
npm run -w @inversions/rest-api test -- tests/unit/indicators/chatExplainer.test.ts tests/integration/indicators/chatExplainRoute.test.ts tests/integration/indicators/e2eChat.test.ts

# Cobertura del core
npm run -w @inversions/rest-api test -- tests/unit/indicators tests/integration/indicators --coverage
```

### Anexo B — Referencias

- Repositorio del feature: https://github.com/BetoCW/InversionsPWA-NOSQL-COREINDICADORES
- Spec del feature: `specs/003-team-02-core-indicadores/spec.md`
- Plan técnico: `specs/003-team-02-core-indicadores/plan.md`
- Desglose de tareas: `specs/003-team-02-core-indicadores/tasks.md`
- Contratos OpenAPI: `specs/003-team-02-core-indicadores/contracts/*.openapi.yaml`
- README del feature TEAM-02: `README.md` (raíz del repo)

### Anexo C — Glosario

| Término | Definición |
|---|---|
| **PWA** | Progressive Web App — aplicación web instalable con capacidades offline. |
| **OHLC** | Open, High, Low, Close — formato estándar de velas de mercado. |
| **RSI** | Relative Strength Index — indicador de momentum (0-100). |
| **MACD** | Moving Average Convergence Divergence. |
| **EMA** | Exponential Moving Average. |
| **ADX** | Average Directional Index — fuerza de tendencia (no dirección). |
| **Bollinger** | Bandas de volatilidad alrededor de una media móvil. |
| **Confluencia** | Veredicto consolidado a partir de múltiples indicadores. |
| **SAP CDS** | Core Data Services — lenguaje declarativo de modelado de datos de SAP. |
| **Spec-Driven Development** | Metodología en la que toda feature parte de una `spec.md`. |
| **FIC** | Convención de comentarios del proyecto (dos líneas inglés/español). |
| **Idempotencia** | Misma entrada → misma salida (verificada por `source_input_hash`). |

---

**Fin del documento — T5-Actividad 3**
*Equipo TEAM-02 CocaDe6Lts · InversionesPWA-NOSQL · 2026-05-24*
