# Parámetros de Formulario — 4 Estrategias de Opciones

> Referencia para construir formularios dedicados por estrategia.
> Fuente: `src/modules/strategies/options/{longCall,shortCall,longPut,shortPut}.ts`

---

## Resumen: ¿Son iguales los 4 formularios?

**Sí.** Las 4 estrategias consumen exactamente el mismo `OptionStrategyInput`.  
Solo cambia el comportamiento interno y los warnings.  
`optionType` y `direction` se hardcodean según la estrategia seleccionada.

---

## Parámetros completos por estrategia

| Parámetro | Tipo | Long Call | Short Call | Long Put | Short Put |
|---|---|---|---|---|---|
| `ticker` | string | ✅ | ✅ | ✅ | ✅ |
| `currentPrice` | number (auto) | ✅ | ✅ | ✅ | ✅ |
| `strikePrice` | number | ✅ | ✅ | ✅ | ✅ |
| `premiumPerContract` | number | ✅ | ✅ | ✅ | ✅ |
| `numberOfContracts` | integer | ✅ | ✅ | ✅ | ✅ |
| `expirationDate` | string ISO | ✅ | ✅ | ✅ | ✅ |
| `daysToExpiration` | number (auto) | ✅ | ✅ | ✅ | ✅ |
| `availableCapital` | number | ✅ | ✅ | ✅ | ✅ |
| `riskTolerance` | LOW/MEDIUM/HIGH | ✅ | ✅ | ✅ | ✅ |
| `assumptions.impliedVolatility` | number % | ✅ | ✅ | ✅ | ✅ |
| `assumptions.timeDecayModel` | LINEAR/EXPONENTIAL | ✅ | ✅ | ✅ | ✅ |
| `assumptions.interestRate` | number % | ✅ | ✅ | ✅ | ✅ |
| `optionType` | hardcoded CALL/PUT | CALL | CALL | PUT | PUT |
| `direction` | hardcoded LONG/SHORT | LONG | SHORT | LONG | SHORT |

---

## Estado actual del frontend (Panel Análisis)

### YA CAPTURADO en el panel actual

| Campo UI | Mapea a | Cómo |
|---|---|---|
| Chips empresa (AAPL, MSFT…) + input personalizado | `ticker` | Directo |
| Fecha HASTA del rango de proyección | `expirationDate` | Directo |
| Días calculados automáticamente | `daysToExpiration` | Auto (hoy → HASTA) |
| Chips de estrategia (Short Call, Short Put…) | `optionType` + `direction` | Hardcodeado por selección |
| Perfil de inversión (Value/Growth/Aggressive…) | `riskTolerance` (parcial) | Mapeo aproximado ↓ |

**Mapeo perfil → riskTolerance:**
```
Value     → LOW
Dividend  → LOW
Quality   → MEDIUM
Growth    → MEDIUM
Aggressive → HIGH
```

### FALTANTE — no hay input en el panel actual

| Parámetro | Tipo | Obligatorio | Nota |
|---|---|---|---|
| `strikePrice` | number input | ✅ Sí | Precio strike del contrato |
| `premiumPerContract` | number input | ✅ Sí | Prima pagada/recibida por contrato |
| `numberOfContracts` | integer input | ✅ Sí | Mínimo 1, múltiplo de 1 |
| `availableCapital` | number input | ✅ Sí | Capital total disponible en USD |
| `impliedVolatility` | number input % | ❌ Opcional | Default: 25% |
| `timeDecayModel` | toggle LINEAR/EXPONENTIAL | ❌ Opcional | Default: LINEAR |
| `interestRate` | number input % | ❌ Opcional | Default: 4% |

### AUTO-CALCULADO (no necesita input de usuario)

| Parámetro | Fuente |
|---|---|
| `currentPrice` | Fetch API por ticker (FMP/Finnhub/etc. ya seleccionado) |
| `daysToExpiration` | `Math.ceil((expirationDate - today) / 86400000)` |

---

## Diferencias clave entre estrategias (afectan UI/UX, no parámetros)

| Estrategia | Break-even | Prima | Riesgo máx | Warning crítico |
|---|---|---|---|---|
| Long Call | `strike + premium` | Se **paga** | Prima pagada | Decay acelera cerca vencimiento |
| Short Call | `strike + premium` | Se **recibe** | **ILIMITADO** ⚠️ | Requiere hedge o convicción alta |
| Long Put | `strike - premium` | Se **paga** | Prima pagada | Requiere caída significativa |
| Short Put | `strike - premium` | Se **recibe** | `(strike - premium) × contratos × 100` | Riesgo de asignación si precio baja |

> **Short Call tiene pérdida ilimitada.** El formulario debe mostrar warning prominente al seleccionarla.

---

## Campos a agregar al panel (resumen ejecutivo)

Agregar **4 campos obligatorios** + sección colapsable de supuestos avanzados:

```
SECCIÓN: Contrato de Opción
├── Strike Price          [número, ej. 185.00]
├── Prima por contrato    [número, ej. 2.50]  — label cambia: "Prima pagada" / "Prima recibida"
├── N° de contratos       [entero, min 1]
└── Capital disponible    [número, ej. 10000]

SECCIÓN AVANZADA (colapsable, defaults):
├── Volatilidad implícita [%, default 25]
├── Modelo theta decay    [LINEAR / EXPONENTIAL]
└── Tasa de interés       [%, default 4]
```

---

*Generado: 2026-05-28 | Fuente: análisis de código estrategias options TEAM-03*
