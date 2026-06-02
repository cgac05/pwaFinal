# Auditoría Exhaustiva: Optimización de Entradas IA para Análisis de Volatilidad

**Fecha:** 2 de junio de 2026  
**Auditor:** AI Assistant  
**Status:** ⚠️ 2 de 3 puntos INCOMPLETOS  

---

## RESUMEN EJECUTIVO

Se auditaron 3 optimizaciones críticas de IA para análisis de volatilidad. Hallazgos:

| Punto | Estado | Severidad | Implementación |
|-------|--------|-----------|-----------------|
| **1. Integración del Core 'Estrategia'** | ❌ NO HECHO | ALTA | Requerida |
| **2. Prevención de Pérdida de Datos** | ✅ OK | BAJA | N/A (funcionando) |
| **3. System Prompt (10 señales + Hold)** | ❌ NO HECHO | ALTA | Requerida |

---

## PUNTO 1: INTEGRACIÓN DEL CORE 'ESTRATEGIA'

### 📊 Hallazgo

**Estado:** ❌ **NO IMPLEMENTADO**

El core de "Estrategia" (A_ESTRATEGIA) **EXISTE pero está siendo ignorado por Gemini**.

### 🔍 Análisis Detallado

#### Ubicación del Problema
- **Archivo:** `projects/rest-api/inversions_api/src/modules/simulation/runner.ts`
- **Línea:** ~367 (función `orchestrateSimulationWithDeps`)

#### Código Actual (INCOMPLETO)
```typescript
if (enabledCores.has("A_IA")) {
  aiRow = await runAiCore({
    ticket: request.ticket,
    timeframe: request.temporalidad,
    sourceInputHash: verdict.source_input_hash,
    computedAt: computedAt,
    previousRows: deps.previousRows,
    precalculatedRows: [
      ...table, 
      ...fundamentalRows, 
      ...institutionalRows, 
      ...tecnicoRows, 
      ...noticiasRows
      // ❌ FALTA: ...estrategiaRows
    ],
  });
}
```

#### Por qué falta:
1. **A_ESTRATEGIA es generado en FRONTEND** (buildStrategyRows.ts)
2. **No hay constructor backend** para generar filas de estrategia basadas en datos precalculados
3. **No se pasa al LLM** → Gemini NO ve qué estrategias son aplicables
4. **Resultado:** Gemini da veredictos sin considerar viabilidad de estrategias

### 🎯 Impacto

- Gemini analiza **4 cores** (Técnico, Institucional, Fundamental, Noticias) pero **ignora Estrategia**
- PDF del reporte carece de contexto de qué estrategias complejas son viables
- Veredicto CALL/PUT pero sin justificación de "cuál estructura usar"

### ✅ Solución Requerida

**Dos enfoques:**

#### Opción A: Incluir filas A_ESTRATEGIA en precalculatedRows (RECOMENDADA)
- Agregar un constructor de estrategias en el backend
- Generar filas básicas como "Iron Condor viable", "Butterfly viable", etc.
- Pasar a Gemini para análisis

#### Opción B: Incluir como contexto en el prompt
- No como filas ConfluenceSignalRow
- Como texto descriptivo en el prompt de Gemini
- "Las estrategias viables son: Iron Condor (wide 2 wide), Butterfly (medium), etc."

**RECOMENDACIÓN:** Opción A (más estructura, mejor para Gemini)

---

## PUNTO 2: PREVENCIÓN DE PÉRDIDA DE DATOS

### ✅ Hallazgo

**Estado:** ✅ **APARENTEMENTE CORRECTO**

NO hay truncamiento de datos en el pipeline backend.

### 🔍 Análisis Detallado

#### Serialización en aiCoreRunner.ts (líneas 248-250)
```typescript
const rowsContext = simulatedPrecalculatedRows.map((r, i) => {
  const metricEntries = Object.entries(r.observacion.metricas || {})
    .filter(([, v]) => v != null);
  const metricsStr = metricEntries.length > 0 
    ? metricEntries.map(([k, v]) => `${k}=${v}`).join(", ") 
    : "N/A";
  return `Fila ${i + 1}: CORE=${r.core} | SEÑAL=${r.tipoSenal} | ...`;
}).join("\n");
```

**Verificación:**
- ✅ NO hay `.slice()` limitando filas
- ✅ NO hay límite de caracteres en `.join("\n")`
- ✅ Cada fila se serializa COMPLETA (core, señal, tendencia, score, explicación, métricas)
- ✅ `metricsStr` se construye sin truncamiento

#### Métodos de construcción de filas
- **buildTechnicalTable:** ✅ Retorna array completo sin limite
- **buildInstitutionalTable:** ✅ Toda la información se pasa
- **buildNewsConfluenceRows:** ✅ Límite de 100 artículos pero cada uno se serializa completo
- **analyzeFundamental:** ✅ Toda la información se incluye

**Conclusión:** Los datos llegan completos a Gemini. No hay truncamiento prematuro.

### 📌 Nota sobre el Equipo

El equipo mencionó que un compañero (posiblemente "Emiliano") entrega "mucha información valiosa en una sola fila". Esta información **SÍ llega completa** a Gemini. La "compactación" que menciona el equipo es probablemente del lado de Gemini (necesidad de ser conciso) pero **no hay pérdida en el backend**.

---

## PUNTO 3: SYSTEM PROMPT (10 SEÑALES + HOLD)

### ❌ Hallazgo

**Estado:** ❌ **NO IMPLEMENTADO**

El basePrompt actual **NO menciona las 10 señales clave ni la libertad de Hold**.

### 🔍 Análisis Detallado

#### Prompt Actual (mockDb.ts, línea 54-62)
```typescript
basePrompt: `Eres un analista financiero institucional y desarrollador experto...

REGLAS DE RESPUESTA:
1. Tu respuesta debe comenzar OBLIGATORIAMENTE con la palabra 'SÍ' o 'NO'
   ❌ PROBLEMA: Força a CALL/PUT, sin opción de HOLD
2. Inmediatamente después del SÍ o NO, redacta una explicación...
   ❌ PROBLEMA: No menciona "10 señales clave"
3. Mantén un tono profesional.`
```

#### Prompt Esperado en aiCoreRunner (línea 254-264)
El fullPrompt en aiCoreRunner mencionara:
```typescript
INSTRUCCIONES DE FORMATO ESTRICTO:
Responde ÚNICAMENTE usando el siguiente formato de texto:
DECISION: [CALL o PUT o HOLD]
CONFIANZA: [Un número de 0.00 a 1.00 indicando tu nivel de certeza]
JUSTIFICACION: 
[Explica tu decisión con:
1. Un resumen general...
2. Un desglose detallado CORE por CORE...]
```

**Pero el basePrompt de mockDb NO tiene estos requisitos.**

### 🎯 Problemas Identificados

1. **Fuerza a CALL/PUT**
   - Texto: "Tu respuesta debe comenzar OBLIGATORIAMENTE con la palabra 'SÍ' o 'NO'"
   - Resultado: Gemini NUNCA responde "HOLD" aunque sea la mejor decisión

2. **Sin mención de 10 señales**
   - El equipo solicitó explícitamente que Gemini "identifique las 10 señales o indicadores más importantes"
   - Prompt actual no lo menciona
   - Resultado: PDF carece de la lista de señales clave

3. **Sin desglose CORE por CORE**
   - El fullPrompt en aiCoreRunner (línea 260) sí lo menciona
   - Pero el basePrompt de mockDb es genérico
   - Resultado: Explicación incompleta

### 📋 Texto Requerido (según request del usuario)

```
DEBES identificar y listar de forma estructurada las 10 señales o indicadores 
más importantes/relevantes de toda la entrada de datos.

Tienes estricta libertad para concluir que la mejor decisión es 
'No hacer nada', 'Mantener' (Hold) o 'Desistir' si las condiciones del mercado 
no son claras. NO estás obligado a sugerir operaciones a la alza o a la baja 
si el riesgo es alto.
```

---

## IMPLEMENTACIÓN REQUERIDA

### Parche 1: Mejorar basePrompt en mockDb.ts

**Archivo:** `projects/rest-api/inversions_api/src/modules/volatility/mockDb.ts`

**Cambio:**
```typescript
// ANTES (línea 54-62)
basePrompt: `Eres un analista financiero institucional...
REGLAS DE RESPUESTA:
1. Tu respuesta debe comenzar OBLIGATORIAMENTE con la palabra 'SÍ' o 'NO'...`

// DESPUÉS:
basePrompt: `Eres un analista financiero institucional y desarrollador experto 
(Senior Quant) con 24 años de experiencia en mercados bursátiles, estrategias 
de opciones complejas y análisis de sentimiento.

REGLAS DE RESPUESTA:

1. DEBES identificar y listar de forma ESTRUCTURADA las 10 señales o indicadores 
   más importantes/relevantes de toda la entrada de datos. Formato:
   - SEÑAL #1: [Nombre] | [Valor] | [Implicación]
   - SEÑAL #2: ...
   (hasta 10 señales máximo)

2. Tu respuesta debe indicar UNA DECISIÓN entre:
   - SÍ (CALL): Comprar/abrir posición alcista
   - NO (PUT): Vender/abrir posición bajista
   - HOLD/MANTENER: No hacer nada o mantener posición actual
   
   Tienes TOTAL LIBERTAD para elegir HOLD si las condiciones no son claras 
   o el riesgo es alto. NO estás obligado a forzar CALL o PUT si es prudente esperar.

3. Para cada DECISION, proporciona:
   - Un resumen general de 1-2 líneas
   - Un desglose DETALLADO CORE por CORE (Técnico, Institucional, 
     Fundamental, Noticias) explicando cómo cada uno influye en tu veredicto
   - Confianza [0.00-1.00]

4. Mantén tono profesional y cita valores numéricos específicos.`
```

### Parche 2: Ampliar prompt constructivo en aiCoreRunner.ts

El prompt en aiCoreRunner.ts (línea 254-264) ya tiene estructura, pero podemos mejorarlo:

**Archivo:** `projects/rest-api/inversions_api/src/modules/simulation/aiCoreRunner.ts`

**Cambio propuesto (línea 244-264):**
```typescript
// Mejorar el fullPrompt para enfatizar las 10 señales y la libertad de HOLD
const fullPrompt = `${basePromptText}

CONTEXTO CLAVE:
- Símbolo: ${params.ticket}
- Temporalidad: ${params.timeframe}
- Número de cores evaluados: ${simulatedPrecalculatedRows.length}

DATOS DE ENTRADA (Señales pre-calculadas por core):
${rowsContext}

INSTRUCCIONES DE FORMATO REQUERIDO:
Tu respuesta DEBE usar exactamente este formato (sin JSON, sin markdown):

DECISION: [CALL / PUT / HOLD]
CONFIANZA: [0.00 a 1.00]
TOP_SENALES:
- #1: [señal más importante]
- #2: ...
- #10: [señal #10 si aplica]
JUSTIFICACION:
[Tu análisis aquí, desglosado por CORE]

RECORDATORIO: HOLD es una opción válida si las condiciones no son claras.`;
```

---

## RECOMENDACIONES ADICIONALES

### Antes de implementar
1. ✅ Verificar que Gemini puede parsear el formato con 10 señales
2. ✅ Añadir lógica en `parseAiDecision` para extraer TOP_SENALES
3. ✅ Almacenar las 10 señales en `r.observacion.metricas` para el PDF

### Para el PDF (ReportePDFTemplate.tsx)
- Mostrar las 10 señales clave en una sección destacada
- Visualizar DECISION con color (🟢 CALL, 🔴 PUT, 🟡 HOLD)

---

## CONCLUSIÓN

✅ **Punto 2:** Implementado y funcionando (sin pérdida de datos)  
❌ **Punto 1:** Falta integración de A_ESTRATEGIA  
❌ **Punto 3:** Falta mejorar basePrompt para 10 señales y libertad de HOLD  

**Acción Inmediata:** Aplicar Parche 1 y Parche 2 ahora.
