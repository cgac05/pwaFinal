# TEAM-03 API Integration Guide

**Feature**: 003-fundamental-opciones-ia  
**API Version**: 1.0  
**Status**: ✅ Ready for integration  
**Last Updated**: 2026-05-25  

---

## Quick Start

TEAM-03 provides REST APIs for:
1. **Fundamental Analysis**: Company viability scores and profiles
2. **Strategy Recommendations**: Long Call, Long Put, Short Call, Short Put analysis
3. **S&P 500 Screening**: Ranked company candidates by strategy type
4. **Chat IA**: Conversational explanations of analysis
5. **Audit Trails**: Deterministic recalculation and compliance logs

All endpoints require authentication (JWT with `team-03:read` scope).

---

## Base URL

```
https://api.inversions-platform.local/api/team-03
```

## Authentication

All requests must include:
```
Authorization: Bearer <JWT_TOKEN>
X-Request-ID: <unique-request-id>  # Optional but recommended
```

---

## Endpoints

### 1. Get Company Fundamental Profile

**Endpoint**: `GET /fundamental/{ticker}`

**Query Parameters**:
- `ticker` (string, required): Stock ticker (e.g., AAPL, MSFT)
- `lookbackDays` (integer, optional, default=252): Historical lookback window

**Response** (200 OK):
```json
{
  "data": {
    "ticker": "AAPL",
    "company_name": "Apple Inc.",
    "profile": {
      "market_cap": 2800000000000,
      "revenue": 394328000000,
      "dividend_yield": 0.0045,
      "roe": 0.87,
      "pe_ratio": 28.5,
      "eps_growth_yoy": 0.15,
      "employees": 161000,
      "beta": 1.2,
      "sector": "Technology",
      "country_code": "US"
    },
    "metrics": {
      "volatility": 0.22,
      "annualized_vol": 0.22,
      "dividend_history_years": 12
    },
    "viability": {
      "score": 0.78,
      "classification": "VIABLE",
      "justification": "Large-cap tech with strong ROE (87%), moderate P/E (28.5x), healthy dividend history. Volatility 22% supports options strategies.",
      "factors": [
        "Market Cap: 2.8T (excellent)",
        "P/E Ratio: 28.5x (elevated but sector-appropriate)",
        "ROE: 87% (strong)",
        "Dividend History: 12 years (stable)"
      ]
    },
    "confidence": "HIGH",
    "timestamp": "2026-05-25T15:30:00Z",
    "assumptions": {
      "volatility_calculation_method": "daily_returns_60d",
      "benchmark_market_cap_range": "10B-3T",
      "data_freshness_minutes": 5
    },
    "metadata": {
      "sources": ["finviz", "yahoo_finance"],
      "calculation_version": "1.0",
      "cache_hit": true
    }
  },
  "status": 200,
  "timestamp": "2026-05-25T15:30:00Z",
  "version": "1.0"
}
```

**Error Response** (400 Bad Request):
```json
{
  "error": "Ticker INVALID (minimum 30 days historical data required)",
  "code": "INVALID_TICKER",
  "status": 400,
  "timestamp": "2026-05-25T15:30:00Z"
}
```

---

### 2. Recommend Strategy

**Endpoint**: `GET /strategies/recommend`

**Query Parameters**:
- `ticker` (string, required): Stock ticker
- `direction` (string, required): Market outlook - `bullish`, `neutral`, `bearish`
- `capital` (number, optional): Available capital in USD
- `risk_tolerance` (string, optional): `LOW`, `MEDIUM`, `HIGH`
- `days_to_decision` (integer, optional, default=10): Planning horizon

**Response** (200 OK):
```json
{
  "data": {
    "ticker": "AAPL",
    "analysis_timestamp": "2026-05-25T15:30:00Z",
    "fundamental_viability": 0.78,
    "recommendation": {
      "primary": {
        "strategy": "SHORT_CALL",
        "reasoning": "Volatility 22% > threshold 20%. Sell premium on near-term strength.",
        "confidence": 0.85,
        "risk_adjusted_return": 0.72,
        "expected_pnl": 245,
        "max_profit": 300,
        "max_loss": null,
        "breakeven": 175.5,
        "margin_required": 17500
      },
      "alternative": {
        "strategy": "LONG_CALL",
        "reasoning": "Directional bullish play with defined risk.",
        "confidence": 0.65,
        "risk_adjusted_return": 0.58,
        "expected_pnl": 180,
        "max_profit": null,
        "max_loss": 245
      }
    },
    "warnings": [
      "SHORT_CALL has unlimited loss potential without hedge",
      "Margin requirement: $17,500 must be available",
      "Market conditions can change; re-evaluate daily"
    ],
    "disclaimer": "⚠️ This is NOT financial advice. Consult a professional before trading."
  },
  "status": 200,
  "timestamp": "2026-05-25T15:30:00Z",
  "version": "1.0"
}
```

---

### 3. S&P 500 Screener

**Endpoint**: `GET /screener/sp500`

**Query Parameters**:
- `strategy` (string, required): `long_call`, `long_put`, `short_call`, `short_put`
- `min_viability` (number, optional, default=0.65): Minimum viability score
- `top_n` (integer, optional, default=10): Number of top candidates
- `sort_by` (string, optional): `viability`, `volatility`, `market_cap`

**Response** (200 OK):
```json
{
  "data": {
    "strategy": "short_put",
    "min_viability": 0.65,
    "results": [
      {
        "rank": 1,
        "ticker": "MSFT",
        "company_name": "Microsoft Corp.",
        "viability_score": 0.82,
        "volatility": 0.18,
        "market_cap": 2400000000000,
        "justification": "High viability (0.82), stable volatility, strong fundamentals",
        "link": "/fundamental/MSFT"
      },
      {
        "rank": 2,
        "ticker": "NVDA",
        "company_name": "NVIDIA Corporation",
        "viability_score": 0.76,
        "volatility": 0.35,
        "market_cap": 1100000000000,
        "justification": "Moderate viability, higher volatility (opportunity for premium selling)",
        "link": "/fundamental/NVDA"
      }
    ],
    "query_timestamp": "2026-05-25T15:30:00Z",
    "disclaimer": "⚠️ This is NOT financial advice. Consult a professional before trading."
  },
  "status": 200,
  "timestamp": "2026-05-25T15:30:00Z",
  "version": "1.0"
}
```

---

### 4. Chat IA

**Endpoint**: `POST /chat`

**Request Body**:
```json
{
  "ticker": "AAPL",
  "question": "¿Por qué no es viable para una estrategia de Long Call?",
  "includeStrategyRecommendation": true,
  "userId": "user-123"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "answer": "AAPL es viable para Long Call pero con consideraciones. Su volatilidad 22% proporciona buena oportunidad de comprar opciones con valuación razonable. Sin embargo, el P/E elevado (28.5x) sugiere que movimientos downside pueden ser más probables que upside explosivo...",
    "sourceContext": [
      "Ticker: AAPL",
      "Viability score: 0.78",
      "Strategy summary available",
      "Recent analysis history available"
    ],
    "disclaimer": "⚠️ Este análisis NO ES asesoramiento financiero.",
    "reasoningTrace": [
      "Retrieved fundamental data for AAPL",
      "Calculated viability score using weighted scorecard",
      "Evaluated strategy recommendation",
      "Generated explanation via Claude API"
    ]
  },
  "status": 200,
  "timestamp": "2026-05-25T15:30:00Z",
  "version": "1.0"
}
```

---

### 5. Audit Trail - Trace Calculation

**Endpoint**: `GET /audit/{ticker}/trace`

**Query Parameters**:
- `ticker` (string, required): Stock ticker
- `date_iso` (string, required): Analysis date (ISO 8601, e.g., 2026-05-25)
- `result_type` (string, optional): `viability_score`, `strategy_rec`, `pnl_scenario`

**Response** (200 OK):
```json
{
  "data": {
    "ticker": "AAPL",
    "date": "2026-05-25",
    "result_type": "viability_score",
    "final_result": 0.78,
    "calculation_steps": [
      {
        "step": 1,
        "metric": "Market Cap",
        "raw_value": 2800000000000,
        "normalized": 0.72,
        "weight": 0.15,
        "contribution": 0.108
      },
      {
        "step": 2,
        "metric": "ROE",
        "raw_value": 0.87,
        "normalized": 0.87,
        "weight": 0.2,
        "contribution": 0.174
      },
      {
        "step": 3,
        "metric": "P/E Ratio",
        "raw_value": 28.5,
        "normalized": 0.65,
        "weight": 0.15,
        "contribution": 0.0975
      }
    ],
    "formula": "0.108 + 0.174 + 0.0975 + ... = 0.78",
    "verified": true
  },
  "status": 200,
  "timestamp": "2026-05-25T15:30:00Z",
  "version": "1.0"
}
```

---

## Error Codes

| Code | Status | Meaning | Example |
|------|--------|---------|---------|
| INVALID_TICKER | 400 | Ticker not found or insufficient data | "INVALID (< 30 days)" |
| DATA_FETCH_ERROR | 503 | External data source unavailable | "Yahoo Finance API timeout" |
| VIABILITY_CALCULATION_ERROR | 500 | Scoring calculation failed | "NaN in metric normalization" |
| STRATEGY_RECOMMENDATION_ERROR | 500 | Strategy analysis failed | "Price scenario out of bounds" |
| AUTHENTICATION_FAILED | 401 | JWT invalid or expired | "Bearer token expired" |
| AUTHORIZATION_FAILED | 403 | Scope insufficient | "Requires team-03:read" |
| AUDIT_NOT_FOUND | 404 | Historical analysis not found | "No audit entry for 2026-05-20" |

---

## Rate Limiting

- **Limit**: 100 requests/minute per IP
- **Headers**:
  ```
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 85
  X-RateLimit-Reset: 2026-05-25T15:35:00Z
  ```

---

## Response Format

All responses follow this schema:

```typescript
interface ApiResponse<T> {
  data: T;
  status: number;
  timestamp: string;  // ISO 8601
  version: string;    // API version (1.0)
  requestId?: string; // Optional correlation ID
}
```

---

## SDK Support

TEAM-03 APIs can be consumed via:
- **HTTP REST** (JavaScript/TypeScript `fetch`, Python `requests`, etc.)
- **Upcoming**: TypeScript SDK (`@inversions/team-03-sdk`)

---

## Common Use Cases

### Use Case 1: Display Company Viability in Dashboard

```typescript
const response = await fetch(
  "https://api.inversions-platform.local/api/team-03/fundamental/AAPL",
  {
    headers: {
      Authorization: `Bearer ${jwt_token}`,
      "X-Request-ID": generateUUID()
    }
  }
);
const { data } = await response.json();
displayViabilityCard(data.viability);
```

### Use Case 2: Fetch Strategy Recommendations

```typescript
const strategies = await fetch(
  "https://api.inversions-platform.local/api/team-03/strategies/recommend?" +
  "ticker=AAPL&direction=bullish&risk_tolerance=MEDIUM",
  { headers: { Authorization: `Bearer ${jwt_token}` } }
);
```

### Use Case 3: Explain Analysis via Chat

```typescript
const chat = await fetch(
  "https://api.inversions-platform.local/api/team-03/chat",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ticker: "AAPL",
      question: "¿Cuál es el riesgo de Short Call en AAPL?"
    })
  }
);
```

---

## Support & Troubleshooting

- **Endpoint Documentation**: OpenAPI spec at `/api/team-03/docs/openapi.json`
- **Support**: @team-03-support on Slack
- **Issues**: GitHub issues tagged `team-03-api`

---

**Maintained by TEAM-03 Architecture**  
**Last updated**: 2026-05-25
