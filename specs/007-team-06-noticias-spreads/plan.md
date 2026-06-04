# Plan de Implementación: Análisis de Noticias y Estrategias de Spreads (TEAM-06)

**Branch**: `007-team-06-noticias-spreads` | **Fecha**: 2026-05-22 | **Spec**: [spec.md](spec.md)  
**Entrada**: Especificación de características en [spec.md](spec.md)  

---

## Resumen

Este plan técnico detalla el diseño, la arquitectura y la estrategia para implementar el core de **Análisis de Noticias y Modelado/Simulación de Estrategias de Spreads** para TEAM-06 (CodersTMNT). El alcance técnico cubre la ingesta normalizada de 6 fuentes de noticias financieras clave, un clasificador de sentimiento e impacto asíncrono con control de flujo (rate-limiting), la formulación matemática estricta y simulación de curvas de payoff para Debit Spreads (Bull Call / Bear Put) y Credit Spreads (Bull Put / Bear Call), y un Chat IA de consulta explicativo y de solo lectura que respeta rigurosamente el modelo semi-automático constitucional.

---

## Contexto Técnico

- **Language/Version**: TypeScript 5.x en frontend y backend; Node.js 22 LTS en REST API.
- **Primary Dependencies**: React 18, Vite, Express, Supabase JS Client, Cheerio/rss-parser (para SEC EDGAR), OpenAI/Anthropic SDKs (para clasificación de impacto y Chat IA), TailwindCSS (no utilizado por defecto, se utiliza Vanilla CSS conforme al stack base).
- **Storage**: Supabase (PostgreSQL) para tablas de datos (`noticia_financiera`, `estrategia_spread`, `simulacion_resultado`, `news_source_configurations`) con soporte para RLS y optimistic locking.
- **Testing**: Vitest para el frontend React, Jest/ts-jest para el backend Express.
- **Target Platform**: PWA Web Client + Node.js REST API.
- **Project Type**: Aplicación Web por Features.
- **Performance Goals**:
  - Clasificación de impacto de noticias en menos de 500 ms tras el guardado local.
  - Retorno de payoff de simulación de spreads en menos de 300 ms.
  - Respuestas explicativas del Chat IA en menos de 3 segundos.
- **Constraints**: 
  - IA exclusivamente consultiva y de solo lectura (sin auto-trading, sin bypass de decisiones humanas).
  - Control de concurrencia mediante `version` en actualizaciones de spreads.
  - Comentarios FIC: bilingües en inglés/español obligatorio en todo código nuevo.

---

## Constitución Check

*GATE: Debe pasar antes de Phase 0 y revalidarse tras Phase 1.*

### Check Inicial (Fase 0)
- **Idioma oficial en español**: **PASS** (Toda la documentación técnica y planes generados se redactan en español).
- **Modelo semi-automático y control humano**: **PASS** (La IA opera en modo consultivo de solo lectura; se rechaza explícitamente cualquier orden automática de trading).
- **Separación frontend/backend**: **PASS** (Estructura modular dividida entre `projects/pwa/inversions_app` y `projects/rest-api/inversions_api`).
- **Seguridad y RLS**: **PASS** (RLS implementado en todas las tablas operacionales en Supabase basándose en JWT claims de usuario autenticado).

### Re-check Post-Phase 1 (Diseño y Contratos)
- **Cálculo matemático exacto separado de IA**: **PASS** (Las fórmulas de Debit/Credit spreads y simulación de payoff se ejecutan determinísticamente en código TypeScript, la IA solo lee los resultados para explicar).
- **Control de concurrencia**: **PASS** (La tabla `estrategia_spread` cuenta con la columna `version` y control transaccional contra condiciones de carrera).
- **Evitación de duplicados en noticias**: **PASS** (Restricción `uq_noticia_frescura` agregada para mitigar duplicación a corto plazo).

---

## UX Architecture & Control Strategy

- **Target Experience**: Panel de trading profesional integrado. Las marcas de noticias financieras con códigos de colores (verde = positivo, rojo = negativo, gris = neutro) se grafican en la escala de tiempo técnica. A la derecha, un simulador dinámico muestra la tabla y gráfico de payoff en tiempo real junto al panel deslizante del Chat IA.
- **Critical Controls**:
  - **Filtro de Noticias**: Multiselector para filtrar por sentimiento, fuente o relevancia en el gráfico y feed de noticias.
  - **Selector de Spread**: Menú desplegable para alternar entre "Debit Spread" y "Credit Spread" que recarga dinámicamente los strikes de la cadena de opciones.
  - **Strikes Inputs**: Deslizadores inteligentes acoplados que restringen los valores numéricos para respetar el sentido económico de la estrategia elegida (ej. $K_L < K_C$ en Bull Call).
  - **Input Chat IA**: Caja de diálogo interactiva con formato enriquecido (Markdown) y enlaces directos a las fuentes de datos.
- **State Strategy**:
  - *Estado del Cliente*: Estado local de React para los inputs del simulador en curso y variables visuales del chat.
  - *Estado del Servidor*: Supabase almacena las estrategias consolidadas por el usuario, las simulaciones persistidas y el historial de noticias normalizadas.
- **Performance Boundaries**: Virtualización del feed de noticias en el panel lateral para soportar cargas masivas de feeds macroeconómicos, y debouncing de 150 ms al arrastrar sliders de strikes.

---

## Data Source Routing & Runtime Modes

### Matriz de Enrutamiento de Datos
- **Noticias Financieras**: Polygon (Prioridad 1) -> Finnhub (Prioridad 2 / Fallback) -> SEC EDGAR / CFTC (Fuentes Especializadas).
- **Cadena de Opciones**: API del Broker conectado (IBKR/Alpaca) -> Fallback local de cadena simulada o caché Supabase.
- **Payoff de Spreads**: Motor de cálculo matemático local (Backend API) -> Fallback local (Caché DB).

### Modos de Ejecución (Runtime Modes)
- **Mode Online**: Ingesta viva de noticias de APIs externas en colas de procesamiento de sentimiento y consultas en tiempo real al feed de precios.
- **Mode Offline**: Lectura restringida a base de datos Supabase local o caché sin llamadas salientes a APIs externas.
- **Mode Demo**: Datos históricos de sandbox y primas de opciones teóricas sin conexión a un broker productivo.
- **Mode Real**: Simulación basada en activos reales con cotizaciones vivas que requiere autorización explícita para la confirmación de señales operativas en dashboard.

---

## Dynamic Schema Governance

- **Registry Model**: Configurado dinámicamente en la tabla `news_source_configurations` de Supabase para activar o desactivar fuentes de noticias externas en caliente.
- **Runtime Adaptation**: El enrutador de noticias lee periódicamente el estado activo de la base de datos. Si una API externa falla críticamente, cambia su estado a inactivo y redirige la ingesta al fallback parametrizado de forma transparente al usuario.
- **Preset Strategy**: Los usuarios pueden guardar sus vistas personalizadas de la tabla de confluencia de spreads (columnas visualizadas, umbrales de stop-loss por defecto).
- **Validation Rules**:
  - Verde: Impacto positivo ($> 0.30$)
  - Amarillo/Gris: Impacto neutro ($-0.30$ a $0.30$)
  - Rojo: Impacto negativo ($< -0.30$)

---

## Estructura del Proyecto

### Documentación (TEAM-06 Feature)
```text
specs/007-team-06-noticias-spreads/
├── plan.md              # Este archivo técnico de implementación
├── research.md          # Investigación (Fallas, Limitación de Flujo y Matemáticas)
├── data-model.md        # Definición de tablas de Supabase, Triggers y Políticas RLS
├── quickstart.md        # Guía de levantamiento, scripts dev y bootstrap
└── contracts/           # Contratos estables de la API REST
    ├── news-contract.md
    └── spread-strategy-contract.md
```

### Código Fuente Relacionado (Estructura Monorepo)
```text
projects/
├── rest-api/inversions_api/
│   ├── src/
│   │   ├── controllers/         # newsController.ts, spreadController.ts
│   │   ├── database/migrations/ # Migraciones PostgreSQL de Supabase
│   │   ├── models/              # NoticiaFinanciera.ts, EstrategiaSpread.ts
│   │   ├── services/            # newsIngestionService.ts, spreadSimulationService.ts, aiExplanationService.ts
│   │   ├── routes/              # newsRoutes.ts, spreadRoutes.ts
│   │   └── types/               # ts-types del feature
│   └── tests/                   # Pruebas del backend
│
└── pwa/inversions_app/
    ├── src/
    │   ├── features/
    │   │   ├── news/            # Feed de noticias, marcas de velas
    │   │   └── spreads/         # Simulador de spreads y payoff charts
    │   ├── services/            # newsApi.ts, spreadsApi.ts, aiChatApi.ts
    │   ├── types/               # Modelos locales del cliente
    │   └── components/          # Componentes visuales interactivos
```

---

## Matriz de Trazabilidad FR/SC

### Matriz de Trazabilidad Completa (Requisitos Funcionales a Criterios de Éxito y Tareas)

| Requisito Funcional | Criterio de Éxito | Historia | Fase de Trabajo | Tareas Técnicas Asociadas |
| :--- | :--- | :--- | :--- | :--- |
| **FR-001**: Ingesta y deduplicación de múltiples fuentes | **SC-001** (procesamiento rápido) | US1 | Phase T06-1: Ingesta | Ingestores de Polygon, Finnhub, SEC EDGAR y CFTC; normalizadores de formato; clave única `uq_noticia_frescura` |
| **FR-002**: Clasificador de sentimiento e impacto | **SC-001** (procesamiento rápido) | US1 | Phase T06-2: Sentimiento | Lógica de clasificación asíncrona; control de flujo/rate-limits por TPM LLM |
| **FR-003**: Formulación matemática de Spreads | **SC-002** (cálculo rápido) | US2 | Phase T06-3: Spreads | Implementación determinística de fórmulas de Debit/Credit Spreads; trigger automático en Supabase |
| **FR-004**: Simulador de Payoff en tiempo real | **SC-002** (cálculo rápido) | US2 | Phase T06-3: Spreads | Motor de cálculo de payoff y curvas de probabilidad; endpoint `/api/v1/spreads/:id` |
| **FR-005**: Relación entre noticias y spreads | **SC-002**, **SC-003** | US2, US3 | Phase T06-3: Spreads | Orquestador de confluencia de datos; alertas de riesgo de asignación temprana |
| **FR-006**: Chat IA de consulta explicativo | **SC-003** (respuestas rápidos) | US3 | Phase T06-3: Spreads | RAG pipeline de solo lectura sobre Supabase; System prompt con bloqueo estricto de auto-trading |
| **FR-007**: Pruebas automatizadas y unitarias | **SC-004** (cobertura >= 80%) | US1-US3 | Phase T06-4: Validación | Unit tests para matemáticas de spreads, integradores de APIs y clasificadores de sentimiento |

---

## Plan de Trabajo y Fases

### Fase T06-1: Ingesta y Base de Datos (Backend y Supabase)
1. Ejecutar las migraciones de base de datos detalladas en `data-model.md` para las tablas `noticia_financiera`, `estrategia_spread`, `simulacion_resultado` y `news_source_configurations`.
2. Habilitar las políticas RLS y triggers de auto-cálculo de costos netos en Supabase.
3. Escribir los adaptadores de ingesta en `inversions_api/src/services/` para Polygon, Finnhub, NewsAPI, Alpha Vantage y SEC EDGAR.

### Fase T06-2: Análisis de Impacto y Sentimiento
1. Diseñar el pipeline asíncrono que consume noticias entrantes y las encola.
2. Integrar el cliente de IA para analizar el sentimiento y score de impacto cuantitativo en menos de 500 ms por registro.
3. Incorporar el rate-limiter para proteger los TPM/RPM de los tokens de las LLM.

### Fase T06-3: Motor Matemático de Spreads y Chat IA
1. Desarrollar el servicio en TypeScript que calcula el payoff, ganancias y pérdidas máximas y puntos de break-even según la formulación analítica exacta de `research.md`.
2. Implementar los endpoints estipulados en `spread-strategy-contract.md` y `news-contract.md`.
3. Levantar el pipeline RAG del Chat IA en el backend con las restricciones de gobernanza (modo solo lectura, denegación estricta de trading).

### Fase T06-4: Interfaz de Usuario y Workspace (Frontend)
1. Integrar en la PWA los componentes del feed de noticias financieras y los marcadores de colores sobre las velas técnicas.
2. Desarrollar el panel de simulación de spreads con inputs de strikes restringidos lógicamente y renderizado de la curva de pérdidas/ganancias utilizando gráficos de payoff de alto rendimiento.
3. Integrar la barra deslizante lateral del Chat IA en español conectada al API de solo lectura.

### Fase T06-5: Pruebas y Validación de Cierre
1. Escribir pruebas unitarias exhaustivas en el backend con Vitest/Jest asegurando cobertura de cálculo matemático e ingesta $\ge 80\%$.
2. Validar que la compilación del workspace pase limpia ejecutando `npm run build` y `npm run lint`.
3. Validar visualmente y mediante logs que no exista drift entre los requerimientos canónicos y la especificación técnica.

---

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
| :--- | :--- |
| **Picos masivos de noticias en Earnings Season exceden límites de API** | Cola asíncrona dedicada y rate-limiting por ventana temporal de tokens. Las noticias se guardan en crudo con sentimiento neutro pendiente mientras se procesan en segundo plano. |
| **IA emite recomendaciones de trading directas o intenta operar autónomamente** | Bloqueo absoluto a nivel de System Prompt del backend, RLS de Supabase restringido, y ausencia física de endpoints de ejecución en las rutas asignadas al Chat IA. |
| **Condiciones de carrera durante modificaciones de simulaciones concurrentes** | Concurrencia optimista forzada por verificación del campo `version` en todas las sentencias SQL UPDATE en Supabase. |
| **Cálculo incorrecto o división por cero ante primas nulas (mercado cerrado)** | Bloqueo lógico y fallback al último precio disponible registrado con advertencia informativa visible en pantalla. |
