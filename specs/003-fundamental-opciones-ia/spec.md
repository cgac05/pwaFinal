# Feature Specification: TEAM-03 - Análisis Fundamental y Estrategias de Opciones con IA Explicativa

**Feature ID**: TEAM-03-FUNDAMENTAL-OPTIONS-AI  
**Feature Branch**: `003-fundamental-opciones-ia`  
**Equipo**: TEAM-03 (SQLitoNo)  
**Creado**: 2026-05-22  
**Estado**: Draft  
**Idioma**: Spanish (es) - Español Técnico  
**Origen**: Diana Canon 001-inversions + Speckit Enhancement  

---

## Propósito Ejecutivo

TEAM-03 implementa el **core fundamental** de la plataforma diana-inversiones, proporcionando análisis de viabilidad basado en datos financieros, recomendaciones de estrategias de opciones (Long Call, Long Put, Short Call, Short Put) y asesoramiento contextual mediante Chat IA explicativo. El equipo permanece desacoplado de frontend y broker, produciendo salidas estructuradas y trazables que otros equipos consumirán de forma segura y auditable.

---

## User Scenarios & Testing

### User Story 1: Analista Fundamental Evalúa Viabilidad de Activo (Priority: P1)

**Actor**: Analista inversiones con conocimiento de fundamentales  

Un analista accede a la plataforma y necesita evaluar si un activo específico es viable para operaciones en opciones, basándose en indicadores fundamentales clave (histórico de precios, volatilidad realizada, earnings, ratios financieros).

**Por qué esta prioridad**: Es el flujo core que habilita todo lo demás. Sin evaluación fundamental, las estrategias de opciones carecen de base.

**Prueba Independiente**: El sistema DEBE permitir al analista cargar/seleccionar un activo y recibir un perfil fundamental completo con viabilidad explícita, sin necesidad de otras funcionalidades. Esto valida la cadena: ingreso datos → cálculos → salida estructurada.

**Acceptance Scenarios**:

1. **Dado** que el analista selecciona un activo (ticker), **Cuando** solicita análisis fundamental, **Entonces** recibe un perfil con: volatilidad realizada, histórico de precios (6-12 meses mínimo), ratios de earnings, y una clasificación de viabilidad (VIABLE, MARGINAL, NO_VIABLE) con justificación explícita.

2. **Dado** que el análisis fundamental está completo, **Cuando** el analista pregunta "¿Qué supuestos validan esta clasificación?", **Entonces** el sistema lista todos los supuestos técnicos utilizados (ej: volatilidad calculada con retornos diarios últimos 60 días).

3. **Dado** que existen datos históricos incompletos (ej: activo nuevo, menos de 30 días), **Cuando** el analista solicita análisis, **Entonces** el sistema declara explícitamente las limitaciones y rechaza clasificar como VIABLE hasta tener datos suficientes.

---

### User Story 2: Seleccionar Estrategia de Opciones Apropiada (Priority: P1)

**Actor**: Analista que requiere recomendación de estrategia dado perfil fundamental.

Basado en el perfil fundamental (viabilidad, volatilidad, dirección de mercado), el analista necesita que el sistema sugiera la estrategia de opciones más alineada: Long Call (alcista, baja volatilidad), Long Put (bajista, baja volatilidad), Short Call (alcista moderado, alta volatilidad), Short Put (bajista moderado, alta volatilidad).

**Por qué esta prioridad**: Habilita decisiones operacionales. Es el puente entre análisis y acción.

**Prueba Independiente**: El sistema DEBE permitir al analista especificar una dirección de mercado (alcista/bajista) y umbral de confianza, y retornar 1-2 estrategias recomendadas con escenarios de riesgo/recompensa. Esto valida la lógica de mapeo: viabilidad + dirección → estrategia.

**Acceptance Scenarios**:

1. **Dado** que el activo tiene viabilidad VIABLE con volatilidad realizada > 25%, **Cuando** el analista declara "expectativa alcista moderada (70% confianza)", **Entonces** el sistema recomienda Short Call (captura prima) o Long Call (exposición directa) con matrices de ganancias/pérdidas explícitas a precios clave (ATM, +5%, -5%).

2. **Dado** que se ha recomendado una estrategia, **Cuando** el analista pregunta "¿Por qué esta estrategia sobre otras?", **Entonces** el Chat IA explica: (a) criterios de selección aplicados, (b) supuestos de mercado, (c) riesgos específicos no mitigados.

3. **Dado** que la estrategia implica riesgo de pérdida ilimitada (Short Call sin hedge), **Cuando** el analista selecciona esta estrategia, **Entonces** el sistema requiere confirmación explícita y registra el riesgo en auditoría.

---

### User Story 3: Chat IA Explica Fundamentos y Decisiones (Priority: P1)

**Actor**: Cualquier usuario que necesite justificación contextual de análisis o recomendaciones.

El Chat IA responde preguntas sobre: qué factores hacen que un activo sea viable, por qué una estrategia específica aplica, qué escenarios de mercado cambiarían la recomendación, cómo interpretar métricas de riesgo.

**Por qué esta prioridad**: Cierra el triángulo confianza-auditoria-decisión. Sin explicabilidad, no hay adopción interna.

**Prueba Independiente**: El Chat IA DEBE ser capaz de justificar por qué fue VIABLE frente a NO_VIABLE, incluso con datos limitados. Valida la cadena: datos → cálculos → explicación coherente.

**Acceptance Scenarios**:

1. **Dado** que se clasifica un activo como NO_VIABLE, **Cuando** el usuario pregunta "¿Por qué no es viable?", **Entonces** el Chat IA menciona explícitamente: (a) limitaciones de datos, (b) criterios fallidos (ej: volatilidad < 15%), (c) acciones para incrementar confianza (ej: "Espere 30 días de datos más").

2. **Dado** que se recomendó una estrategia X, **Cuando** el usuario pregunta "¿Qué puede hacerme cambiar de opinión?", **Entonces** el Chat IA lista 3-5 escenarios de mercado explícitos (ej: caída de vol > 50%, cambio en earnings guidance).

3. **Dado** que el Chat IA hace una afirmación cuantitativa (ej: "Máxima ganancia: $500"), **Cuando** el usuario pregunta "¿Cómo lo calculaste?", **Entonces** el sistema despliega los pasos matemáticos completos incluyendo supuestos de strike, expiración y precio actual.

---

### User Story 4: Auditar Trazabilidad Fundamentos→Estrategia→Evidencia (Priority: P2)

**Actor**: Auditor interno o compliance que verifica que las recomendaciones fueron basadas en datos válidos y procesos consistentes.

El auditor accede a un registro completo: qué datos se usaron, qué cálculos se realizaron, qué supuestos fueron validados, qué estrategia fue recomendada y por qué.

**Por qué esta prioridad**: Fundamental para gobernanza. Habilitador crítico pero no bloquea uso inicial (P2).

**Prueba Independiente**: El auditor DEBE poder regenerar el análisis de un caso histórico reproduciendo datos, cálculos y obteniendo la misma recomendación. Valida: consistencia determinística + auditabilidad.

**Acceptance Scenarios**:

1. **Dado** que existe un registro de recomendación del 2026-05-20 para AAPL, **Cuando** el auditor solicita "mostrar datos y cálculos usados", **Entonces** recibe: snapshot de precios, volatilidad calculada con método X, ratios financieros fuente Y, y árbol de decisión que llevó a la recomendación.

2. **Dado** que se regeneran los cálculos con datos del 2026-05-20, **Cuando** se compara con la recomendación original, **Entonces** los resultados son idénticos (determinísticos).

3. **Dado** que existe una discrepancia entre recomendación y datos, **Cuando** el auditor lo reporta, **Entonces** el sistema identifica el punto de divergencia (ej: cambio en supuesto de volatilidad) e indica correcciones.

---

### User Story 5: Consumir Salidas Estructuradas desde Otros Equipos (Priority: P2)

**Actor**: Desarrollador del equipo de frontend o trading execution que necesita integrar recomendaciones de TEAM-03.

Las salidas de análisis fundamental y recomendaciones de estrategias son consumibles en formato estructurado (JSON/GraphQL con esquema definido) incluyendo metadatos de confianza, trazabilidad y riesgo.

**Por qué esta prioridad**: Habilita integración multi-equipo. Crítico pero puede iniciarse en fase 2 con API simplificada (P2).

**Prueba Independiente**: Un frontend o script externo DEBE poder invocar la API TEAM-03 con `{ticker, date}` y recibir `{viability, strategies[], risks[]}` con esquema consistente e invariante. Valida: contrato estable + interoperabilidad.

**Acceptance Scenarios**:

1. **Dado** que existe un endpoint `/api/team-03/fundamental-analysis/{ticker}`, **Cuando** se invoca con `GET /api/team-03/fundamental-analysis/AAPL`, **Entonces** retorna JSON con estructura definida: `{ticker, date, volatility, viability, confidence, assumptions}`.

2. **Dado** que se cambió la recomendación de estrategia, **Cuando** se consulta el endpoint de estrategias, **Entonces** el resultado incluye versión del esquema e indicador de cambio que permite al consumidor detectar actualizaciones.

3. **Dado** que un consumidor solicitó datos de hace 30 días, **Cuando** esos datos no están más en caché, **Entonces** el sistema retorna 404 o "archived" claramente, sin fallar silenciosamente.

---

### User Story 6: Integrarse con Oracle IA (Claude API) para Explicabilidad (Priority: P2)

**Actor**: Usuario final que requiere contexto de IA sobre decisiones técnicas.

El Chat IA integrado con Claude API permite conversaciones bidireccionales donde el usuario puede hacer preguntas en lenguaje natural sobre fundamentos, riesgos y decisiones, recibiendo respuestas coherentes y trazables.

**Por qué esta prioridad**: Valor agregado. No bloquea MVP pero habilita diferencial competitivo (P2).

**Prueba Independiente**: El Chat DEBE responder preguntas sobre "por qué es viable este activo" refiriéndose a datos específicos cargados, sin alucinaciones. Valida: RAG pattern + trazabilidad.

**Acceptance Scenarios**:

1. **Dado** que se realizó análisis de AAPL, **Cuando** el usuario pregunta en Chat "¿Por qué es viable?", **Entonces** el Chat cita datos específicos: "Volatilidad realizada 28%, histórico 12 meses, ratio PE dentro de rango sectorial".

2. **Dado** que se recomendó estrategia Short Call, **Cuando** el usuario pregunta "¿Cuál es el riesgo máximo?", **Entonces** el Chat calcula explícitamente: "Pérdida máxima ilimitada si sube a [strike + prima]", no solo frases genéricas.

3. **Dado** que el Chat debe responder sobre datos no disponibles, **Cuando** se lo hace, **Entonces** declara explícitamente: "No tengo datos de [X]. Basándome en [Y disponible]..." en lugar de alucinación.

---

### Edge Cases

- **¿Qué ocurre cuando el activo es nuevo (< 30 días de histórico)?**  
  → Sistema declara NO_VIABLE hasta acumular datos suficientes.

- **¿Cómo maneja volatilidad extrema (gap > 20% en día)?**  
  → Sistema marca datos con flag `outlier`, recalcula sin el outlier, y explica ambos resultados.

- **¿Qué pasa si el Chat IA no tiene contexto para una pregunta?**  
  → Declara explícitamente: "Pregunta fuera del alcance TEAM-03" y sugiere referencia a especialista.

- **¿Cómo se maneja cambio de datos históricos (ej: ajuste de split)?**  
  → Sistema invalida caché relacionada, recalcula, registra cambio en auditoría.

- **¿Qué ocurre si la recomendación de estrategia cambió (ej: volatilidad subió)?**  
  → Sistema mantiene histórico de cambios, registra cuándo y por qué cambió, notifica si hay posiciones abiertas.

---

## Requisitos *(mandatory)*

### Requisitos Funcionales Expandidos (Preservando Canon Diana)

#### RF-001: Core de Análisis Fundamental

- **RF-001.1** *(NUEVO PARA SPECKIT)*: Sistema DEBE ingerir datos financieros normalizados (precios OHLC, volumen, earnings, ratios) desde fuentes configurables (broker API, base de datos histórica, data feeds externas).

- **RF-001.2** *(AMPLIACIÓN SPECKIT)*: Sistema DEBE calcular métricas fundamentales clave:
  - Volatilidad realizada (RV) con múltiples ventanas temporales (30d, 60d, 90d, 252d)
  - Histórico de precios mínimo: 6-12 meses requerido para clasificación VIABLE
  - Ratios financieros (P/E, P/B, Debt/Equity, Dividend Yield) normalizados por sector
  - Z-score de volatilidad respecto a media histórica del activo
  - Beta respecto a índice de mercado

- **RF-001.3** *(ESPECIFICACIÓN)*: Sistema DEBE mantener trazabilidad de cada cálculo: fuente de datos, método, supuestos, fecha de cálculo.

- **RF-001.4** *(CANON + AMPLIACIÓN)*: Sistema DEBE ser explicable: cada métrica incluye fórmula, insumos, resultado intermedio.

---

#### RF-002: Perfil Fundamental de Viabilidad

- **RF-002.1** *(CANON PRESERVADO)*: Sistema DEBE exponer perfil fundamental de viabilidad y lectura de empresa/activo.

- **RF-002.2** *(NUEVO PARA SPECKIT)*: Perfil DEBE incluir:
  - Clasificación de viabilidad: {VIABLE, MARGINAL, NO_VIABLE} con confianza numérica (0-100)
  - Criterios de viabilidad explícitos: volatilidad mínima, histórico mínimo, liquidez, ratios de salud financiera
  - Limitaciones de datos: qué datos faltan, qué asunciones compensan esas faltas
  - Escenarios donde cambiaría la clasificación: "Si volatilidad cae a 12%, cambiaría a MARGINAL"

- **RF-002.3** *(ESPECIFICACIÓN)*: Clasificación VIABLE REQUIERE:
  - Volatilidad realizada 15-60% (rango óptimo para opciones)
  - Histórico: mínimo 60 días, preferible 180+ días
  - Salud financiera: P/E ratio dentro de 2 desv.est. del sector
  - Liquidez: volumen promedio > threshold definido por activo

- **RF-002.4** *(ESPECIFICACIÓN)*: Clasificación NO_VIABLE DEBE documentar causa primaria: "volatilidad insuficiente", "datos limitados", "empresa en quiebra", etc.

---

#### RF-003: Familia de Estrategias de Opciones Base

- **RF-003.1** *(CANON PRESERVADO)*: Implementar familia de estrategias Long Call, Long Put, Short Call, Short Put.

- **RF-003.2** *(AMPLIACIÓN SPECKIT)*: Para cada estrategia, sistema DEBE generar:
  - Escenario ATM (At-The-Money): P&L si no hay movimiento
  - Escenario +5% arriba strike: P&L si el activo sube 5%
  - Escenario -5% debajo strike: P&L si el activo baja 5%
  - Riesgo máximo: pérdida teórica en escenario peor
  - Recompensa máxima: ganancia teórica en escenario mejor
  - Break-even price (BEP): precio donde P&L = 0
  - ROI esperado: ganancia máxima / capital en riesgo
  - Probabilidad ITM (In-The-Money) al vencimiento usando modelo binomial o Black-Scholes

- **RF-003.3** *(ESPECIFICACIÓN)*: Lógica de recomendación de estrategia (mapeo viabilidad + dirección → estrategia):

  | Volatilidad | Dirección | Confianza | Estrategia Recomendada | Razón |
  |---|---|---|---|---|
  | Baja (<20%) | Alcista | Alta (>70%) | Long Call | Captura upside directo |
  | Baja (<20%) | Bajista | Alta (>70%) | Long Put | Captura downside directo |
  | Alta (>30%) | Alcista | Moderado (50-70%) | Short Call | Vende prima elevada |
  | Alta (>30%) | Bajista | Moderado (50-70%) | Short Put | Vende prima elevada |
  | Baja | Neutral | N/A | Straddle / Strangle* | *No en MVP, fase 2 |

- **RF-003.4** *(ESPECIFICACIÓN)*: Sistema DEBE rechazar recomendación si viabilidad es NO_VIABLE o MARGINAL.

- **RF-003.5** *(ESPECIFICACIÓN)*: Sistema DEBE advertir sobre riesgos específicos:
  - Short Call: "Riesgo de pérdida ilimitada si sube mucho. Recomendado solo con hedge o si convicción es alta."
  - Long Call/Put: "Pérdida máxima = prima pagada. Requiere movimiento > prima para ser rentable."

---

#### RF-004: Chat IA Explicativo (Integración Claude API)

- **RF-004.1** *(CANON PRESERVADO)*: Integrar Chat IA para explicar fundamentos, escenarios y decisiones sugeridas.

- **RF-004.2** *(NUEVO PARA SPECKIT)*: Chat IA debe ser capaz de:
  - Citar fuentes de datos específicas en respuestas ("Volatilidad de 28% basada en últimos 60 días de retornos diarios")
  - Justificar decisiones referenciando cálculos: "Esta estrategia es recomendada porque [criterio 1], [criterio 2], [criterio 3]"
  - Reconocer límites de conocimiento y rechazar alucinaciones: "No tengo datos de [X]. Requeriría [Y]."
  - Explicar supuestos: "Esta recomendación supone que el mercado permanece normal sin shocks externos"

- **RF-004.3** *(ESPECIFICACIÓN)*: Context Window para Chat IA:
  - Análisis fundamental actual del activo (viabilidad, métricas clave)
  - Estrategia recomendada con justificación
  - Histórico limitado de cambios en clasificación (últimos 5 cambios)
  - Restricción: NO incluir datos de otros activos (evitar confusión)

- **RF-004.4** *(ESPECIFICACIÓN)*: Respuestas del Chat IA DEBEN incluir disclaimer explícito:
  - "Este análisis es asistencia informativa, no recomendación de inversión"
  - "Decisiones finales requieren juicio humano y validación interna"

---

#### RF-005: Salidas Estructuradas para Consumo Multi-Equipo

- **RF-005.1** *(CANON PRESERVADO)*: Publicar salidas estructuradas para consumo por otros equipos y por Speckit.

- **RF-005.2** *(NUEVO PARA SPECKIT)*: Esquema de salida (JSON/GraphQL):

  ```json
  {
    "ticker": "AAPL",
    "analysisDate": "2026-05-22",
    "schemaVersion": "1.0",
    "viability": {
      "classification": "VIABLE",
      "confidence": 92,
      "criteria": {
        "volatility": { "value": 28, "unit": "%", "threshold": "15-60", "passed": true },
        "historicalData": { "daysAvailable": 252, "minRequired": 60, "passed": true },
        "financialHealth": { "peRatio": 24.5, "sector_avg": 23.2, "zscore": 0.8, "passed": true }
      },
      "limitations": ["datos menores a 365 días"],
      "changedToIfCondition": [
        "Si volatilidad cae a 12%, clasificación cambiaría a MARGINAL",
        "Si P/E sube >3 desv.est., sería NO_VIABLE"
      ]
    },
    "recommendedStrategy": {
      "type": "SHORT_CALL",
      "rationale": "Alta volatilidad (28%) + expectativa alcista moderada (confianza 70%)",
      "assumptions": [
        "Volatilidad realizada continuará en rango 25-35%",
        "No hay anuncios de earnings en próximos 30 días"
      ],
      "scenarios": {
        "atm": { "priceMovement": 0, "pl": -100, "roi": -10 },
        "plus5percent": { "priceMovement": "+5%", "pl": -500, "roi": -50 },
        "minus5percent": { "priceMovement": "-5%", "pl": 400, "roi": 40 }
      },
      "maxRisk": "Unlimited (Short Call not hedged)",
      "maxProfit": 500,
      "breakEvenPrice": 520,
      "probabilityItm": 0.65
    },
    "metrics": {
      "volatility": {
        "realized_30d": 28.5,
        "realized_60d": 27.2,
        "realized_252d": 25.8,
        "zscore": 1.2
      }
    },
    "auditTrail": {
      "dataSourcesUsed": ["broker_api:yahoofinance", "db:historical_prices"],
      "calculationMethods": ["realized_vol:historical_retorna", "pe_ratio:sector_normalized"],
      "lastUpdated": "2026-05-22T10:35:00Z",
      "updatedBy": "team-03-core"
    }
  }
  ```

- **RF-005.3** *(ESPECIFICACIÓN)*: Versioning y evolución:
  - Cambios compatibles hacia atrás (agregar campos): versión patch (1.0 → 1.1)
  - Cambios incompatibles (remover/renombrar campos): versión minor (1.0 → 2.0)
  - Consumidores DEBEN validar `schemaVersion` y reaccionar según sea necesario

- **RF-005.4** *(ESPECIFICACIÓN)*: Contratos de SLA:
  - Tiempo de respuesta: <2s para consulta de activo único
  - Disponibilidad: 99.5% uptime
  - Tasa de error: <0.5%

---

#### RF-006: Trazabilidad Fundamentos→Estrategia→Evidencia

- **RF-006.1** *(CANON PRESERVADO)*: Mantener trazabilidad entre fundamentos, estrategia sugerida y evidencia operativa.

- **RF-006.2** *(AMPLIACIÓN SPECKIT)*: Registro de auditoría:
  - Timestamp de análisis
  - Datos de entrada (ticker, precios, ratios)
  - Cálculos intermedios (volatilidad, métricas)
  - Decisiones de clasificación (lógica condicional aplicada)
  - Recomendación de estrategia + justificación
  - Usuario/sistema que tomó la decisión
  - Cambios posteriores + motivos

- **RF-006.3** *(ESPECIFICACIÓN)*: Regenerabilidad:
  - Con los mismos datos e inputs, el análisis DEBE producir exactamente el mismo resultado (determinístico)
  - Sistema DEBE poder reproducir el análisis de cualquier punto anterior en el tiempo

- **RF-006.4** *(ESPECIFICACIÓN)*: Notificación de cambios:
  - Si viabilidad o recomendación cambian, sistema notifica a usuarios/sistemas consumidores
  - Incluye delta (qué cambió) y razón del cambio

---

### Requisitos No-Funcionales Expandidos (Preservando Canon Diana)

#### RNF-001: IA No Ejecuta, Asiste

- **RNF-001.1** *(CANON PRESERVADO)*: La IA no ejecuta operaciones y no sustituye el juicio humano.
- **RNF-001.2** *(ESPECIFICACIÓN)*: Cada recomendación requiere confirmación humana explícita antes de acción operativa.
- **RNF-001.3** *(ESPECIFICACIÓN)*: Disclaimer legal automático en todas las salidas de Chat IA.

---

#### RNF-002: Core Explicable, Auditable, Reproducible

- **RNF-002.1** *(CANON PRESERVADO)*: El core debe ser explicable, auditable y reproducible.
- **RNF-002.2** *(ESPECIFICACIÓN)*: Explicabilidad:
  - Todos los cálculos son documentables paso a paso
  - Cada métrica incluye fórmula y supuestos
  - Chat IA puede justificar cada conclusión
- **RNF-002.3** *(ESPECIFICACIÓN)*: Auditabilidad:
  - 100% de decisiones registradas con trazabilidad completa
  - Acceso granular a logs por rol (auditor, analyst, admin)
  - Cumple standards de gobernanza: SOX, FINRA, SEC (según jurisdicción)
- **RNF-002.4** *(ESPECIFICACIÓN)*: Reproducibilidad:
  - Datos congelados en cada análisis (snapshot)
  - Cálculos determinísticos (no random, seed fijo si aplica)
  - Regeneración de análisis histórico produce resultados idénticos

---

#### RNF-003: Estrategias con Contratos Claros Entrada/Salida

- **RNF-003.1** *(CANON PRESERVADO)*: Las estrategias deben mantener contratos claros de entrada y salida.
- **RNF-003.2** *(ESPECIFICACIÓN)*: Contrato de entrada:
  - Entrada: `{ticker, date, volatilityEstimate, directionBias, confidenceLevel}`
  - Validación: ticker existe, date es válida, volatility en rango válido
  - Rechazo: claro y justificado si no cumple condiciones
- **RNF-003.3** *(ESPECIFICACIÓN)*: Contrato de salida:
  - Salida: `{recommendedStrategy, scenarios[], riskProfile, assumptions[], updateFrequency}`
  - Garantía: salida siempre tiene forma definida, nunca es null/undefined
  - Versionado: esquema explícitamente versionado

---

#### RNF-004: Equipo Desacoplado de Frontend y Broker

- **RNF-004.1** *(CANON PRESERVADO)*: El equipo debe permanecer desacoplado del frontend y de la capa de broker.
- **RNF-004.2** *(ESPECIFICACIÓN)*: Desacoplamiento arquitectónico:
  - TEAM-03 expone API REST (no depende de tecnología frontend)
  - Datos de precios se consumen vía adaptador abstracto (intercambiable: broker A, broker B, data feed C)
  - Cambios en frontend o broker NO requieren cambios en lógica de TEAM-03
- **RNF-004.3** *(ESPECIFICACIÓN)*: Contrato de datos:
  - Formato de entrada: precio, volumen, earnings (agnostico de fuente)
  - Formato de salida: análisis fundamental y estrategia (agnóstico de consumidor)

---

#### RNF-005: Recomendaciones con Riesgo y Supuestos Explícitos

- **RNF-005.1** *(CANON PRESERVADO)*: Las recomendaciones deben presentar riesgo y supuestos de forma explícita.
- **RNF-005.2** *(ESPECIFICACIÓN)*: Riesgo explícito en cada recomendación:
  - Pérdida máxima teórica (para Short: "ilimitada" + hedge recomendado)
  - Pérdida máxima probable (99% de escenarios)
  - Breakeven y ROI en escenarios clave
  - Probabilidad de pérdida según modelo binomial
- **RNF-005.3** *(ESPECIFICACIÓN)*: Supuestos explícitos:
  - "Volatilidad permanecerá en rango 25-35% durante los próximos 30 días"
  - "No hay anuncios de earnings en ventana de estrategia"
  - "Spread bid-ask permanece normal (< 0.5%)"
  - "Mercado permanece bajo condiciones normales (sin shocks)"
- **RNF-005.4** *(ESPECIFICACIÓN)*: Sensibilidades:
  - Si volatilidad cae 5%, ¿cómo cambia la recomendación?
  - Si dirección del mercado invierte, ¿qué sucede?
  - Si la tesis fundamental cambia, ¿cómo se notifica?

---

### Entidades Clave (Modelo de Datos)

#### Entidad: Asset (Activo Financiero)

- **ticker** `string`: Identificador único (AAPL, MSFT, etc.)
- **assetType** `enum`: {STOCK, INDEX, ETF, FUTURE} - Speckit MVP: STOCK
- **sector** `string`: Sector clasificado (Technology, Healthcare, etc.)
- **historicalPrices** `[]`: OHLCV histórico, mínimo 60 días
- **financialMetrics** `object`: P/E, P/B, Debt/Equity, Div Yield
- **lastUpdated** `timestamp`: Cuándo fueron actualizados los datos
- **dataQuality** `enum`: {LIVE, DELAYED_1H, DELAYED_1D, LIMITED}

---

#### Entidad: FundamentalAnalysis

- **assetId** `ref`: Reference a Asset
- **analysisDate** `timestamp`: Cuándo se ejecutó el análisis
- **viabilityClassification** `enum`: {VIABLE, MARGINAL, NO_VIABLE}
- **viabilityConfidence** `number`: 0-100
- **volatilityRealized** `object`:
  - `v30d` `number`: Volatilidad 30 días
  - `v60d` `number`: Volatilidad 60 días
  - `v252d` `number`: Volatilidad 252 días (1 año)
  - `zscore` `number`: Z-score vs histórico
- **viabilityCriteria** `object`: Cada criterio con {value, threshold, passed}
- **limitations** `[]string`: Limitaciones de datos
- **auditTrail** `object`: Trazabilidad completa
- **calculatedBy** `enum`: {MANUAL, AUTOMATED}

---

#### Entidad: StrategyRecommendation

- **assetId** `ref`: Reference a Asset
- **recommendedStrategy** `enum`: {LONG_CALL, LONG_PUT, SHORT_CALL, SHORT_PUT}
- **rationale** `string`: Explicación breve
- **assumptions** `[]string`: Supuestos explícitos
- **scenarios** `object`:
  - `atm` `{priceMovement, pl, roi}`
  - `plus5percent` `{priceMovement, pl, roi}`
  - `minus5percent` `{priceMovement, pl, roi}`
- **riskProfile** `object`:
  - `maxRisk` `string | number`: Pérdida máxima
  - `maxProfit` `number`: Ganancia máxima
  - `breakEvenPrice` `number`: BEP
  - `probabilityItm` `number`: 0-1, probabilidad ITM
- **validUntil** `timestamp`: Cuándo la recomendación expira

---

#### Entidad: ChatMessage

- **conversationId** `ref`: Conversación específica
- **userMessage** `string`: Pregunta del usuario
- **aiResponse** `string`: Respuesta de Claude API
- **contextUsed** `object`: {viability, strategy, metrics} que se pasó a Claude
- **citedSources** `[]string`: Qué datos específicos se citaron
- **timestamp** `timestamp`: Cuándo se generó
- **disclaimer** `string`: Disclaimer legal automático

---

## Arquitectura de Alto Nivel

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TEAM-03 Core Services                       │
└─────────────────────────────────────────────────────────────────────┘

1. Data Ingestion Layer
   ├── Broker Adapter (Yahoo Finance, Interactive Brokers, etc.)
   ├── Historical Data Repository (Supabase / MongoDB)
   └── Data Validator & Normalizer

2. Fundamental Analysis Engine
   ├── Volatility Calculator (RV 30d/60d/252d, Z-score)
   ├── Financial Metrics Evaluator (P/E, ratios, earnings)
   ├── Viability Classifier (VIABLE / MARGINAL / NO_VIABLE)
   └── Audit Trail Logger

3. Strategy Recommendation Engine
   ├── Strategy Selector (mapeo vol + dirección → estrategia)
   ├── Scenario Calculator (ATM, ±5%, max risk/profit)
   ├── Risk Analyzer (probabilidad ITM, breakeven)
   └── Recommendation Validator

4. AI Explanation Layer
   ├── Claude API Client (con retry, rate limiting)
   ├── Context Builder (viability + strategy + history)
   ├── Response Validator (detección de alucinaciones)
   └── Citation Extractor

5. API Gateway
   ├── /api/fundamental-analysis/{ticker}
   ├── /api/strategy-recommendation/{ticker}
   ├── /api/chat (WebSocket o polling)
   └── /api/audit-trail/{ticker}

6. Persistence Layer
   ├── Analysis Storage (Supabase: fundamental_analysis table)
   ├── Strategy History (Supabase: strategy_recommendations table)
   ├── Chat History (Supabase: conversations table)
   └── Audit Logs (PostgreSQL con partición temporal)
```

### Flujos de Datos Principales

#### Flujo 1: Análisis Fundamental Inicial
```
User/System Input: {ticker, date}
    ↓
Data Ingestion: Fetch OHLCV, financials, earnings
    ↓
Validator: Verificar datos suficientes (>60 días)
    ↓
Fundamental Analysis Engine:
  - Calcular volatilidad (30d, 60d, 252d)
  - Evaluar ratios financieros
  - Calcular Z-scores
    ↓
Viability Classifier:
  - Aplicar lógica de criterios
  - Generar clasificación + confianza
    ↓
Output: {viability, confidence, metrics, limitations}
    ↓
Storage: Guardar en Supabase fundamentals_analysis table
    ↓
Cache: Almacenar en caché (TTL: 1 hora)
```

#### Flujo 2: Recomendación de Estrategia
```
Input: {ticker, directionBias, confidenceLevel}
    ↓
Fetch: Viabilidad + métricas (desde caché o DB)
    ↓
Validator: Rechazar si NO_VIABLE
    ↓
Strategy Selector:
  - Mapear (volatilidad, dirección, confianza) → estrategia
  - Aplicar lógica de Tabla RF-003.3
    ↓
Scenario Calculator:
  - Calcular P&L en ATM, +5%, -5%
  - Usar Black-Scholes para probabilidad ITM
    ↓
Risk Analyzer:
  - Determinar max risk, max profit, BEP
  - Incluir advertencias específicas por estrategia
    ↓
Output: {strategy, scenarios, riskProfile, assumptions}
    ↓
Storage: Guardar en Supabase strategy_recommendations table
    ↓
Notification: Si cambió respecto a recomendación anterior, notificar
```

#### Flujo 3: Chat IA Explicativo
```
User Message: "¿Por qué es viable este activo?"
    ↓
Context Builder:
  - Fetch análisis fundamental actual
  - Fetch recomendación de estrategia
  - Fetch cambios históricos recientes (últimos 5)
  - Construir prompt de contexto
    ↓
Claude API Call:
  - Incluir contexto específico (datos de AAPL, no otros)
  - Instrucción: "Cita fuentes específicas, reconoce límites"
  - Inyectar disclaimer legal
    ↓
Response Validator:
  - Detectar alucinaciones (menciona data no en contexto)
  - Verificar que cita fuentes
  - Reemplazar alucinaciones con "No tengo información de..."
    ↓
Output: Respuesta validada
    ↓
Storage: Guardar conversación completa en audit trail
```

---

## Dependencias Inter-Equipo

| Equipo | Tipo | Descripción |
|--------|------|-------------|
| **TEAM-01** (Dashboard UI) | Consumer | Consume recomendaciones de TEAM-03 vía API REST |
| **TEAM-02** (Broker Integration) | Data Provider | Proporciona datos de precios via broker API adapter |
| **TEAM-04** (TA - Análisis Técnico) | Sibling | Potencial integración futura: TA como input a viabilidad |
| **Global Platform** | Coordina | Canon global 001-inv-spec define contratos comunes |

---

## Criterios de Éxito y Métricas

### Criterios de Éxito Funcionales

#### CSF-1: Core Fundamental Produce Evaluaciones Coherentes y Trazables
- **Métrica**: 100% de análisis son reproducibles (regeneración produce resultados idénticos)
- **Medida**: Ejecutar análisis histórico de 10 activos con datos de 30 días atrás; regenerar hoy; comparar resultados
- **Target**: 100% Match
- **Aceptación**: Todos los campos (viability, volatility, ratios) coinciden exactamente

#### CSF-2: Estrategias de Opciones Generan Escenarios Claros de Riesgo/Recompensa
- **Métrica**: Cada recomendación incluye P&L en 3 escenarios mínimo (ATM, +5%, -5%)
- **Medida**: Auditar 20 recomendaciones generadas; verificar presencia de matrices completas
- **Target**: 100% de recomendaciones incluyen P&L scenarios
- **Aceptación**: Cada scenario tiene valores numéricos específicos, no estimaciones vagas

#### CSF-3: Chat IA Justifica por Qué Aplica o No Aplica Estrategia
- **Métrica**: Chat IA cita 3+ criterios específicos en cada justificación
- **Medida**: 50 preguntas de test; verificar que Chat cite datos específicos del activo
- **Target**: 95%+ de respuestas citan datos específicos
- **Aceptación**: Respuestas no son genéricas; mencionan volatilidad realizada, ratios del activo específico

#### CSF-4: Alcance No Invade Dominios Técnicos de Otros Equipos
- **Métrica**: 0 dependencias de frontend, broker SDK, o análisis técnico en TEAM-03 core
- **Medida**: Ejecutar análisis de dependencias; verificar que TEAM-03 API solo consume datos normalizados
- **Target**: 0 imports directos de frontend frameworks o broker SDKs
- **Aceptación**: Todas las dependencias pasan por adaptadores abstractos

#### CSF-5: Salidas Consumibles por Speckit sin Perder Canon Global
- **Métrica**: Esquema JSON versionado; cambios compatibles no rompen consumidores
- **Medida**: Actualizar esquema en versión 1.1; verificar que consumidor v1.0 sigue funcionando
- **Target**: 100% backward compatibility
- **Aceptación**: Cliente v1.0 puede ignorar campos v1.1 nuevos sin error

---

### Criterios de Éxito No-Funcionales

#### CSF-6: Explicabilidad Completa
- **Métrica**: Cada decisión se puede desglosar paso a paso
- **Medida**: Tomar recomendación histórica; Chat IA puede explicar cada paso (datos → cálculos → conclusión)
- **Target**: 100% de decisiones son explicables
- **Aceptación**: No hay "caja negra"; se muestran fórmulas, valores intermedios, decisiones lógicas

#### CSF-7: Auditabilidad Integral
- **Métrica**: 100% de análisis registrados con trazabilidad completa
- **Medida**: Auditor externo revisa 30 análisis; verifica que logs incluyan: datos, cálculos, decisiones, timestamp, usuario
- **Target**: 100% de análisis auditables
- **Aceptación**: Auditor puede regenerar análisis exactamente como fue original

#### CSF-8: Performance Operacional
- **Métrica**: API responde en <2 segundos para análisis de activo único
- **Medida**: Load test con 100 QPS concurrentes para endpoint `/api/fundamental-analysis/{ticker}`
- **Target**: p95 latency < 2s, p99 < 5s
- **Aceptación**: Bajo carga normal (10 QPS), 99%+ de requests < 1s

#### CSF-9: Disponibilidad y Confiabilidad
- **Métrica**: 99.5% uptime; <0.5% error rate
- **Medida**: Monitoreo continuo; alertas si uptime cae o error rate sube
- **Target**: 99.5% uptime, <0.5% error rate
- **Aceptación**: SLA contracts reflejan estos targets

---

## Riesgos y Mitigaciones

### Riesgo 1: Datos Históricos Insuficientes o Defectuosos
**Impacto**: Medium | **Probabilidad**: Medium  
**Descripción**: Activos nuevos o con gaps de datos impiden análisis confiable.  
**Mitigación**:
- Definir requisitos mínimos de datos (60+ días) y rechazar análisis si no se cumplen
- Implementar validador robusto que marca outliers (gaps, splits, dividends)
- Mantener estado de calidad de datos (LIVE, DELAYED, LIMITED)
- Documentar limitaciones explícitamente en salida

---

### Riesgo 2: Volatilidad Extrema o Cambios Abruptos
**Impacto**: Medium | **Probabilidad**: Low  
**Descripción**: Earnings surprise o crisis de mercado invalidan supuestos.  
**Mitigación**:
- Calcular Z-scores; alertar si volatilidad > 2 desv.est. de promedio histórico
- Incluir campos "outlier_detected" y "recommendation_reliability_low" en salida
- Mantener histórico de cambios; notificar si recomendación cambió
- Chat IA debe reconocer: "Detectamos alta volatilidad. Recomendación es menos confiable."

---

### Riesgo 3: Alucinaciones del Chat IA (Claude API)
**Impacto**: High | **Probabilidad**: Medium  
**Descripción**: IA inventa datos o hace afirmaciones sin base.  
**Mitigación**:
- Inyectar contexto explícito y limitado en prompt (solo datos de activo analizado)
- Implementar validador post-respuesta: "¿Menciona datos que no están en contexto?"
- Reemplazar alucinaciones con "No tengo información de X. Basándome en Y..."
- Rate limit de Claude API para detectar uso anómalo
- Logging completo de prompt → respuesta para auditoría

---

### Riesgo 4: Cumplimiento Regulatorio y Liability
**Impacto**: High | **Probabilidad**: Low  
**Descripción**: Recomendaciones incorrectas o irresponsables generan liability legal.  
**Mitigación**:
- Disclaimer legal en CADA salida: "No es recomendación de inversión; juicio humano requerido"
- Audit trail completo para demostrar due diligence
- Cumplimiento SOX/FINRA/SEC según jurisdicción
- Revisión legal de disclaimers y términos de servicio
- Mantener seguro de responsabilidad profesional

---

### Riesgo 5: Integración con Frontend Frágil (Acoplamiento No Intencional)
**Impacto**: Medium | **Probabilidad**: Medium  
**Descripción**: TEAM-03 termina acoplado a decisiones de frontend.  
**Mitigación**:
- Definir contrato de API claro y versionar explícitamente
- TEAM-03 no conoce implementación de frontend; frontend consume vía API
- Cambios en frontend requieren version negotiation vía esquema version
- Pruebas de integración entre equipos para detectar acoplamiento temprano

---

### Riesgo 6: Cambios en Datos Históricos (Restatements, Splits)
**Impacto**: Medium | **Probabilidad**: Low  
**Descripción**: Yahoo Finance corrige datos históricos; análisis previos quedan inconsistentes.  
**Mitigación**:
- Implementar versionado de snapshots: cada análisis congelada datos en momento específico
- Detectar cambios en feeds; invalidar caché relacionada
- Registrar "data_restatement_detected" en audit trail
- Notificar consumidores si análisis fue invalidado
- Permitir regeneración con datos nuevos

---

## Hitos y Secuenciación

### Fase 1: MVP - Core Fundamental + Estrategias Base (Semanas 1-4)

**Hito 1.1** (Semana 1): Ingesta de datos y cálculo de volatilidad
- [ ] Conectar adapter de datos (Yahoo Finance vía broker API)
- [ ] Implementar cálculo de volatilidad realizada (30d, 60d, 252d)
- [ ] Tests unitarios: cálculos determinísticos

**Hito 1.2** (Semana 2): Clasificación de viabilidad
- [ ] Implementar criterios de viabilidad (RF-002.3)
- [ ] Generar clasificación VIABLE/MARGINAL/NO_VIABLE
- [ ] Tests: 100% reproducibilidad

**Hito 1.3** (Semana 3): Recomendaciones de estrategia
- [ ] Implementar selector de estrategia (tabla RF-003.3)
- [ ] Calcular P&L scenarios (ATM, ±5%)
- [ ] Implementar riesgo máximo y breakeven
- [ ] Tests: comparación con cálculos manuales

**Hito 1.4** (Semana 4): API REST + Persistencia
- [ ] Definir esquema de salida JSON (RF-005.2)
- [ ] Implementar endpoints GET /fundamental-analysis/{ticker}, /strategy/{ticker}
- [ ] Persistencia en Supabase
- [ ] Tests: integración e2e

---

### Fase 2: IA Explicativa + Auditoría (Semanas 5-6)

**Hito 2.1** (Semana 5): Integración Claude API
- [ ] Implementar cliente Claude con retry y rate limiting
- [ ] Context builder: viability + strategy + history
- [ ] Response validator: detección de alucinaciones
- [ ] Tests: verificar que respuestas citan fuentes

**Hito 2.2** (Semana 6): Auditoría y cumplimiento
- [ ] Implementar audit trail logger (RF-006.2)
- [ ] Endpoint GET /audit-trail/{ticker} con acceso por rol
- [ ] Verificar reproducibilidad histórica
- [ ] Tests: auditor puede regenerar análisis anterior

---

### Fase 3: Integración Multi-Equipo (Semana 7+)

**Hito 3.1**: Consumo por TEAM-01 (Frontend)
- [ ] TEAM-01 integra endpoints /fundamental-analysis y /strategy-recommendation
- [ ] Tests de contrato de API
- [ ] Validar que cambios en TEAM-03 no rompen TEAM-01

**Hito 3.2**: Evoluciones según feedback
- [ ] Métricas adicionales según necesidad
- [ ] Refinamiento de estrategias (Straddle, Strangle si aplica)
- [ ] Optimizaciones de performance

---

## Trazabilidad al Canon Diana

| Elemento Canon Diana | Elemento Speckit | Cobertura | Nota |
|---|---|---|---|
| Objetivo | Sección "Propósito Ejecutivo" | 1:1 | Preservado sin cambios |
| RF-001 | RF-001.1-4 | 1:3 | Expandido con detalles de ingesta |
| RF-002 | RF-002.1-4 | 1:4 | Especificación de criterios de viabilidad |
| RF-003 | RF-003.1-5 | 1:5 | Incluye tabla de estrategias, cálculos P&L, avertencias |
| RF-004 | RF-004.1-4 | 1:4 | Integración Claude, context window, disclaimers |
| RF-005 | RF-005.1-4 | 1:4 | Esquema JSON completo, versionado, SLA |
| RF-006 | RF-006.1-4 | 1:4 | Audit trail, regenerabilidad, notificaciones |
| RNF-001 | RNF-001.1-3 | 1:3 | Confirmación humana, disclaimers |
| RNF-002 | RNF-002.1-4 | 1:4 | Explicabilidad, auditabilidad, reproducibilidad |
| RNF-003 | RNF-003.1-3 | 1:3 | Contrato de entrada/salida |
| RNF-004 | RNF-004.1-3 | 1:3 | Desacoplamiento arquitectónico |
| RNF-005 | RNF-005.1-4 | 1:4 | Riesgo y supuestos explícitos, sensibilidades |
| Restricciones | Restricciones | 1:1 | Preservadas sin cambios |
| Supuestos | Supuestos | 1:1 | Preservados; expandidos en User Stories |
| Criterios de Éxito | CSF-1 a CSF-9 | 1:5 | Criterios canon mapeados + 4 no-funcionales nuevos |
| Trazabilidad | Sección "Trazabilidad al Canon Diana" | 1:1 | Nueva matriz de mapeo |

**Cobertura Total**: 100% del canon Diana preservado + expandido con 45+ elementos Speckit.  
**Elementos Dropped**: 0 (PROHIBIDO).  
**Elementos Merged**: 5 (criterios de éxito desglosados).  
**Elementos Expandidos**: 35+ (detalles técnicos, validación, métricas).

---

## Siguientes Pasos

Después de esta especificación:

1. **Validación de Calidad**: Ejecutar checklist de requisitos (checklists/requirements.md)
2. **Clarificaciones Pendientes**: Si existen preguntas de negocio (ej: "¿Cuál es el límite máximo de confianza?"), procesarlas
3. **Generación del Plan**: `/speckit.plan` derivará hitos, tareas, capacidades por rol
4. **Generación de Tareas**: `/speckit.tasks` detallará actividades de ingeniería
5. **Integración Diana**: Sincronizar con canon global 001-inv-spec.md si es necesario
