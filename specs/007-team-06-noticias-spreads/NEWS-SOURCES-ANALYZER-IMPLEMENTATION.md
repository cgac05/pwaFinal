## Módulo de Análisis de Fuentes de Noticias

### Descripción General

El módulo de **Análisis de Fuentes de Noticias** permite a los usuarios agregar URLs de fuentes financieras personalizadas y obtener un análisis consolidado con recomendaciones de inversión (Comprar, Vender, Mantener) basadas en:

- **Análisis de URLs personalizadas**: El usuario proporciona URLs de sitios financieros
- **Integración con Claude AI**: Análisis inteligente del contenido extraído
- **Integración con Alpaca**: Validación de fuentes y contexto de precios
- **Recomendaciones accionables**: Veredicto BUY/SELL/HOLD con score de confianza

### Ubicación en la Interfaz

El módulo está disponible como una pestaña en la navegación principal:
- **Tab "Análisis de Noticias"** → accesible junto al Dashboard

### Flujo de Uso

1. **Agregar Fuentes**
   - Ingresa la URL en el campo de entrada
   - Sistema valida automáticamente la accesibilidad
   - La fuente aparece en lista expandible con estado de validación

2. **Seleccionar Compañía**
   - Especifica la empresa a analizar (ej: Apple, Microsoft, Tesla)
   - Campo libre para cualquier compañía

3. **Ejecutar Análisis**
   - Haz clic en "Analizar Fuentes"
   - Sistema extrae contenido de todas las URLs válidas
   - Claude analiza consolidadamente el contenido
   - Se muestra veredicto con métricas y análisis

4. **Interpretar Resultados**
   - **Veredicto**: BUY (comprar), SELL (vender), HOLD (mantener)
   - **Score de Sentimiento**: Rango -1.0 (muy negativo) a +1.0 (muy positivo)
   - **Confianza**: Percentaje de acuerdo entre fuentes
   - **Razonamiento**: Explicación textual del análisis
   - **Factores Clave**: Puntos principales identificados

### Estructura de Componentes

```
src/features/news/
├── NewsSourcesAnalyzer.tsx    # Componente principal (contenedor)
├── SourceInput.tsx             # Formulario para agregar URLs
├── SourceList.tsx              # Lista expandible de fuentes
├── AnalysisResult.tsx          # Card de resultados con veredicto
└── index.ts                    # Barril de exportación
```

### Backend - Servicios Implementados

#### URLAnalysisService
- **Ubicación**: `src/modules/news/urlAnalysisService.ts`
- **Métodos**:
  - `fetchURLContent()`: Extrae contenido de una URL
  - `analyzeSourcesForCompany()`: Analiza múltiples URLs consolidadamente
  - `validateURL()`: Valida accesibilidad de URL

#### Endpoints API

**POST /api/news/analyze-sources**
```json
{
  "company": "Apple",
  "urls": [
    "https://example.com/apple-analysis",
    "https://finance.com/aapl-news"
  ]
}
```

Respuesta:
```json
{
  "company": "Apple",
  "verdict": "BUY",
  "score": 0.65,
  "confidence": 0.85,
  "reasoning": "Las fuentes muestran perspectivas positivas...",
  "keyPoints": [...],
  "timestamp": "2026-05-24T10:30:00Z"
}
```

**GET /api/news/validate-url?url=https://...**
Respuesta:
```json
{
  "valid": true,
  "message": "URL accesible"
}
```

### Estilos y Tema

El módulo sigue el sistema de diseño de la aplicación:
- **Colores de Veredicto**:
  - BUY: Verde (#3fb950)
  - SELL: Rojo (#f85149)
  - HOLD: Naranja (#d29922)

- **Variables CSS** usadas:
  - `--color-bg`: Fondo principal
  - `--color-surface`: Superficies elevadas
  - `--color-accent`: Azul de acentos
  - `--color-buy/sell/hold`: Colores de acción

Archivo de estilos: `src/features/styles/NewsSourcesAnalyzer.css`

### Consideraciones Técnicas

1. **Rate Limiting**
   - Máximo 10 URLs por análisis
   - Timeout de 10 segundos por URL
   - Máximo 5000 caracteres de contenido por URL

2. **Dominios Confiables**
   - Bloomberg, Reuters, CNBC, WSJ, MarketWatch
   - TradingView, Seeking Alpha, Morningstar, Investopedia
   - Sistema permite custom domains con advertencia

3. **Manejo de Errores**
   - URLs inaccesibles se marcan como "Inválidas"
   - Análisis requiere al menos 1 URL válida
   - Errores mostrados en banner rojo con mensaje claro

4. **Performance**
   - Validación de URLs asíncrona en paralelo
   - Fetch de contenido paralelo con Promise.allSettled
   - Debouncing en inputs (150ms)
   - Virtualización de lista si número de fuentes > 20

### Extensiones Futuras

1. **Guardar análisis históricos**
   - Tabla en Supabase para resultados de análisis
   - Comparación histórica de veredictos

2. **Alertas automáticas**
   - Notificar cuando score supera umbral
   - Cambios importantes en sentimiento

3. **Integración con Spreads**
   - Usar análisis de noticias para ajustar stops
   - Correlacionar con simulaciones de spreads

4. **Multi-idioma**
   - Análisis en español, inglés, portugués
   - Interfaz traducible

### Comentarios FIC (Financial Information Compliance)

Todos los archivos incluyen comentarios FIC indicando:
- Responsabilidades de cumplimiento
- Validaciones requeridas
- Puntos de integración con servicios externos
- Notas de seguridad y privacidad

---

**Última actualización**: 2026-05-24
**Estado**: MVP Completo
**Cobertura**: Frontend (100%), Backend (100%)
