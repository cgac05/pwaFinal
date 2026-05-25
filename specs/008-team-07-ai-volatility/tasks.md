# Tasks - TEAM-07 AI Volatility Analysis
**Equipo:** SixPackDevs  
**Rama:** feature/008-team-07-ai-volatility  
**Total Tasks:** 7

---

# GRUPO 1: CORE AI & GEMINI INTEGRATION (Semanas 1-3)

## T151: Setup Gemini SDK y orquestación de agentes

**Story Points**: 8  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: Ninguno  
**Semana**: W1  

### Descripción
Configurar el SDK de Gemini y la infraestructura de orquestación de agentes para soportar salida dual: JSON estructurado y análisis/opinión textual. Incluye prompt base, retries, fallback y definición del contrato de mensajes entre agentes.

### Acceptance Criteria
 - [X] Gemini SDK instalado y configurado en `projects/rest-api/inversions_api`
 - [X] System prompts definidos para el flujo de agentes
 - [X] Salida dual de Gemini (JSON estructurado + texto) establecida
 - [X] Retries y fallback básico implementados
 - [X] Interfaz TypeScript de mensajes de agente creada
 - [X] Tests unitarios para la inicialización del servicio Gemini

### Tareas Técnicas
1. Instalar Gemini SDK y dependencias necesarias
2. Definir el prompt base y el formato de salida dual en `geminiAgentService.ts`
3. Implementar agent factory/orchestration para Analyzer, Strategist y Executor
4. Añadir handling de error de API con retry/backoff
5. Crear types para `IAgentMessage`, `IGeminiResponse` y `IAgentOutput`
6. Escribir pruebas unitarias para la inicialización del servicio

### Criterios de Definición de Listo
- Código tipado en TypeScript sin `any`
- Tests unitarios pasando
- No warnings de linting
- PR aprobada por un revisor backend

---

## T152: Implementar pipeline Analyzer → Strategist → Executor

**Story Points**: 13  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: [T151]  
**Semana**: W2  

### Descripción
Construir la cadena de agentes que reciba inputs de mercado y estrategias, seleccione la mejor acción y prepare órdenes. El pipeline debe ser auditable y compatible con la aprobación humana antes de ejecución real.

### Acceptance Criteria
 - [X] Analyzer genera un resumen técnico desde datos de entrada
 - [X] Strategist selecciona una estrategia óptima (Straddle/Strangle) y calcula parámetros clave
 - [X] Executor prepara órdenes y valida condiciones pre-trade
 - [X] Cada paso genera metadatos para auditoría
 - [X] El flujo puede detenerse con un gate de aprobación humana antes de ejecutar órdenes reales
 - [X] Tests de integración del flujo de agentes disponibles

### Tareas Técnicas
1. Implementar `AnalyzerAgent` que procesa datos de mercado y genera contexto técnico
2. Implementar `StrategistAgent` que evalúa estrategias y selecciona la mejor opción
3. Implementar `ExecutorAgent` que prepara órdenes y aplica validación pre-trade
4. Crear el flujo secuencial de agentes con paso de mensajes y estados
5. Añadir registro de eventos para auditoría en cada etapa
6. Definir el gate de aprobación humana para producción
7. Escribir tests de integración del pipeline

### Criterios de Definición de Listo
- Pipeline funcional con pruebas de extremo a extremo
- Gate humano comprobado en flujo de orden
- No warnings de linting
- PR aprobada por un revisor backend

---

## T153: Integración de brokers y ejecución de órdenes

**Story Points**: 13  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: [T152]  
**Semana**: W2-W3  

### Descripción
Implementar adaptadores de brokers IBKR y Alpaca, con fallback automático, y conectar el Executor al flujo de ordenes. Incluir confirmación de ejecución y manejo de rechazos.

### Acceptance Criteria
 - [X] Adaptadores IBKR y Alpaca implementados
 - [X] El executor puede enviar órdenes a brokers y recibir confirmación
 - [X] Fallback automático entre brokers funciona
 - [X] Order state machine soporta estados `pending`, `submitted`, `filled`, `canceled`
 - [X] Rechazos de orden son manejados y auditados
 - [X] Tests de broker integration con simulación de fallos disponibles

### Tareas Técnicas
1. Definir interfaz `IBrokerAdapter`
2. Implementar `IBKRAdapter` y `AlpacaAdapter`
3. Integrar health checks y fallback routing
4. Conectar `ExecutorAgent` a los adaptadores
5. Implementar máquina de estados de órdenes y persistencia básica
6. Añadir logging y métricas de ejecución
7. Escribir pruebas de integración con mocks de broker

### Criterios de Definición de Listo
- Brokers integrados y verificados en tests
- Fallback probado en escenario de error
- No warnings de linting
- PR aprobada

---

## T154: Historial auditable y dashboard API

**Story Points**: 8  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: [T153]  
**Semana**: W3-W4  

### Descripción
Diseñar y exponer el historial auditable de operaciones junto con endpoints API para alimentar un dashboard visual. Incluye trade logs, métricas de performance y estados de órdenes.

### Acceptance Criteria
 - [X] Trade history y audit log persistidos correctamente
 - [X] Endpoints para `GET /trades`, `GET /trades/metrics` y `GET /audit` implementados
 - [X] Consultas de métricas responden en <1s para datasets razonables
 - [X] Dashboard API soporta filtros por fecha, estrategia y símbolo
 - [X] El flujo de auditoría conserva agente, decisión y estado de orden
 - [X] Tests de API e integración disponibles

### Tareas Técnicas
1. Crear esquema de datos para trades, executions y audit logs
2. Implementar repositorio/persistencia en Supabase o DB seleccionada
3. Crear endpoints de dashboard y métricas
4. Implementar filtros y paginación para consultas de historial
5. Documentar contrato API para el dashboard visual
6. Escribir tests de endpoints y de integridad de audit logs

### Criterios de Definición de Listo
- API funcional con pruebas de integración
- Historial auditable persistido
- No warnings de linting
- PR aprobada

---

## T155: Servicio de prompt CSV y retorno de salida Gemini

**Story Points**: 5  
**Prioridad**: P0  
**Asignado a**: Backend  
**Dependencias**: [T151]  
**Semana**: W1-W2  

### Descripción
Implementar el servicio y endpoint que reciben la tabla CSV como string, construyen el prompt exacto de Gemini y retornan el mensaje final en el formato Markdown especificado.

### Acceptance Criteria
 - [X] El servicio recibe la tabla en formato string y la inserta en el prompt requerido
 - [X] El prompt exacto incluye la instrucción de columnas y el bloque `--- INICIO DE TABLA ---`
 - [X] La respuesta de Gemini retorna como string y puede mapearse a la interfaz `IGeminiStrategyAssessmentResponse`
 - [X] La salida esperada coincide con el ejemplo de formato Markdown solicitado
 - [X] Tests unitarios de concatenación del prompt y respuesta retornada incluidos
 - [ ] Endpoint integrado y documentado

### Tareas Técnicas
1. Definir la interfaz de entrada para el CSV string
2. Implementar la plantilla de prompt exacta en `geminiAgentService.ts`
3. Crear la interfaz `IGeminiStrategyAssessmentResponse`
4. Implementar el endpoint que llama al servicio Gemini
5. Validar la salida y mapearla a la interfaz de salida
6. Escribir pruebas unitarias y de integración para el endpoint

### Criterios de Definición de Listo
- Servicio y endpoint funcionales
- Salida Markdown compatible con el formato requerido
- No warnings de linting
- PR aprobada

---

## T156: Dashboard visual y contrato de integración frontend

**Story Points**: 5  
**Prioridad**: P1  
**Asignado a**: Backend + Frontend  
**Dependencias**: [T154]  
**Semana**: W4-W5  

### Descripción
Definir y entregar los contratos API y los endpoints necesarios para soportar un dashboard visual de análisis de volatilidad y órdenes. Incluir el diseño de los datos que el frontend consumirá para mostrar indicadores, estados de órdenes y métricas.

### Acceptance Criteria
 - [X] Contratos API documentados para dashboard visual
 - [X] Endpoints listos para alimentar componentes de UI
 - [X] Datos de indicadores, órdenes y métricas disponibles en formato JSON
 - [X] Compatibilidad con gráficos y tablas del dashboard
 - [X] Pruebas de contrato y validación de payload

### Tareas Técnicas
1. Definir contratos JSON para dashboard
2. Implementar endpoints con payloads listos para la UI
3. Documentar ejemplos de respuesta para frontend
4. Validar consistencia de datos con el spec de dashboard
5. Escribir pruebas de contrato de API

### Criterios de Definición de Listo
- API contract validado
- Documentación disponible para frontend
- No warnings de linting
- PR aprobada

---

## T157: Implementar soporte para dashboards visuales

**Story Points**: 5  
**Prioridad**: P1  
**Asignado a**: Backend  
**Dependencias**: [T154, T156]  
**Semana**: W5  

### Descripción
Implementar el backend necesario para soportar dashboards visuales, asegurando que los datos, métricas y estados de órdenes estén disponibles para consumo frontend, sin incluir ningún gráfico ni componente de UI.

### Acceptance Criteria
 - [X] Endpoints de dashboard proporcionan datos de métricas, órdenes y estados de análisis
 - [X] Los datos están estructurados para consumo visual pero no implementan componentes gráficos
 - [X] Se documenta el contrato de datos para el frontend
 - [X] Pruebas de integración verifican la disponibilidad y validez de los payloads

### Tareas Técnicas
1. Implementar endpoints de dashboard que entreguen métricas y datos de órdenes
2. Asegurar el formato JSON y consistencia de los datos para consumo visual
3. Documentar la estructura de los payloads para el frontend
4. Escribir pruebas de integración que validen los endpoints

### Criterios de Definición de Listo
- Endpoints de dashboard funcionales
- Payloads documentados para consumo visual
- No warnings de linting
- PR aprobada

---

## T158: Refinamientos de Volatilidad y Simulador del Profesor (TAM07)

**Story Points**: 5  
**Prioridad**: P0  
**Asignado a**: Backend + Frontend  
**Dependencias**: [T155]  
**Semana**: W5  

### Descripción
Implementar los requerimientos y refinamientos finales para la evaluación académica. Incluye la dinamización de scores por ticker en el frontend, la integración del mini-chat de seguimiento con llamadas reales a Gemini en el backend y el desarrollo de un comportamiento de fallback híbrido inteligente que sirva como simulador cuando la API Key no esté presente.

### Acceptance Criteria
 - [X] Scores dinámicos por ticker (SPY, AAPL, TSLA, NVDA) en el frontend
 - [X] Mini-chat interactivo de seguimiento conectado directamente a `GeminiAgentService`
 - [X] Manejo inteligente de fallbacks: simulación realista si no hay API Key, y error 500 estricto si falla la llamada real
 - [X] Corrección de enrutamiento relativo `/analyze-scores` para evitar errores 404
 - [X] Integración limpia de dependencias npm `@google/genai` y `@anthropic-ai/sdk` en backend
 - [X] Proyecto compilando sin warnings de TS ni linter (`npm run lint` pasa en verde)

### Tareas Técnicas
1. Definir mapa de scores en frontend `VolatilityAnalysisPage.tsx` y actualizar `scores` al cambiar ticker
2. Remover fallback estático directo en backend y mapear contexto enriquecido a Gemini
3. Implementar lógica híbrida de fallback si `geminiService.isEnabled()` es falso en `volatilityAnalysis.ts`
4. Añadir tipado de variables de entorno de `gemini` en `environment.ts`
5. Ajustar URL en `volatilityAnalysisApi.ts` para resolver redirección de Vite proxy

### Criterios de Definición de Listo
- Ambos servidores inician y responden correctamente (`npm run dev:clean-start`)
- Linter en verde sin errores de tipado
- Prototipo con cobertura para pruebas locales sin API Key

---

## DEPENDENCIAS Y FLUJO

```
FASE 1 (W1):
  ├─ T151: Setup Gemini SDK y orquestación de agentes
  ├─ T155: Servicio de prompt CSV y retorno de salida Gemini
  └─ T152: Implementar pipeline Analyzer → Strategist → Executor

FASE 2 (W2-W3):
  ├─ T152: Implementar pipeline Analyzer → Strategist → Executor
  ├─ T153: Integración de brokers y ejecución de órdenes
  └─ T154: Historial auditable y dashboard API

FASE 3 (W4-W5):
  ├─ T154: Historial auditable y dashboard API
  ├─ T156: Dashboard visual y contrato de integración frontend
  ├─ T155: Servicio de prompt CSV y retorno de salida Gemini (ajustes)
  └─ T158: Refinamientos de Volatilidad y Simulador del Profesor (TAM07)
```

---

## NOTAS FINALES

- **Story Points**: 8, 13, 13, 8, 5, 5, 5
- **Prioridad**: P0 = blocker, P1 = soporte
- **DoD Universal**: TypeScript 100%, ESLint 0 warnings, PR reviewed, tests incluidos
- **Alcance**: mantener análisis de volatilidad completo, ejecutar órdenes en brokers integrados, persistir historial auditable, exponer dashboard API, usar Gemini para salida dual y aplicar gate humano antes de ejecuciones reales
