# 📰 Sistema Integrado de Análisis de Noticias Financieras - Prompt para Claude

**Propósito**: Documentar la arquitectura, módulos, contratos y flujos del sistema de análisis de noticias de inversiones para reproducir en otro repositorio con máxima precisión técnica.

**Contexto del Usuario**: 
> "Lo que tenemos que hacer es de varias fuentes de noticias sacar las noticias que se analicen, ver si son buenas noticias sobre el instrumento que estamos analizando. Ponemos un instrumento, de los distintos noticieros de las fuentes que tengamos se extraen las noticias de ese instrumento, se analizan, se ve si es bueno, malo, si pueden que suban las acciones o que bajen y el resultado final es un texto con todo el análisis que se hizo para que el otro equipo pueda ponerlo en la tabla."

---

## 🎯 INSTRUCCIONES PARA CLAUDE

**Usa la siguiente estrategia al leer este documento**:

1. **Fase 1 - Ingesta**: Lee completamente la arquitectura general y los 4 módulos backend para comprender la estructura completa
2. **Fase 2 - Análisis**: Estudia los flujos de datos (Flujo 1 y Flujo 2) para entender el comportamiento del sistema
3. **Fase 3 - Implementación**: Sigue las instrucciones paso a paso, adaptando al nuevo repositorio
4. **Fase 4 - Validación**: Usa el checklist de validación para verificar que todo funciona

**Características esperadas en tu implementación**:
- ✅ Modularidad: Separación clara entre adapters, services y routes
- ✅ Tipificación: TypeScript con interfaces bien definidas
- ✅ Manejo de errores: Try-catch y validación en todos los endpoints
- ✅ Documentación: Comentarios sobre el propósito de cada módulo
- ✅ Testing: Ejemplos de cómo testear cada componente
- ✅ Escalabilidad: Preparado para agregar nuevas fuentes de noticias sin modificar código core

---

## 📋 ÍNDICE
1. [Arquitectura General](#arquitectura-general)
2. [Módulos Backend](#módulos-backend)
3. [Rutas API](#rutas-api)
4. [Componentes Frontend](#componentes-frontend)
5. [Dashboard & CRUD](#dashboard--crud)
6. [Fuentes Predefinidas](#fuentes-predefinidas)
7. [Generación de PDF](#generación-de-pdf)
8. [Sistema de Recomendación](#sistema-de-recomendación)
9. [Flujos de Datos](#flujos-de-datos)
10. [Entidades de Base de Datos](#entidades-de-base-de-datos)
11. [Integraciones Externas](#integraciones-externas)
12. [Instrucciones de Implementación](#instrucciones-de-implementación)

---

## 🏗️ ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │  NewsSourcesUI   │  │  AnalysisResult  │  │ SourceInput  │   │
│  │   Component      │  │    Display       │  │   Handler    │   │
│  └──────────────────┘  └──────────────────┘  └──────────────┘   │
└────────┬────────────────────────────────┬──────────────────────┘
         │                                │
         │ HTTP Requests                  │
         │                                │
┌────────▼────────────────────────────────▼──────────────────────┐
│                      BACKEND (Express + TypeScript)             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Routes Layer                                            │   │
│  │  GET /news/sentiment/:symbol                             │   │
│  └──────────────┬──────────────────────────────────────────┘   │
│                 │                                               │
│  ┌──────────────▼──────────────────────────────────────────┐   │
│  │  Service Layer                                           │   │
│  │  ┌────────────────────────┐  ┌─────────────────────────┐│   │
│  │  │ InvestmentAdvisor      │  │ URLAnalysisService      ││   │
│  │  │ (Orchestrator)         │  │ (Custom URL Analysis)   ││   │
│  │  └────────────────────────┘  └─────────────────────────┘│   │
│  │                                                          │   │
│  │  ┌────────────────────────┐  ┌─────────────────────────┐│   │
│  │  │ SentimentService       │  │ NewsAdapter             ││   │
│  │  │ (Claude/Anthropic)     │  │ (Alpaca News API)       ││   │
│  │  └────────────────────────┘  └─────────────────────────┘│   │
│  └──────────────────────────────────────────────────────────┘   │
│                         │                                        │
│  ┌──────────────────────▼──────────────────────────────────┐   │
│  │  External APIs & Data Sources                           │   │
│  │  - Alpaca News API                                       │   │
│  │  - Anthropic (Claude API)                                │   │
│  │  - Financial News Sources (HTML Scraping)                │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔧 MÓDULOS BACKEND

### 1. **NewsAdapter** (`src/modules/news/newsAdapter.ts`)

**Propósito**: Conecta con Alpaca News API para obtener noticias de instrumentos financieros.

**Responsabilidades**:
- Normalizar artículos de noticias de Alpaca
- Filtrar por símbolo
- Manejar paginación y límites

**Interfaz**:

```typescript
export interface AlpacaNewsArticle {
  id: number;
  headline: string;
  summary: string;
  author: string;
  created_at: string;
  updated_at: string;
  url: string;
  symbols: string[];
  source: string;
}

export class NewsAdapter {
  constructor(apiKey: string, apiSecret: string);
  async getRecentNews(symbol: string, limit?: number): Promise<AlpacaNewsArticle[]>;
}
```

**Detalles Técnicos**:
- Endpoint: `https://data.alpaca.markets/v1beta1/news`
- Headers: `APCA-API-KEY-ID`, `APCA-API-SECRET-KEY`
- Parámetros: `symbols`, `limit`, `sort`
- Manejo de errores: Lanza errores si HTTP !== 2xx

---

### 2. **SentimentService** (`src/modules/news/sentimentService.ts`)

**Propósito**: Analiza el sentimiento de noticias usando Claude Anthropic.

**Responsabilidades**:
- Procesar artículos de noticias
- Llamar a Claude para análisis de sentimiento
- Traducir respuesta a puntuación de inversión

**Interfaz**:

```typescript
export interface SentimentResult {
  score: number;          // -1.0 (muy negativo) a +1.0 (muy positivo)
  label: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;     // 0.0 a 1.0
  reasoning: string;
  keyFactors: string[];
}

export class SentimentService {
  async analyzeNewsSentiment(symbol: string, articles: AlpacaNewsArticle[]): Promise<SentimentResult>;
}
```

**Flujo de Claude**:
1. **Preparación**: Resume máximo 10 artículos
2. **Prompt**: Envía noticias a Claude Opus 4.5 con instrucción JSON
3. **Parsing**: Extrae JSON limpiando markdown
4. **Validación**: Retorna `SentimentResult` tipificado

**Criterios de Análisis**:
- `score > 0.3` → BULLISH (Positivo)
- `score < -0.3` → BEARISH (Negativo)  
- `-0.3 a 0.3` → NEUTRAL (Mixto)
- `confidence` mide la claridad de la señal

---

### 3. **InvestmentAdvisor** (`src/modules/news/investmentAdvisor.ts`)

**Propósito**: Orquestador principal que coordina análisis de noticias y genera veredicto de inversión.

**Responsabilidades**:
- Orquestar llamadas a NewsAdapter y SentimentService
- Traducir sentimiento a veredicto accionable
- Compilar respuesta final

**Interfaz**:

```typescript
export interface InvestmentVerdict {
  symbol: string;
  verdict: 'BUY' | 'SELL' | 'HOLD';
  sentiment: SentimentResult;
  newsCount: number;
  generatedAt: string;
}

export class InvestmentAdvisor {
  constructor(alpacaApiKey: string, alpacaApiSecret: string);
  async evaluate(symbol: string): Promise<InvestmentVerdict>;
}
```

**Lógica de Veredicto**:
```typescript
if (confidence < 0.4) return 'HOLD';  // Baja confianza → esperar
if (score > 0.3) return 'BUY';         // Score positivo → compra
if (score < -0.3) return 'SELL';       // Score negativo → venta
return 'HOLD';                         // Neutral → mantener
```

**Flujo de Ejecución**:
1. Obtiene noticias recientes del símbolo (máximo 10)
2. Analiza sentimiento agregado
3. Resuelve veredicto según score y confianza
4. Retorna objeto `InvestmentVerdict` completo

---

### 4. **URLAnalysisService** (`src/modules/news/urlAnalysisService.ts`)

**Propósito**: Analiza fuentes de noticias personalizadas (URLs) para estudiar impacto en instrumentos específicos.

**Responsabilidades**:
- Obtener contenido de URLs financieras
- Extraer texto relevante
- Analizar impacto con Claude
- Retornar veredicto y score

**Interfaz**:

```typescript
export interface URLContent {
  url: string;
  title: string;
  content: string;
  source: string;
  fetchedAt: string;
}

export interface SourceAnalysisResult {
  url: string;
  company: string;
  verdict: 'BUY' | 'SELL' | 'HOLD';
  score: number;
  confidence: number;
  reasoning: string;
  keyPoints: string[];
  warnings?: string[];
  timestamp: string;
}

export class URLAnalysisService {
  async fetchURLContent(url: string, company: string): Promise<URLContent>;
  async analyzeSourceImpact(urlContent: URLContent, company: string): Promise<SourceAnalysisResult>;
}
```

**Características Especiales**:
- **Fallback de URLs**: Intenta múltiples caminos si la URL principal falla
- **Extractión Inteligente**: Detecta contenido relevante en HTML
- **User-Agent**: Simula navegador real para evitar bloqueos
- **Timeout**: Máximo 15s por fetch
- **Límite de Contenido**: Máximo 5000 caracteres procesables

**Detección de Fuentes**:
- NASDAQ, Reuters, Yahoo Finance, Investing.com, CNBC
- Rutas específicas por dominio (e.g., `/quote/{ticker}/news`)
- Búsqueda genérica como fallback

---

## 🛣️ RUTAS API

### Route: `/news/sentiment`

**Endpoint**: `GET /news/sentiment/:symbol`

**Descripción**: Obtiene análisis de sentimiento consolidado de noticias sobre un símbolo.

**Parámetros**:
- `symbol` (path): Ticker del instrumento (e.g., `AAPL`, `TSLA`)

**Respuesta (200 OK)**:
```json
{
  "symbol": "AAPL",
  "verdict": "BUY",
  "sentiment": {
    "score": 0.65,
    "label": "BULLISH",
    "confidence": 0.85,
    "reasoning": "Las últimas noticias sobre ganancias de Apple superaron expectativas, lo que sugiere un outlook positivo.",
    "keyFactors": ["Earnings beat", "Strong iPhone sales", "Services growth"]
  },
  "newsCount": 8,
  "generatedAt": "2026-05-29T14:32:10.123Z"
}
```

**Respuesta (400 Bad Request)**:
```json
{ "error": "Símbolo inválido." }
```

**Respuesta (500 Server Error)**:
```json
{ "error": "Error al evaluar el sentimiento." }
```

**Registro en `index.ts`**:
```typescript
import newsSentimentRouter from "./routes/news/sentiment";
app.use('/news/sentiment', newsSentimentRouter);
```

---

## 🎨 COMPONENTES FRONTEND

### Component: `NewsSourcesAnalyzer` 

**Localización**: `src/features/news/NewsSourcesAnalyzer.tsx`

**Propósito**: Interfaz de usuario para agregar fuentes de noticias personalizadas y analizar su impacto en instrumentos.

**Estado**:
```typescript
interface NewsSource {
  id: string;
  url: string;
  status: 'pending' | 'valid' | 'invalid' | 'analyzed';
  addedAt: string;
}

interface AnalysisState {
  loading: boolean;
  error: string | null;
  result: AnalysisResultData | null;
}

interface AnalysisResultData {
  company: string;
  verdict: 'BUY' | 'SELL' | 'HOLD';
  score: number;
  confidence: number;
  reasoning: string;
  keyPoints: string[];
  timestamp: string;
}
```

**Funcionalidades**:
1. **Agregar Fuentes**: Input para URLs de noticias
2. **Validar Duplicados**: No permite URLs repetidas
3. **Listar Fuentes**: Tabla con estado de cada fuente
4. **Analizar**: Botón para ejecutar análisis consolidado
5. **Mostrar Resultado**: Tarjeta con veredicto y detalles

**Fuentes Predeterminadas**:
```typescript
const DEFAULT_SOURCES: NewsSource[] = [
  { id: 'default-nasdaq', url: 'nasdaq.com', status: 'valid', addedAt: '...' },
  { id: 'default-investing', url: 'investing.com', status: 'valid', addedAt: '...' },
];
```

**Handlers Principales**:
- `handleAddSource(url)`: Valida duplicados, agrega a lista, valida con backend
- `handleAnalyze()`: Ejecuta análisis consolidado de todas las fuentes
- `handleRemoveSource(id)`: Elimina fuente de la lista
- `toggleExpanded()`: Expande/contrae panel

---

## 📊 DASHBOARD & CRUD

### Dashboard Overview (`src/features/news/NewsDashboard.tsx`)

**Propósito**: Panel centralizado para visualizar, gestionar y analizar noticias e inversiones.

**Secciones Principales**:

```typescript
interface DashboardView {
  analysisHistory: AnalysisRecord[];
  favoriteCompanies: CompanyFavorite[];
  recentRecommendations: InvestmentRecommendation[];
  topSentiments: SentimentTrend[];
  pendingReports: PDFReport[];
}

interface AnalysisRecord {
  id: string;
  symbol: string;
  verdict: 'BUY' | 'SELL' | 'HOLD';
  score: number;
  analyzedAt: string;
  newsCount: number;
  sources: string[];
}

interface CompanyFavorite {
  id: string;
  symbol: string;
  companyName: string;
  sector: string;
  lastUpdated: string;
  currentScore: number;
}

interface InvestmentRecommendation {
  id: string;
  symbol: string;
  recommendationType: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  investmentPercentage: number;  // % del portafolio
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reasoning: string;
  generatedAt: string;
}

interface SentimentTrend {
  symbol: string;
  sentimentHistory: Array<{ date: string; score: number }>;
  trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
}
```

**Componentes del Dashboard**:

1. **Tarjeta de Análisis Rápido** (`QuickAnalysis.tsx`)
   - Input para símbolo
   - Botón "Analizar Ahora"
   - Card con resultado en tiempo real

2. **Historial de Análisis** (`AnalysisHistory.tsx`)
   - Tabla filtrable por símbolo, fecha, veredicto
   - Columnas: Símbolo, Veredicto, Score, Confianza, Fecha
   - Acciones: Ver detalles, Descargar PDF, Compartir

3. **Mis Compañías Favoritas** (`FavoriteCompanies.tsx`)
   - Lista con drag-drop para ordenar
   - Botones: Agregar, Eliminar, Editar
   - CRUD completo

4. **Recomendaciones de Inversión** (`InvestmentRecommendations.tsx`)
   - Cards con recomendación, porcentaje sugerido, riesgo
   - Gráfico de distribución de portafolio
   - Botón "Actualizar Recomendaciones"

5. **Tendencias de Sentimiento** (`SentimentTrends.tsx`)
   - Gráficos de línea por símbolo
   - Comparativa multi-símbolo
   - Exportar datos

---

### CRUD de Fuentes de Noticias

**Rutas CRUD Backend**:

```typescript
// GET /api/news/sources - Listar todas las fuentes
GET /api/news/sources
Response: { sources: NewsSource[], total: number }

// GET /api/news/sources/:id - Obtener una fuente
GET /api/news/sources/:id
Response: NewsSource

// POST /api/news/sources - Crear nueva fuente
POST /api/news/sources
Body: { url: string, name: string, category: string, isActive: boolean }
Response: { id: string, ...newsSource }

// PUT /api/news/sources/:id - Actualizar fuente
PUT /api/news/sources/:id
Body: { url?: string, name?: string, isActive?: boolean }
Response: NewsSource (actualizado)

// DELETE /api/news/sources/:id - Eliminar fuente
DELETE /api/news/sources/:id
Response: { success: true }

// POST /api/news/sources/:id/test - Testear conexión a fuente
POST /api/news/sources/:id/test
Response: { isAccessible: boolean, statusCode: number, errorMessage?: string }
```

**Entidad NewsSource**:

```typescript
interface NewsSource {
  id: string;
  url: string;
  name: string;
  category: 'OFFICIAL' | 'CUSTOM';
  sector?: string;  // Para fuentes sectoriales (e.g., "Technology")
  isActive: boolean;
  lastChecked: string;
  isAccessible: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    description: string;
    language: string;
    updateFrequency: 'DAILY' | 'WEEKLY' | 'REALTIME';
  };
}
```

**Servicio de Fuentes** (`src/modules/news/newsSourceService.ts`):

```typescript
export class NewsSourceService {
  // Listar todas
  async listSources(filters?: { category?: string; isActive?: boolean }): Promise<NewsSource[]>;
  
  // Obtener una
  async getSource(id: string): Promise<NewsSource>;
  
  // Crear
  async createSource(data: CreateSourceDTO): Promise<NewsSource>;
  
  // Actualizar
  async updateSource(id: string, data: UpdateSourceDTO): Promise<NewsSource>;
  
  // Eliminar
  async deleteSource(id: string): Promise<void>;
  
  // Testear conexión
  async testSourceConnection(id: string): Promise<{ accessible: boolean; status: number }>;
  
  // Obtener todas activas
  async getActiveSources(): Promise<NewsSource[]>;
  
  // Obtener por categoría
  async getSourcesByCategory(category: string): Promise<NewsSource[]>;
}
```

---

## 🏢 FUENTES PREDEFINIDAS

**10+ Fuentes Financieras Oficiales Incluidas**:

```typescript
const PREDEFINED_NEWS_SOURCES: NewsSource[] = [
  {
    id: 'source-001',
    url: 'nasdaq.com',
    name: 'NASDAQ Official',
    category: 'OFFICIAL',
    sector: 'Multi-sector',
    isActive: true,
    metadata: {
      description: 'Cotizaciones, noticias y análisis de mercado de NASDAQ',
      language: 'EN/ES',
      updateFrequency: 'REALTIME'
    }
  },
  {
    id: 'source-002',
    url: 'finance.yahoo.com',
    name: 'Yahoo Finance',
    category: 'OFFICIAL',
    sector: 'Multi-sector',
    isActive: true,
    metadata: {
      description: 'Datos de mercado, noticias financieras y análisis',
      language: 'EN',
      updateFrequency: 'REALTIME'
    }
  },
  {
    id: 'source-003',
    url: 'investing.com',
    name: 'Investing.com',
    category: 'OFFICIAL',
    sector: 'Multi-sector',
    isActive: true,
    metadata: {
      description: 'Mercados, análisis técnico y noticias financieras',
      language: 'EN/ES',
      updateFrequency: 'REALTIME'
    }
  },
  {
    id: 'source-004',
    url: 'cnbc.com',
    name: 'CNBC',
    category: 'OFFICIAL',
    sector: 'Multi-sector',
    isActive: true,
    metadata: {
      description: 'Noticias de negocios, mercados y finanzas',
      language: 'EN',
      updateFrequency: 'DAILY'
    }
  },
  {
    id: 'source-005',
    url: 'reuters.com',
    name: 'Reuters',
    category: 'OFFICIAL',
    sector: 'Multi-sector',
    isActive: true,
    metadata: {
      description: 'Agencia de noticias internacional - Mercados y finanzas',
      language: 'EN/ES',
      updateFrequency: 'REALTIME'
    }
  },
  {
    id: 'source-006',
    url: 'bloomberg.com',
    name: 'Bloomberg',
    category: 'OFFICIAL',
    sector: 'Multi-sector',
    isActive: true,
    metadata: {
      description: 'Noticias de negocios, mercados y tecnología',
      language: 'EN',
      updateFrequency: 'REALTIME'
    }
  },
  {
    id: 'source-007',
    url: 'sec.gov/cgi-bin/browse-edgar',
    name: 'SEC EDGAR',
    category: 'OFFICIAL',
    sector: 'Regulatory',
    isActive: true,
    metadata: {
      description: 'Registros de empresas públicas - Documentos oficiales',
      language: 'EN',
      updateFrequency: 'DAILY'
    }
  },
  {
    id: 'source-008',
    url: 'seekingalpha.com',
    name: 'Seeking Alpha',
    category: 'OFFICIAL',
    sector: 'Analysis',
    isActive: true,
    metadata: {
      description: 'Análisis de inversiones, ideas y alertas de mercado',
      language: 'EN',
      updateFrequency: 'DAILY'
    }
  },
  {
    id: 'source-009',
    url: 'marketwatch.com',
    name: 'MarketWatch',
    category: 'OFFICIAL',
    sector: 'Multi-sector',
    isActive: true,
    metadata: {
      description: 'Noticias de mercado, análisis y opiniones de expertos',
      language: 'EN',
      updateFrequency: 'REALTIME'
    }
  },
  {
    id: 'source-010',
    url: 'thestreet.com',
    name: 'TheStreet',
    category: 'OFFICIAL',
    sector: 'Analysis',
    isActive: true,
    metadata: {
      description: 'Noticias de mercado, estrategias de inversión',
      language: 'EN',
      updateFrequency: 'DAILY'
    }
  },
  {
    id: 'source-011',
    url: 'stockanalysis.com',
    name: 'Stock Analysis',
    category: 'OFFICIAL',
    sector: 'Analysis',
    isActive: true,
    metadata: {
      description: 'Análisis fundamental, ratios y datos de empresas',
      language: 'EN',
      updateFrequency: 'DAILY'
    }
  }
];
```

**Inicialización en Base de Datos**:

```typescript
// Script: src/scripts/initializePredefinedSources.ts
export async function seedPredefinedSources(supabaseClient: SupabaseClient) {
  for (const source of PREDEFINED_NEWS_SOURCES) {
    const { data, error } = await supabaseClient
      .from('news_sources')
      .insert(source)
      .select();
    
    if (error) console.error(`Error inserting ${source.name}:`, error);
    else console.log(`✓ ${source.name} initialized`);
  }
}
```

---

## 📄 GENERACIÓN DE PDF

### Servicio de PDF (`src/modules/news/pdfGeneratorService.ts`)

**Propósito**: Generar reportes en PDF con análisis de noticias e inversiones.

**Interfaz**:

```typescript
export interface PDFReportData {
  title: string;
  symbol: string;
  company: string;
  analysisSummary: SentimentResult;
  investmentRecommendation: InvestmentRecommendation;
  newsArticles: Array<{
    headline: string;
    summary: string;
    source: string;
    date: string;
  }>;
  keyInsights: string[];
  riskAssessment: {
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    factors: string[];
  };
  generatedAt: string;
  generatedBy: string;
}

export class PDFGeneratorService {
  async generateAnalysisReport(data: PDFReportData): Promise<Buffer>;
  async generatePortfolioReport(recommendations: InvestmentRecommendation[]): Promise<Buffer>;
  async generateTrendReport(symbols: string[], dateRange: { from: string; to: string }): Promise<Buffer>;
}
```

**Estructura del PDF - Análisis Completo**:

```
┌─────────────────────────────────────────┐
│  REPORTE DE INVERSIÓN - ANÁLISIS NOTICIAS  │
│  Apple Inc. (AAPL)                       │
│  Generado: 29-05-2026 14:32               │
└─────────────────────────────────────────┘

┌─ PORTADA ────────────────────────────────┐
│ Logo                                     │
│ Título: Análisis de Inversión            │
│ Símbolo: AAPL                            │
│ Fecha Generación                         │
└──────────────────────────────────────────┘

┌─ TABLA DE CONTENIDOS ────────────────────┐
│ 1. Resumen Ejecutivo                     │
│ 2. Análisis de Sentimiento               │
│ 3. Recomendación de Inversión            │
│ 4. Noticias Recientes                    │
│ 5. Análisis de Riesgo                    │
│ 6. Conclusiones                          │
└──────────────────────────────────────────┘

PÁGINA 1: RESUMEN EJECUTIVO
├─ Símbolo: AAPL
├─ Nombre: Apple Inc.
├─ Veredicto: BUY ✓
├─ Score de Sentimiento: 0.75 (BULLISH)
├─ Confianza: 87%
├─ Inversión Recomendada: 15% del portafolio
└─ Riesgo: MEDIUM

PÁGINA 2-3: ANÁLISIS DETALLADO DE SENTIMIENTO
├─ Gráfico de Score de Sentimiento
├─ Factores Clave: Earnings Beat, Strong iPhone Sales
├─ Análisis por Fuente:
│  - Reuters: BULLISH (0.8)
│  - Bloomberg: BULLISH (0.7)
│  - CNBC: NEUTRAL (0.2)
└─ Conclusión: Tendencia positiva clara

PÁGINA 4-5: RECOMENDACIÓN DE INVERSIÓN
├─ Estrategia Sugerida: Long Position
├─ Entrada Sugerida: $XXX - $XXX
├─ Take Profit Target: $XXX (X% upside)
├─ Stop Loss: $XXX (X% downside)
├─ Ratio Riesgo/Beneficio: 1:2.5
├─ Tiempo de Inversión: 6-12 meses
└─ Fundamento: Crecimiento de servicios, posición de mercado

PÁGINA 6-7: NOTICIAS RECIENTES
├─ [Artículo 1]
│  ├─ Headline: "Apple Q3 Earnings Beat..."
│  ├─ Fecha: 25-05-2026
│  ├─ Fuente: Reuters
│  └─ Impacto: POSITIVE
├─ [Artículo 2]
│  └─ ...
└─ [Artículo 3]

PÁGINA 8: ANÁLISIS DE RIESGO
├─ Riesgo General: MEDIUM
├─ Factores de Riesgo:
│  ├─ Competencia: Apple enfrenta competencia de Samsung y otros
│  ├─ Regulación: Posibles regulaciones en privacidad
│  └─ Macro: Posible recesión económica
├─ Volatilidad Esperada: 15-20% anual
└─ Mitigation Strategies: Diversificar portafolio

PÁGINA 9: CONCLUSIÓN
├─ Recomendación Final: STRONG BUY
├─ Justificación: Sentimiento positivo + fundamentales sólidos
├─ Monitoreo Recomendado: Revisión semanal
└─ Próxima Actualización: 05-06-2026

PÁGINA 10: DISCLAIMERS & NOTAS
├─ Este reporte es solo informativo
├─ No constituye asesoría financiera
├─ Resultados pasados no garantizan futuros
├─ Asuma su propio riesgo de inversión
└─ Generado por: Sistema de Análisis IA Inversiones
```

**Ruta de API para Generar PDF**:

```typescript
// POST /api/news/reports/generate
POST /api/news/reports/generate
Body: {
  type: 'ANALYSIS' | 'PORTFOLIO' | 'TREND',
  symbols?: string[],
  dateRange?: { from: string; to: string }
}
Response: PDF (application/pdf)

// GET /api/news/reports/:reportId
GET /api/news/reports/:reportId
Response: PDF file download
```

---

## 🎯 SISTEMA DE RECOMENDACIÓN

### Investment Recommendation Service

**Propósito**: Calcular recomendación de inversión basada en múltiples factores.

**Lógica de Scoring**:

```typescript
export interface InvestmentScore {
  sentimentScore: number;        // -1 a 1
  fundamentalScore: number;      // -1 a 1 (si disponible)
  technicalScore: number;        // -1 a 1 (si disponible)
  riskScore: number;             // 0 a 1 (0=low risk, 1=high risk)
  compositeScore: number;        // Score final ponderado
}

export class InvestmentRecommendationService {
  calculateCompositeScore(factors: InvestmentScore): number {
    // Ponderación:
    // - Sentiment: 50%
    // - Fundamental: 30% (si disponible)
    // - Technical: 20% (si disponible)
    
    const sentimentWeight = 0.50;
    const fundamentalWeight = 0.30;
    const technicalWeight = 0.20;
    
    let compositeScore = factors.sentimentScore * sentimentWeight;
    
    if (factors.fundamentalScore !== null) {
      compositeScore += factors.fundamentalScore * fundamentalWeight;
    }
    if (factors.technicalScore !== null) {
      compositeScore += factors.technicalScore * technicalWeight;
    }
    
    return compositeScore;
  }

  generateRecommendation(score: InvestmentScore): {
    verdict: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    investmentPercentage: number;  // % del portafolio
    confidence: number;             // 0 a 1
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  } {
    const composite = this.calculateCompositeScore(score);
    
    if (composite > 0.6) {
      return {
        verdict: 'STRONG_BUY',
        investmentPercentage: 15,
        confidence: 0.9,
        riskLevel: score.riskScore < 0.3 ? 'LOW' : 'MEDIUM'
      };
    } else if (composite > 0.3) {
      return {
        verdict: 'BUY',
        investmentPercentage: 10,
        confidence: 0.75,
        riskLevel: 'MEDIUM'
      };
    } else if (composite > -0.3) {
      return {
        verdict: 'HOLD',
        investmentPercentage: 5,
        confidence: 0.6,
        riskLevel: 'MEDIUM'
      };
    } else if (composite > -0.6) {
      return {
        verdict: 'SELL',
        investmentPercentage: 0,
        confidence: 0.75,
        riskLevel: 'HIGH'
      };
    } else {
      return {
        verdict: 'STRONG_SELL',
        investmentPercentage: 0,
        confidence: 0.9,
        riskLevel: 'HIGH'
      };
    }
  }

  assessInvestmentConvenience(
    symbol: string,
    recommendation: InvestmentRecommendation,
    portfolioContext?: PortfolioStats
  ): InvestmentConvenience {
    return {
      shouldInvest: recommendation.verdict !== 'SELL' && recommendation.verdict !== 'STRONG_SELL',
      suggestedAllocation: recommendation.investmentPercentage,
      riskAdjustedReturn: this.calculateRiskAdjustedReturn(recommendation),
      timeHorizon: '6-12 months',
      diversificationBenefit: this.assessDiversification(symbol, portfolioContext)
    };
  }
}
```

**Ruta para Obtener Recomendación**:

```typescript
// GET /api/news/recommendations/:symbol
GET /api/news/recommendations/AAPL
Response: {
  symbol: "AAPL",
  verdict: "BUY",
  recommendationType: "BUY",
  confidence: 0.87,
  investmentPercentage: 10,
  riskLevel: "MEDIUM",
  reasoning: "Positive sentiment from earnings beat, strong iPhone sales momentum",
  convenience: {
    shouldInvest: true,
    suggestedAllocation: 10,
    riskAdjustedReturn: 0.45,
    timeHorizon: "6-12 months",
    diversificationBenefit: "HIGH"
  },
  generatedAt: "2026-05-29T14:32:10.123Z"
}
```

**Página Web de Recomendación** (`src/features/news/InvestmentConvenience.tsx`):

```typescript
interface InvestmentConveniencePage {
  // Section 1: Quick Analysis
  quickAnalysisCard: {
    symbol: string;
    recommendation: string;
    shouldInvest: boolean;
    convenience_percentage: number;  // 0-100%
  };
  
  // Section 2: Allocation Suggestion
  allocationCard: {
    suggestedPercentage: number;
    riskLevel: string;
    rationale: string[];
  };
  
  // Section 3: Risk Assessment
  riskCard: {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    factors: string[];
    mitigation: string[];
  };
  
  // Section 4: Timeline
  timelineCard: {
    recommendedHoldTime: string;
    targetEntry: string;
    targetExit: string;
  };
  
  // Section 5: Comparison
  comparisonCard: {
    vs_market_average: number;
    vs_sector_average: number;
    vs_historical: number;
  };
  
  // Section 6: Actions
  actions: {
    downloadReport: () => void;
    addToWatchlist: () => void;
    shareAnalysis: () => void;
    setAlert: () => void;
  };
}
```

---

## 📊 FLUJOS DE DATOS

### Flujo 1: Análisis por Símbolo (Alpaca News)

```
┌────────────────────────────────┐
│  Usuario Ingresa: AAPL         │
└────────────┬───────────────────┘
             │
             ▼
┌────────────────────────────────┐
│  GET /news/sentiment/AAPL      │
└────────────┬───────────────────┘
             │
             ▼
┌────────────────────────────────┐
│  InvestmentAdvisor.evaluate()  │
└────────────┬───────────────────┘
             │
             ├──────────────────────────────────┐
             │                                  │
             ▼                                  ▼
   ┌────────────────────────┐    ┌──────────────────────────┐
   │ NewsAdapter            │    │ API Alpaca News          │
   │ .getRecentNews()       │───▶│ (máx 10 noticias)        │
   └────────────────────────┘    └──────────────────────────┘
             │
             ▼
   ┌────────────────────────┐
   │ SentimentService       │
   │ .analyzeNewsSentiment()│
   └────────────┬───────────┘
                │
                ▼
   ┌────────────────────────┐
   │ Claude Anthropic       │
   │ (Analiza sentimiento)  │
   │ Retorna: score,label   │
   │ confidence, reasoning  │
   └────────────┬───────────┘
                │
                ▼
   ┌────────────────────────┐
   │ resolveVerdict()       │
   │ BUY/SELL/HOLD          │
   └────────────┬───────────┘
                │
                ▼
   ┌──────────────────────────────┐
   │ InvestmentVerdict JSON       │
   │ {symbol, verdict, sentiment} │
   └──────────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Response 200 a Frontend      │
   └──────────────────────────────┘
```

### Flujo 2: Análisis de Fuentes Personalizadas

```
┌────────────────────────────────────────┐
│  Usuario: Agrega URL + Selecciona TSLA │
└────────────┬──────────────────────────┘
             │
             ▼
┌────────────────────────────────────────┐
│  handleAnalyze() - Frontend            │
└────────────┬──────────────────────────┘
             │
             ▼
┌────────────────────────────────────────┐
│  URLAnalysisService.fetchURLContent()  │
│  para cada URL en sources[]            │
└────────────┬──────────────────────────┘
             │
        ┌────┴────┬────┬────┐
        │          │    │    │
        ▼          ▼    ▼    ▼
   [Intentos de URLs alternativas]
        │
        ▼
   ┌─────────────────────────────────────┐
   │ Extrae HTML relevante               │
   │ Limpia etiquetas, normaliza texto   │
   │ (máx 5000 caracteres)               │
   └────────────┬────────────────────────┘
                │
                ▼
   ┌─────────────────────────────────────┐
   │ Claude: Analiza contenido           │
   │ en contexto de TSLA                 │
   │ Retorna: score, verdict, keyPoints  │
   └────────────┬────────────────────────┘
                │
                ▼
   ┌─────────────────────────────────────┐
   │ SourceAnalysisResult[]              │
   │ [consolidado de múltiples fuentes]  │
   └────────────┬────────────────────────┘
                │
                ▼
   ┌─────────────────────────────────────┐
   │ Frontend: Renderiza AnalysisResult  │
   │ con tabla de keyPoints              │
   └─────────────────────────────────────┘
```

---

## 📦 ENTIDADES DE BASE DE DATOS

> **Nota**: Usar Supabase para almacenamiento persistente de análisis, fuentes y recomendaciones.

**Schema Supabase Completo**:

```sql
-- Tabla: news_sources
CREATE TABLE news_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('OFFICIAL', 'CUSTOM')),
  sector TEXT,
  is_active BOOLEAN DEFAULT true,
  last_checked TIMESTAMP,
  is_accessible BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  INDEX(category),
  INDEX(is_active)
);

-- Tabla: news_articles
CREATE TABLE news_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  headline TEXT NOT NULL,
  summary TEXT,
  author TEXT,
  source TEXT NOT NULL,
  url TEXT UNIQUE,
  symbols TEXT[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  processed_at TIMESTAMP,
  raw_json JSONB,
  INDEX(symbols),
  INDEX(created_at)
);

-- Tabla: sentiment_analysis
CREATE TABLE sentiment_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR(10) NOT NULL,
  score DECIMAL NOT NULL CHECK (score >= -1.0 AND score <= 1.0),
  label TEXT NOT NULL CHECK (label IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
  confidence DECIMAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  reasoning TEXT,
  key_factors TEXT[] NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('BUY', 'SELL', 'HOLD')),
  news_count INTEGER,
  sources_analyzed TEXT[],
  analyzed_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (symbol) REFERENCES instruments(ticker),
  INDEX(symbol),
  INDEX(analyzed_at)
);

-- Tabla: investment_recommendations
CREATE TABLE investment_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR(10) NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL')),
  confidence DECIMAL NOT NULL,
  investment_percentage DECIMAL NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  reasoning TEXT NOT NULL,
  sentiment_score DECIMAL,
  fundamental_score DECIMAL,
  technical_score DECIMAL,
  risk_score DECIMAL,
  composite_score DECIMAL,
  generated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (symbol) REFERENCES instruments(ticker),
  INDEX(symbol),
  INDEX(generated_at)
);

-- Tabla: analysis_records
CREATE TABLE analysis_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR(10) NOT NULL,
  verdict TEXT NOT NULL,
  score DECIMAL,
  analyzed_at TIMESTAMP,
  news_count INTEGER,
  sources JSONB,
  user_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (symbol) REFERENCES instruments(ticker),
  INDEX(symbol),
  INDEX(created_at)
);

-- Tabla: favorite_companies
CREATE TABLE favorite_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  company_name TEXT,
  sector TEXT,
  last_updated TIMESTAMP,
  current_score DECIMAL,
  alerts_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  UNIQUE(user_id, symbol),
  FOREIGN KEY (symbol) REFERENCES instruments(ticker),
  INDEX(user_id),
  INDEX(symbol)
);

-- Tabla: pdf_reports
CREATE TABLE pdf_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  symbol VARCHAR(10),
  report_type TEXT NOT NULL CHECK (report_type IN ('ANALYSIS', 'PORTFOLIO', 'TREND')),
  title TEXT NOT NULL,
  file_url TEXT,
  file_size INTEGER,
  symbols_included TEXT[],
  generated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  is_downloadable BOOLEAN DEFAULT true,
  INDEX(user_id),
  INDEX(generated_at),
  INDEX(report_type)
);

-- Tabla: sentiment_trends
CREATE TABLE sentiment_trends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  score DECIMAL,
  trend TEXT CHECK (trend IN ('IMPROVING', 'DECLINING', 'STABLE')),
  UNIQUE(symbol, date),
  FOREIGN KEY (symbol) REFERENCES instruments(ticker),
  INDEX(symbol),
  INDEX(date)
);

-- Tabla: convenience_insights
CREATE TABLE convenience_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR(10) NOT NULL,
  convenience_percentage DECIMAL,  -- 0-100%
  should_invest BOOLEAN,
  risk_adjusted_return DECIMAL,
  time_horizon TEXT,
  diversification_benefit TEXT,
  calculated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (symbol) REFERENCES instruments(ticker),
  INDEX(symbol),
  INDEX(calculated_at)
);
```

---

## 🔌 INTEGRACIONES EXTERNAS

### 1. **Alpaca News API**

**Base URL**: `https://data.alpaca.markets/v1beta1/news`

**Autenticación**:
- `APCA-API-KEY-ID`: `process.env.ALPACA_API_KEY`
- `APCA-API-SECRET-KEY`: `process.env.ALPACA_API_SECRET`

**Parámetros**:
```
GET /news?symbols=AAPL&limit=10&sort=desc
```

**Respuesta Ejemplo**:
```json
{
  "news": [
    {
      "id": 123456,
      "headline": "Apple Q3 Earnings Beat Expectations",
      "summary": "Apple reported Q3 earnings...",
      "author": "Reuters",
      "created_at": "2026-05-29T10:00:00Z",
      "updated_at": "2026-05-29T10:05:00Z",
      "url": "https://...",
      "symbols": ["AAPL"],
      "source": "Reuters"
    }
  ]
}
```

---

### 2. **Anthropic Claude API**

**Endpoint**: `https://api.anthropic.com/v1/messages`

**Autenticación**: Header `Authorization: Bearer ${process.env.ANTHROPIC_API_KEY}`

**Modelo**: `claude-opus-4-5`

**Parámetros**:
- `max_tokens`: 512 (para SentimentService), Variable (para URLAnalysisService)
- `messages`: Array con instrucción JSON

**Prompt para Sentimiento**:
```
Eres un analista financiero experto. Analiza las siguientes noticias recientes sobre [SYMBOL] 
y determina el sentimiento de inversión.

[Resumen de 10 artículos máximo]

Responde ÚNICAMENTE con JSON:
{
  "score": <-1.0 a 1.0>,
  "label": "BULLISH|BEARISH|NEUTRAL",
  "confidence": <0.0 a 1.0>,
  "reasoning": "<2-3 oraciones>",
  "keyFactors": ["factor1", "factor2", "factor3"]
}
```

---

## 🚀 INSTRUCCIONES DE IMPLEMENTACIÓN

### Paso 1: Configurar Variables de Entorno

```env
# Backend .env
ALPACA_API_KEY=PKxxxxxx
ALPACA_API_SECRET=xxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# (Opcional) Para logging de noticias
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxx
```

### Paso 2: Crear Estructura de Carpetas Backend

```
src/
  modules/
    news/
      newsAdapter.ts              ← Interfaz Alpaca
      sentimentService.ts         ← Análisis Claude
      investmentAdvisor.ts        ← Orquestador
      urlAnalysisService.ts       ← Análisis de URLs
  routes/
    news/
      sentiment.ts                ← Ruta GET /news/sentiment/:symbol
      index.ts                    ← Exporta router
```

### Paso 3: Implementar Módulos en Este Orden

**3.1 NewsAdapter**
```typescript
// Define clase, constructor con credenciales
// Implementa getRecentNews() que llama a Alpaca
// Maneja errores HTTP
```

**3.2 SentimentService**
```typescript
// Inicializa cliente Anthropic
// Prepara digest de artículos
// Envía prompt a Claude
// Parsea JSON response
```

**3.3 InvestmentAdvisor**
```typescript
// Inyecta NewsAdapter y SentimentService
// Implementa evaluate(symbol)
// Resuelve veredicto según score/confidence
```

**3.4 URLAnalysisService**
```typescript
// Implementa fetchURLContent() con fallbacks
// Implementa extractRelevantContent() para HTML
// Implementa analyzeSourceImpact() con Claude
```

### Paso 4: Crear Rutas

**sentiment.ts**:
```typescript
import { Router } from 'express';
import { InvestmentAdvisor } from '../../modules/news/investmentAdvisor';

const router = Router();

router.get('/:symbol', async (req, res) => {
  const { symbol } = req.params;
  if (!symbol || symbol.length > 10) {
    return res.status(400).json({ error: 'Símbolo inválido.' });
  }
  try {
    const advisor = new InvestmentAdvisor(
      process.env.ALPACA_API_KEY!,
      process.env.ALPACA_API_SECRET!
    );
    const verdict = await advisor.evaluate(symbol.toUpperCase());
    return res.json(verdict);
  } catch (err) {
    console.error('[NewsSentiment] Error:', err);
    return res.status(500).json({ error: 'Error al evaluar el sentimiento.' });
  }
});

export default router;
```

### Paso 5: Registrar Rutas en `index.ts`

```typescript
import newsSentimentRouter from "./routes/news/sentiment";

app.use('/news/sentiment', newsSentimentRouter);
```

### Paso 6: Crear Componente Frontend

```typescript
// src/features/news/NewsSourcesAnalyzer.tsx
// Componentes:
//   - SourceInput: Input para agregar URLs
//   - SourceList: Tabla de fuentes
//   - AnalysisResult: Card con resultado

// Estados:
//   - sources: NewsSource[]
//   - selectedCompany: string
//   - analysis: AnalysisState

// Handlers:
//   - handleAddSource()
//   - handleAnalyze()
//   - handleRemoveSource()
```

### Paso 7: Testeo Manual

```bash
# Test 1: Sentimiento por Símbolo
curl -X GET "http://localhost:3000/news/sentiment/AAPL"

# Expected Response:
{
  "symbol": "AAPL",
  "verdict": "BUY|SELL|HOLD",
  "sentiment": { "score": 0.x, "label": "...", ... },
  "newsCount": 8,
  "generatedAt": "2026-05-29T..."
}

# Test 2: Desde Frontend (Postman o Browser)
# 1. Abre NewsSourcesAnalyzer
# 2. Agrega URL: nasdaq.com
# 3. Selecciona Compañía: Apple
# 4. Haz clic en "Analizar"
# 5. Espera respuesta con veredicto
```

---

## 📝 CHECKLISTTA DE VALIDACIÓN

- [ ] Variables de entorno: `ALPACA_API_KEY`, `ALPACA_API_SECRET`, `ANTHROPIC_API_KEY`
- [ ] NewsAdapter conecta a Alpaca y retorna artículos
- [ ] SentimentService llama a Claude y parsea JSON correctamente
- [ ] InvestmentAdvisor orquesta el flujo y retorna `InvestmentVerdict`
- [ ] URLAnalysisService obtiene contenido de URLs sin errores
- [ ] Ruta `/news/sentiment/:symbol` disponible en `http://localhost:3000`
- [ ] Frontend: NewsSourcesAnalyzer renderiza sin errores
- [ ] Test manual: Ingresa símbolo, verifica respuesta con veredicto
- [ ] Manejo de errores: Valida símbolos, API keys, timeouts

---

## 🔄 PRÓXIMAS MEJORAS SUGERIDAS

1. **Caché de Noticias**: Redis para evitar llamadas repetidas en 5 minutos
2. **Deduplicación**: Detectar noticias duplicadas entre fuentes
3. **Persistencia**: Guardar análisis en Supabase para auditoría
4. **Webhooks**: Notificar cambios de sentimiento en tiempo real
5. **Multi-símbolo**: Analizar cartera completa simultáneamente
6. **Backtesting**: Correlacionar sentimiento histórico con retornos
7. **Integración con órdenes**: Sugerir límites de stop/target basados en sentimiento

---

**Fin del Documento**

*Este prompt está diseñado para ser pasado a Claude para reproducir el sistema completo en otro repositorio con máxima fidelidad técnica.*
