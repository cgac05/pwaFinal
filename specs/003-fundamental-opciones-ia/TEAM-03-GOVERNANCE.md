# TEAM-03 Governance Model: Semi-Automatic Investment Advisory

**Feature**: 003-fundamental-opciones-ia  
**Team**: TEAM-03 (SQLitoNo - Fundamental Analysis + Basic Options Strategies)  
**Status**: ✅ APPROVED FOR SEMI-AUTOMATIC OPERATION  
**Date**: 2026-05-25  

---

## Core Governance Principles

### 1. NO AUTO-TRADING (T024a)

**RULE**: All trading/execution operations REQUIRE explicit human approval.

✅ **Implemented**:
- No endpoint in TEAM-03 executes orders automatically
- No scheduled job executes trades
- All strategy recommendations are **read-only** analysis
- Recommendation APIs return analysis + justification only

**Verification**: Search codebase for `executeOrder`, `placeTrade`, `autoTrade` - should return ZERO results in TEAM-03 modules.

---

### 2. Mandatory Disclaimer on All Outputs (T024b)

**RULE**: Every response that provides investment analysis must include explicit disclaimer.

✅ **Standard Disclaimer Template** (used in all endpoints):

```
"⚠️ AVISO LEGAL (DISCLAIMER): Este análisis NO ES asesoramiento financiero.
Es una herramienta educativa que utiliza datos públicos y modelos matemáticos.
Consulta siempre con un asesor financiero profesional ANTES de tomar decisiones.
Los mercados pueden ser impredecibles; el rendimiento pasado no garantiza futuro."
```

✅ **Locations Where Disclaimer Must Appear**:
- GET `/api/team-03/fundamental/{ticker}` - company profile
- GET `/api/team-03/screener/sp500` - screener results
- GET `/api/team-03/strategies/recommend` - strategy recommendations
- POST `/api/team-03/chat` - chat AI responses
- GET `/api/team-03/audit/*` - audit reports

**Verification**: Each endpoint response includes `disclaimer` field.

---

### 3. Stop-Loss Generates REQUEST, Not Execution (T024c)

**RULE**: When a stop-loss condition is triggered, system generates a **request to close**, NOT automatic closure.

✅ **Implementation**:
- Endpoint: `PATCH /api/team-03/positions/{id}/request-close`
- Action: Creates record in `close_requests` table with status=PENDING_APPROVAL
- Notification: Email + Slack to responsible operator
- Human confirms closure via separate endpoint before execution

**Verification**: Confirm that `alertService.ts` never calls broker APIs directly; only generates notifications and requests.

---

### 4. Chat IA Never Gives Execution Signals (T024d)

**RULE**: Chat IA responses MUST NOT contain phrases that sound like trading orders.

✅ **Forbidden Phrases**:
- "Compra ahora" (Buy now)
- "Vende inmediatamente" (Sell immediately)
- "Esta es tu oportunidad" (This is your opportunity)
- "Deberías ejecutar" (You should execute)

✅ **Permitted Phrases**:
- "Short Call podría ser viable porque..." (Short Call could be viable because...)
- "La volatilidad sugiere que..." (Volatility suggests that...)
- "Los datos indican una oportunidad potencial si..." (Data indicates a potential opportunity if...)

**Verification**: Chat responses are reviewed via unit tests that explicitly block forbidden keywords.

---

## Control Points

### Control Point A: Data Ingestion (T077-T079)

| Stage | Responsibility | Approval Required |
|-------|-----------------|-------------------|
| T077: Data Contract | Define what data is accepted | Architecture review |
| T078: Data Fetch | Fetch from external sources with cache/fallback | None (read-only) |
| T079: Viability Scoring | Calculate score deterministically | None (deterministic calculation) |

**Risk**: Medium - Data could be stale or inaccurate  
**Mitigation**: Cache with TTL, fallback to previous snapshot, confidence scores

---

### Control Point B: Strategy Analysis (T080-T089)

| Stage | Responsibility | Approval Required |
|-------|-----------------|-------------------|
| T080: Fundamental Profile | Return company analysis with score | None (read-only) |
| T081: S&P500 Screener | Rank companies by viability | None (read-only) |
| T082-T086: Option Contracts | Define P&L calculations | None (deterministic) |
| T087: Simulation Engine | Project payoffs over time | None (deterministic) |
| T088: Alerts | Monitor positions, generate REQUESTS | Human review of request |
| T089: Strategy Comparator | Rank strategies by risk-adjusted return | None (read-only) |

**Risk**: Medium - Recommendations could be suboptimal  
**Mitigation**: Justification provided, confidence scores, rank alternatives

---

### Control Point C: Chat IA Explanations (T090)

| Stage | Responsibility | Approval Required |
|-------|-----------------|-------------------|
| T090: Chat IA | Explain analysis via natural language | None (read-only explanation) |
| | Reason about "why viable/not viable" | |
| | NO order generation | |

**Risk**: Low - Read-only explanatory interface  
**Mitigation**: Prompt engineering ensures no execution signals, tests validate compliance

---

### Control Point D: Auditing (T017-T020 + T023)

| Stage | Responsibility | Approval Required |
|-------|-----------------|-------------------|
| T017: Audit Trail | Log all analyses with snapshot data | None (logging) |
| T018: Determinism Validation | Verify recalculation matches original | None (validation) |
| T019: Audit Reports | Export historical analyses | None (read-only) |
| T020: Strategy Audit | Log strategy recommendation decision | None (logging) |
| T023: Trace Function | Show breadcrumb of calculations | None (read-only) |

**Risk**: Low - Historical analysis, no execution impact  
**Mitigation**: Immutable audit logs, hash verification

---

## Role-Based Access Control (T021e)

### Auth Scopes for TEAM-03 APIs

| Scope | Permission | Endpoints |
|-------|-----------|-----------|
| `team-03:read` | Read fundamental data, strategies, audit | GET /api/team-03/* |
| `team-03:audit` | Read detailed audit trails | GET /api/team-03/audit/* |
| `team-03:chat` | Access Chat IA | POST /api/team-03/chat |
| `team-03:admin` | View metrics, logs, system health | GET /api/team-03/admin/* |

**Verification**: All endpoints require `Authorization: Bearer <JWT>` with appropriate scope.

---

## Human-in-Loop Workflow

### Scenario 1: Fundamental Analysis Review

```
1. User queries: GET /api/team-03/fundamental/AAPL
2. System returns: { viability_score, justification, confidence, disclaimer }
3. User reads analysis
4. User MANUALLY decides whether to proceed (no auto-execution)
5. ✅ COMPLIANT: Analysis only, no trading action
```

### Scenario 2: Strategy Recommendation

```
1. User queries: GET /api/team-03/strategies/recommend?ticker=AAPL&direction=bullish
2. System returns: { ranked_strategies, reasoning, risk_metrics, disclaimer }
3. User studies recommendation and risk analysis
4. User MANUALLY decides to proceed (e.g., via broker platform)
5. ✅ COMPLIANT: Recommendation only, user executes externally
```

### Scenario 3: Stop-Loss Alert

```
1. Position tracked: Long Call on AAPL, stop-loss at $145
2. Market condition: AAPL drops to $144 (trigger)
3. System creates: { position_id, close_request_id, status: PENDING_APPROVAL }
4. System notifies: Email + Slack to operator: "Close request TEAM-03-CLR-1234 pending"
5. Operator reviews and approves: PATCH /api/team-03/positions/{id}/request-close/approve
6. Broker API executes: Only after human approval
7. ✅ COMPLIANT: Alert triggers REQUEST, human approves before execution
```

---

## Compliance Checklist (T024)

- [x] No auto-trading endpoints (zero direct broker API calls from TEAM-03 analysis modules)
- [x] Disclaimers included in all recommendation responses
- [x] Stop-loss generates REQUEST, not execution
- [x] Chat IA responses tested for forbidden trading signal keywords
- [x] Auth scopes defined for read-only vs admin access
- [x] Audit trail logs all analyses for compliance review
- [x] Documentation (this file) explains control points

---

## Monitoring & Escalation

### Alerts for Non-Compliance

| Condition | Action | Escalation |
|-----------|--------|------------|
| Endpoint called without valid JWT | Log warning, deny request | Daily audit report |
| Chat IA response contains forbidden phrase | Log error, alert admin | Real-time Slack |
| Stop-loss triggered, REQUEST generated but not approved within 1h | Log, send reminder | Daily escalation |
| Audit log shows score mismatch (non-determinism) | Log error, flag analysis | Real-time alert |

---

## Future Enhancements

- Implement ML-based anomaly detection for outlier recommendations
- Extend audit trail to support regulatory compliance (SEC 17a-4, MiFID II)
- Add role-based approval workflows (e.g., require senior analyst sign-off on high-risk strategies)
- Integrate with external compliance monitoring services

---

## Approval & Sign-Off

**Governance Review**: ✅ APPROVED  
**Date**: 2026-05-25  
**Reviewed By**: TEAM-03 Architecture Lead  
**Status**: Ready for integration

---

**This document is the single source of truth for TEAM-03 governance.**  
Any deviations require architectural review and update to this document.
