# Contrato de API: Ingesta e Impacto de Noticias (TEAM-06)

**Identificador**: 007-TEAM-06-NEWS-CONTRACT  
**Fase**: Fase 1 (Diseño y Contratos)  
**Idioma**: Español  
**Estado**: Finalizado  

---

## 1. Resumen de Endpoints

| Método | Endpoint | Descripción | Acceso |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/news` | Obtiene el listado de noticias normalizadas filtradas por ticker, sentimiento o fuente. | Autenticado |
| **GET** | `/api/v1/news/:id` | Obtiene el detalle de una noticia específica. | Autenticado |
| **POST** | `/api/v1/news/ingest` | Dispara manualmente un pipeline de ingesta para un ticker o fuente (Utilidad Admin). | Admin / Backend |
| **GET** | `/api/v1/news/stats` | Obtiene indicadores agregados del mercado sobre sentimiento e impacto. | Autenticado |

---

## 2. Definición Detallada de Endpoints

### 2.1 GET `/api/v1/news`

Retorna una lista paginada y filtrable de noticias financieras normalizadas ingestadas.

#### Parámetros de Consulta (Query Parameters)
- `ticker` (string, opcional): Filtrar noticias asociadas a un activo financiero (ej. `AAPL`, `TSLA`).
- `sentimiento` (string, opcional): Filtrar por clasificación (`positivo`, `negativo`, `neutro`).
- `fuente` (string, opcional): Filtrar por origen (`Polygon`, `Finnhub`, etc.).
- `limit` (integer, opcional): Cantidad máxima de registros a retornar (Default: `20`, Max: `100`).
- `offset` (integer, opcional): Desplazamiento para paginación (Default: `0`).

#### Respuesta de Éxito (`200 OK`)
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "e93fca38-23eb-460d-a08b-b8c2cd708c35",
        "titulo": "Tesla reporta entregas récord en el Q1 superando las expectativas",
        "contenido": "Tesla, Inc. anunció hoy que entregó más de 480,000 vehículos durante el primer trimestre...",
        "ticker": "TSLA",
        "fuente": "Finnhub",
        "url": "https://finnhub.io/news/tsla-record-deliveries",
        "timestamp_publicacion": "2026-05-21T18:30:00Z",
        "sentimiento": "positivo",
        "score_impacto": 0.85,
        "confianza": 0.92,
        "procesado_at": "2026-05-21T18:30:45Z"
      }
    ],
    "pagination": {
      "total": 125,
      "limit": 20,
      "offset": 0
    }
  }
}
```

---

### 2.2 GET `/api/v1/news/:id`

Obtiene el detalle completo de una noticia financiera a partir de su identificador único.

#### Respuesta de Éxito (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "e93fca38-23eb-460d-a08b-b8c2cd708c35",
    "titulo": "Tesla reporta entregas récord en el Q1 superando las expectativas",
    "contenido": "Tesla, Inc. anunció hoy que entregó más de 480,000 vehículos durante el primer trimestre...",
    "ticker": "TSLA",
    "fuente": "Finnhub",
    "url": "https://finnhub.io/news/tsla-record-deliveries",
    "timestamp_publicacion": "2026-05-21T18:30:00Z",
    "sentimiento": "positivo",
    "score_impacto": 0.85,
    "confianza": 0.92,
    "procesado_at": "2026-05-21T18:30:45Z"
  }
}
```

#### Respuesta de Error (`404 Not Found`)
```json
{
  "success": false,
  "error": {
    "code": "NEWS_NOT_FOUND",
    "message": "La noticia especificada no existe en el sistema."
  }
}
```

---

### 2.3 POST `/api/v1/news/ingest`

Fuerza la ingesta asíncrona de datos desde las fuentes configuradas en vivo. Útil para jobs cron o paneles de soporte de administración.

#### Cuerpo de la Solicitud (Request Body)
```json
{
  "ticker": "AAPL",
  "fuente": "Polygon",
  "frescura_horas": 24
}
```

#### Respuesta de Éxito (`202 Accepted`)
```json
{
  "success": true,
  "message": "Proceso de ingesta iniciado asíncronamente en segundo plano.",
  "task_id": "job_ingest_aapl_poly_17163"
}
```

---

### 2.4 GET `/api/v1/news/stats`

Provee indicadores analíticos condensados sobre el estado de sentimiento del mercado y noticias procesadas. Útil para métricas de dashboard rápidas.

#### Parámetros de Consulta (Query Parameters)
- `ticker` (string, requerido): Activo sobre el cual calcular métricas (ej. `TSLA`).

#### Respuesta de Éxito (`200 OK`)
```json
{
  "success": true,
  "data": {
    "ticker": "TSLA",
    "total_noticias_analizadas": 48,
    "distribucion_sentimiento": {
      "positivo": 32,
      "neutro": 10,
      "negativo": 6
    },
    "score_impacto_promedio": 0.42,
    "confianza_media": 0.89,
    "frescura_ultima_noticia_at": "2026-05-21T21:15:00Z"
  }
}
```
