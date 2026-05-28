# AI Integration Guide: Complex Options Strategy Module (Team-08 GlassCoke)

This document is designed for **AI Agents, Developer Agents (SpecKit/Diana)**, and developers from other teams (Team-02 Dashboard, Team-07/08 Analysis & Volatility, and other strategy teams). It provides comprehensive instructions, JSON request/response schemas, and TypeScript code-level examples to seamlessly invoke, consume, and integrate the complex options strategy engines and REST APIs.

---

## 1. Module Overview & Integration Roles

Our module handles **multi-leg complex options strategies** (Iron Condor, Iron Butterfly, Butterfly Spread, and Standard Condor) including calculation of net premium, max profit/loss, break-evens, theoretical Greeks, Monte Carlo path simulations (probability of profit and expected value), broker margin requirements, stop-loss triggers, and AI-driven comparisons.

Here is who needs to integrate with this module and why:

| Integrating Team | Use Case | Integration Method |
| ---------------- | -------- | ------------------ |
| **TEAM-02 (Confluence Dashboard & UI)** | Render options payout curves, Greeks, stop-losses, and AI-generated trading recommendations. | REST API endpoints |
| **TEAM-07 & TEAM-08 (Technical/Fundamental Analysis)** | Trigger Monte Carlo simulations to run volatility shocks (Implied Volatility changes) and underlying price shocks. | REST API / Direct TS Engine Imports |
| **TEAM-03, 04, 09 (Wheel, Diagonal, other strategies)** | Compare their own strategy candidates against an Iron Condor or Butterfly Spread in terms of probability of profit or expected P&L. | `/compare` REST API endpoint |

---

## 2. Authentication Bypass (Local Development)

The backend Express application supports a development bypass for JWT authentication. 

*   **When active (`AUTH_BYPASS=true` in `.env`)**: You do not need a valid Supabase JWT. The system automatically populates `req.authContext` with a mock trader role.
*   **Request Header**: If your agent/app makes HTTP requests, pass the following header:
    ```http
    Authorization: Bearer dev-bypass-token
    Content-Type: application/json
    ```

---

## 3. REST API Endpoints `/api/strategies/complex`

The API listens at `http://localhost:3000`.

### A. Central Strategy Comparator (`/compare`)
Sintetiza de manera automática estrategias candidatas o compara conjuntos personalizados, simulando el valor esperado y generando explicaciones de IA estructuradas en inglés y español.

*   **Endpoint**: `POST /api/strategies/complex/compare`
*   **Query Parameters (Optional)**:
    *   `volatility` (number, default: `0.25`): Implied Volatility (e.g. 0.35 for 35%).
    *   `daysToExpiration` (number, default: `30`): Days to contract expiration.
    *   `slippagePercent` (number, default: `0.01`): Transaction slip factor (1% friction).
    *   `accountBalance` (number, default: `25000`): User's simulated account balance.
*   **Request Body**:
    ```json
    {
      "ticker": "COCA",
      "underlyingPrice": 100,
      "riskTolerance": "moderate"
    }
    ```
    *(Note: You can also optionally supply a custom array of strategies inside `"strategies": [{"name": "My Condor", "legs": [...]}]`. If omitted, the API automatically generates optimized, centered candidates for Iron Condor, Iron Butterfly, Butterfly Spread, and standard Condor based on the spot price).*

*   **Response Body (`200 OK`)**:
    ```json
    {
      "success": true,
      "ticker": "COCA",
      "spot": 100,
      "volatility": 0.25,
      "daysToExpiration": 30,
      "comparison": [
        {
          "strategyName": "Iron Condor",
          "profile": {
            "name": "Iron Condor",
            "netPremium": 2,
            "isCredit": true,
            "maxProfit": 200,
            "maxLoss": 300,
            "breakEvens": [93, 107],
            "greeks": { "delta": 0, "gamma": 0.01, "theta": 0.45, "vega": -0.25 }
          },
          "risk": {
            "riskScore": 3,
            "requiredMargin": 2000,
            "earlyAssignmentRisk": "none",
            "alerts": [],
            "stopLossTriggerPrice": [91.14, 109.14],
            "killSwitchTriggered": false
          },
          "simulation": {
            "pricePoints": [75.0, 76.0, "..."],
            "payoffs": [-300.0, -300.0, "...", 200.0],
            "probabilityOfProfit": 0.724,
            "expectedValue": 84.3
          }
        }
      ],
      "aiRecommendation": {
        "recommendedStrategy": "Iron Condor",
        "confidence": 0.85,
        "explanationEn": "Based on an implied volatility of 25% and a risk appetite of moderate, the Iron Condor structure presents the most optimized risk/reward profile...",
        "explanationEs": "Basado en una volatilidad implícita del 25% y una tolerancia al riesgo moderate, la estructura de Iron Condor presenta el perfil de riesgo/recompensa más optimizado..."
      }
    }
    ```

---

### B. Individual Strategy Simulators
Each strategy has a dedicated simulation endpoint that returns the complete financial profile, a 1,000-path Monte Carlo probability check, stop-loss markers, and a formatted **ASCII payoff chart**.

*   **Iron Condor**: `POST /api/strategies/complex/iron-condor`
*   **Iron Butterfly**: `POST /api/strategies/complex/iron-butterfly`
*   **Butterfly Spread**: `POST /api/strategies/complex/butterfly-spread`
*   **Condor**: `POST /api/strategies/complex/condor`

#### Request Payload Example (Symmetric Iron Condor)
```json
{
  "ticker": "COCA",
  "underlyingPrice": 100,
  "legs": [
    { "id": "leg-1", "type": "put", "action": "buy", "strike": 90, "premium": 0.5, "contracts": 1, "expiration": "2026-06-20" },
    { "id": "leg-2", "type": "put", "action": "sell", "strike": 95, "premium": 1.5, "contracts": 1, "expiration": "2026-06-20" },
    { "id": "leg-3", "type": "call", "action": "sell", "strike": 105, "premium": 1.4, "contracts": 1, "expiration": "2026-06-20" },
    { "id": "leg-4", "type": "call", "action": "buy", "strike": 110, "premium": 0.4, "contracts": 1, "expiration": "2026-06-20" }
  ]
}
```

#### Response Payload Example (`200 OK`)
```json
{
  "success": true,
  "profile": {
    "name": "Iron Condor",
    "netPremium": 2.0,
    "isCredit": true,
    "maxProfit": 200,
    "maxLoss": 300,
    "breakEvens": [93, 107],
    "greeks": { "delta": 0, "gamma": 0.01, "theta": 0.45, "vega": -0.25 }
  },
  "simulation": {
    "pricePoints": [75, 76, "..."],
    "payoffs": [-302, -302, "..."],
    "probabilityOfProfit": 0.725,
    "expectedValue": 85.5
  },
  "risk": {
    "riskScore": 3,
    "requiredMargin": 2000,
    "earlyAssignmentRisk": "none",
    "alerts": [],
    "stopLossTriggerPrice": [91.14, 109.14],
    "killSwitchTriggered": false
  },
  "report": {
    "timestamp": "2026-05-21T06:12:00.000Z",
    "strategyName": "Iron Condor",
    "netPremiumDesc": "FIC: Net Credit received: $200.00 / Crédito Neto recibido",
    "optimalProfitZone": "FIC: Profit is maximized when the underlying price remains between 93.00 and 107.00...",
    "riskSummary": "FIC: Risk level evaluated at 3/10. Margins required: $2000. Alerts count: 0...",
    "payoffData": [
      { "price": 75, "profit": -302 }
    ],
    "asciiChart": "\n   FIC: Payoff curve representation / Representación de curva Payoff:\n     75.00 | -------------\n     80.00 | -------------\n     95.00 | +++++++++++\n     100.00 | +++++++++++\n"
  }
}
```

---

## 4. Code-level Integration (Direct TypeScript Imports)

If your agent is writing backend code inside the Express API, you can bypass the REST overhead and call our business engines directly by importing them from `src/modules/strategies/complex/`.

### TypeScript Imports and Examples

```typescript
import { ComplexStrategyInput } from "./modules/strategies/complex/complexStrategyContract";
import { calculateIronCondor } from "./modules/strategies/complex/ironCondorEngine";
import { simulateStrategy } from "./modules/strategies/complex/complexSimulationEngine";
import { evaluateStrategyRisk } from "./modules/strategies/complex/complexRiskEngine";
import { generateFullReport } from "./modules/strategies/complex/complexReportEngine";

// 1. Prepare inputs / Preparar inputs
const input: ComplexStrategyInput = {
  ticker: "COCA",
  underlyingPrice: 100,
  legs: [
    { id: "1", type: "put", action: "buy", strike: 90, premium: 0.5, contracts: 1, expiration: "2026-06-20" },
    { id: "2", type: "put", action: "sell", strike: 95, premium: 1.5, contracts: 1, expiration: "2026-06-20" },
    { id: "3", type: "call", action: "sell", strike: 105, premium: 1.4, contracts: 1, expiration: "2026-06-20" },
    { id: "4", type: "call", action: "buy", strike: 110, premium: 0.4, contracts: 1, expiration: "2026-06-20" }
  ]
};

// 2. Compute option metrics / Calcular métricas de la estrategia
const profile = calculateIronCondor(input);

// 3. Run Monte Carlo simulation paths / Correr caminos de simulación Monte Carlo
const sim = simulateStrategy(
  input, 
  profile, 
  30,     // Days to expiration / Días al vencimiento
  0.25,   // Annualized Implied Volatility (25%) / Volatilidad implícita
  0.01    // Slippage friction (1%) / Slippage y comisiones
);

// 4. Evaluate account risk & early assignment alerts / Evaluar riesgo de cuenta y alertas
const risk = evaluateStrategyRisk(
  input, 
  profile, 
  25000,  // Account Balance / Balance de cuenta
  0.05    // Max risk budget (5%) / Presupuesto de riesgo máximo
);

// 5. Generate formatted markdown summaries & ASCII curves / Generar reportes y gráficos ASCII
const report = generateFullReport(input, profile, sim, risk);

console.log(profile.maxProfit); // 200
console.log(sim.probabilityOfProfit); // e.g. 0.724 (72.4%)
console.log(risk.requiredMargin); // Broker margin requirement
console.log(report.asciiChart); // ASCII Payoff curve
```

---

## 5. Typical Agent/Integration Errors & How to Avoid Them

1.  **Mismatch of Legs count**: 
    *   `calculateIronCondor` and `calculateCondor` require exactly **4 legs**.
    *   `calculateIronButterfly` requires exactly **4 legs** and both **short legs must have the same strike**.
    *   `calculateButterflySpread` requires exactly **3 legs** following a **1:2:1** contract ratio.
2.  **Floating point decimal representation in client charts**:
    *   Always use `toBeCloseTo` or round net premium values using `.toFixed(2)` if displaying them in high-end UI dashboards (Team-02).
3.  **Invalid Option types/styles**:
    *   Only `call` and `put` are accepted. Actions must be strictly `buy` or `sell`.
