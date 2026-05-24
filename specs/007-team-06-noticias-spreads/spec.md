# Feature Specification: Análisis de Noticias y Estrategias de Spreads

**Feature Branch**: `007-team-06-noticias-spreads`  
**Created**: 2026-05-22  
**Status**: Draft  
**Input**: User description: "/diana.integrate action=\"run\" engine=\"speckit\" project=\"diana-inversions\" initiative=\"001-inversions\" team=\"TEAM-06\" run_only=\"specify\" language=\"es\""

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ingesta y Clasificación de Noticias (Priority: P1)

Como operador de la plataforma, quiero que el sistema ingeste noticias de múltiples fuentes financieras y clasifique su impacto y sentimiento de forma automática para poder visualizar eventos que afecten mis activos bajo un sesgo de mercado claro.

**Why this priority**: Es la base funcional de toda la lógica de noticias. Sin la ingesta normalizada y la clasificación de impacto, no se puede correlacionar eventos con el comportamiento técnico de los instrumentos.

**Independent Test**: Se puede verificar mediante un test de integración enviando un feed simulado de noticias externas (por ejemplo, de Finnhub o SEC EDGAR) y comprobando que el motor de impacto genera y persiste en base de datos registros con sentimiento (positivo/negativo/neutro), score de impacto y confianza calculada.

**Acceptance Scenarios**:

1. **Given** que el sistema está conectado a las fuentes externas y recibe una noticia urgente sobre earnings de Apple, **When** el motor de impacto la procesa, **Then** se guarda en base de datos con una etiqueta de sentimiento (positivo/negativo/neutro), un score cuantitativo de impacto entre -1 y +1, y un nivel de confianza.
2. **Given** una noticia duplicada de la misma fuente dentro de una ventana de 1 hora, **When** el servicio de datos la recibe, **Then** el sistema la deduplica conservando la de mayor frescura y descarta la duplicidad sin generar registros redundantes.

---

### User Story 2 - Modelado y Simulación de Estrategias Spread (Priority: P1)

Como inversionista, quiero diseñar y simular estrategias de spreads (Debit Spread y Credit Spread) evaluando costos, ingresos por primas, retorno máximo, riesgo limitado y puntos de break-even según escenarios de fluctuación del subyacente.

**Why this priority**: Permite al usuario formular hipótesis operativas detalladas basadas en opciones sin arriesgar capital real de forma automatizada, cumpliendo el principio de control humano de la iniciativa.

**Independent Test**: Se puede validar ejecutando un set de cálculos matemáticos para una opción teórica en Debit/Credit Spread y verificando que el motor de simulación calcula correctamente el break-even, retorno máximo y pérdida máxima teórica con precisión matemática centesimal.

**Acceptance Scenarios**:

1. **Given** un subyacente a $150, strikes seleccionados de $145 y $155, primas registradas y una tolerancia de riesgo del 5%, **When** se simula un Protective Debit Spread, **Then** el sistema calcula el costo neto, los puntos de break-even exactos, la ganancia/pérdida máxima esperada y el retorno proyectado en caso de subida o bajada.
2. **Given** Strikes que no cumplen con la estructura lógica (por ejemplo, strike de compra mayor al de venta en un bull spread sin consistencia), **When** se intenta registrar la estrategia, **Then** el sistema arroja una alerta de validación rechazando la configuración.

---

### User Story 3 - Asistente Chat IA Explicativo (Priority: P2)

Como operador, quiero interactuar con un Chat IA que acceda a las noticias procesadas y simulaciones de spreads activas para recibir explicaciones del contexto de mercado, riesgos operativos y sugerencias analíticas fundamentadas en datos reales.

**Why this priority**: Agrega la capa explicativa constitucional indispensable para que el usuario tome decisiones informadas y auditables, evitando la sobreinterpretación o decisiones de caja negra.

**Independent Test**: Se puede verificar enviando una pregunta al chat sobre el impacto de la última noticia de earnings en una estrategia activa de spread y validando que la respuesta incluye referencias directas (IDs de noticias y métricas del spread) recuperadas de base de datos de solo lectura.

**Acceptance Scenarios**:

1. **Given** un conjunto de noticias de earnings procesadas recientemente en Supabase y una simulación activa de spreads para Tesla, **When** el usuario pregunta "¿Cómo afecta la última noticia regulatoria a mi Credit Spread de TSLA?", **Then** el Chat IA responde con lenguaje técnico claro en español, recuperando la noticia específica y describiendo el riesgo teórico sin emitir órdenes de compra/venta autónomas.
2. **Given** que el usuario le pide a la IA que ejecute una orden de trading directamente, **When** se procesa el prompt, **Then** el Chat IA se niega explícitamente y recuerda al usuario que la plataforma opera bajo un modelo semi-automático estricto donde la IA no tiene autorización para operar.

---

### Edge Cases

- **Ausencia total de primas de opciones (mercado cerrado o ilíquido)**: Si no se consiguen datos de primas de mercado vigentes al evaluar spreads, el sistema debe congelar la simulación arrojando una alerta indicando "Simulación en base a última cotización disponible (fuera de mercado)" en lugar de fallar o dividir por cero.
- **Sobrecarga de feeds regulatorios (earnings season o eventos macro)**: Si hay un pico masivo de noticias de SEC 13F o CFTC COT, el sistema debe encolar el procesamiento de sentimiento usando un rate-limiter interno para evitar sobrepasar los límites de tokens de los LLM evaluadores, usando una caché de base de datos para la visualización.
- **Ruptura de strikes y asignación temprana en Credit Spreads**: Si el precio del subyacente cruza los strikes definidos acercándose al vencimiento, el motor de riesgo debe emitir alertas push inmediatas recomendando acciones de cierre o roll-over, calculando el impacto de asignación temprana.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE ingestar, normalizar y deduplicar noticias de fuentes financieras clave incluyendo Finnhub, NewsAPI, Alpha Vantage, Polygon, SEC EDGAR y CFTC COT.
- **FR-002**: El sistema DEBE proveer un clasificador automático de impacto noticioso capaz de categorizar cada evento en positivo, negativo o neutro, asignando un score de impacto entre -1.0 y +1.0 y una métrica de confianza.
- **FR-003**: El sistema DEBE implementar la lógica analítica y matemática para Protective Debit Spreads (Bull Call / Bear Put) y Credit Spreads (Bull Put / Bear Call), calculando costo neto, retorno máximo, pérdida máxima, break-even y stop-loss dinámico.
- **FR-004**: El sistema DEBE incluir un motor de simulación de spreads que soporte backtesting histórico, escenarios determinísticos y proyección de payoff en tiempo real bajo variaciones del subyacente.
- **FR-005**: El sistema DEBE implementar un orquestador que relacione noticias en tiempo real con parámetros de spreads, permitiendo el ajuste de stop-loss o coberturas ante eventos inesperados de alto impacto.
- **FR-006**: El sistema DEBE ofrecer un Chat IA integrado con acceso de solo lectura a la base de datos Supabase conteniendo noticias normalizadas, clasificaciones de impacto y resultados de simulación, para responder consultas en lenguaje natural técnico en español.
- **FR-007**: Cada módulo implementado DEBE contar con pruebas unitarias y de integración que cubran las rutas críticas y el manejo de errores, garantizando una cobertura mínima del 80% en los componentes de clasificación e interpretación matemática.

### Key Entities *(include if feature involves data)*

- **NoticiaFinanciera**: Entidad que representa una noticia o reporte procesado.
  - Atributos: `id` (UUID), `titulo` (string), `contenido` (text), `ticker` (string), `fuente` (string), `url` (string), `timestamp_publicacion` (datetime), `sentimiento` (enum: positivo/negativo/neutro), `score_impacto` (decimal), `confianza` (decimal), `procesado_at` (datetime).
- **EstrategiaSpread**: Entidad base para el modelado de un spread de opciones.
  - Atributos: `id` (UUID), `tipo_spread` (enum: DEBIT_SPREAD, CREDIT_SPREAD), `subyacente` (string), `strike_largo` (decimal), `strike_corto` (decimal), `prima_larga` (decimal), `prima_corta` (decimal), `fecha_vencimiento` (datetime), `cantidad_contratos` (integer), `limite_stop_loss` (decimal), `costo_ingreso_neto` (decimal).
- **SimulacionResultado**: Entidad que registra los resultados del simulador de payoff.
  - Atributos: `id` (UUID), `estrategia_id` (UUID), `precio_subyacente_simulado` (decimal), `payoff_esperado` (decimal), `probabilidad_exito` (decimal), `creado_at` (datetime).

## Experience & Component Contract *(required for UI-heavy features)*

### Target UX

- **Reference Experience**: Panel de trading estilo TradingView donde las noticias relevantes se muestran como pequeños marcadores/anotaciones con código de colores (rojo/verde/gris) directamente sobre la escala de tiempo de las velas japonesas.
- **Primary User Workspace**: Vista dividida en tres secciones: a la izquierda, el gráfico técnico de precios con marcas de noticias y sentimiento; al centro-derecha superior, el simulador interactivo de spreads con tabla de payoffs y diagrama de pérdidas/ganancias; y en la barra lateral derecha, la interfaz del Chat IA para interactuar y consultar el impacto del contexto actual.

### Control-by-Field Contract

- **Filtro de Sentimiento de Noticias**: Control tipo multiselect en el panel superior para filtrar las noticias visualizadas en el gráfico (Mostrar solo positivo, Mostrar solo negativo, etc.).
- **Selector de Estrategia Spread**: Combobox interactivo para alternar entre "Protective Debit Spread" y "Credit Spread", gatillando la carga de strikes y primas disponibles en los inputs adyacentes.
- **Strike inputs**: Slider dinámico y spinner numérico que restringe el strike largo y strike corto de modo que se respeten los límites lógicos de la estrategia elegida (por ejemplo, strike_largo < strike_corto para Bull Call Spread).
- **Input Chat IA**: Cuadro de texto interactivo tipo Chat que permite enviar prompts a la IA del spread, renderizando respuestas enriquecidas con tablas de Markdown y enlaces interactivos a las noticias correspondientes.

### Runtime Modes & Source Selection

- **Mode Online**: Ingesta continua en vivo de feeds de noticias y cotizaciones de opciones mediante las APIs externas priorizadas. Almacenamiento rápido en Supabase y procesamiento asíncrono del sentimiento.
- **Mode Offline**: Lectura restringida únicamente a las tablas locales pre-guardadas en Supabase, indicando al usuario la fecha de la última actualización sin realizar llamadas externas.
- **Mode Demo**: Simulación con datos históricos en un sandbox aislado que no requiere llaves de producción ni broker real conectado, ideal para evaluación y aprendizaje del usuario.
- **Mode Real**: Simulación activa sobre activos reales y cotizaciones en vivo que requiere validación y aprobación humana de cada señal resultante antes de su marcado de readiness operativa.

## Dynamic Schema & Configurability *(if catalogs/tables evolve)*

- **Config Registry**: Tabla dinámica `news_source_configurations` que permite habilitar/deshabilitar fuentes (por ejemplo, apagar Polygon temporalmente y redireccionar a Finnhub como fallback) sin necesidad de redeployar código del backend.
- **Evolvability Rule**: Posibilidad de añadir nuevas fuentes de noticias externas o modificar los pesos analíticos en el orquestador de confluencia mediante configuraciones en la base de datos.
- **User Presets**: El panel de visualización recuerda los filtros de sentimiento del usuario, las estrategias de spreads más consultadas y las configuraciones de strikes preferidas.
- **Backward Compatibility**: Si el formato JSON de una fuente externa de noticias cambia, el pipeline de ingesta asigna valores por defecto a los campos no reconocidos y registra la alerta de compatibilidad asíncrona, manteniendo el flujo de noticias activo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El clasificador de impacto de noticias debe procesar y etiquetar cada noticia en menos de 500 ms una vez almacenada en la base de datos local.
- **SC-002**: El motor de simulación transversal debe retornar los cálculos del payoff esperados y los puntos de break-even de una estrategia Spread en menos de 300 ms tras recibir los strikes y vencimiento.
- **SC-003**: El Chat IA debe responder a las preguntas contextuales del usuario en menos de 3 segundos bajo condiciones normales de API, manteniendo un 100% de trazabilidad semántica mediante enlaces o IDs a las fuentes de datos.
- **SC-004**: Cobertura de pruebas unitarias y de integración de al menos 80% sobre toda la lógica de cálculo matemático de spreads y clasificación de impacto de noticias financieras.

## Assumptions

- **A-001**: Se asume que las credenciales de API (Finnhub, OpenAI/Anthropic, etc.) están configuradas correctamente en las variables de entorno del backend.
- **A-002**: Las cotizaciones de opciones y primas utilizadas para simular Debit/Credit Spreads son normalizadas por los cores de broker/market-data transversales y se asumen disponibles en formato uniforme.
- **A-003**: La lógica de negocio está totalmente separada del broker y la interfaz de usuario, operando a través de contratos de API estables para garantizar modularidad y mantenibilidad técnica.
- **A-004**: Las respuestas del Chat IA operan bajo un esquema consultivo y de solo lectura; la IA nunca puede iniciar ni ejecutar operaciones financieras directas de manera autónoma.
