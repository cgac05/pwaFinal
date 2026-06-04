# Modelo de Observabilidad y SLO - TEAM-03

**Versión**: 1.0  
**Fecha**: 2026-05-23  
**Equipo**: TEAM-03 (SQLitoNo)  
**Objetivo**: Documentar el modelo de cálculo de disponibilidad, SLOs y métricas operativas para el backend de análisis fundamental y estrategias de opciones.

---

## 1. Definición de SLI/SLO

### 1.1 SLI (Service Level Indicator)

Un SLI es una métrica cuantificable que refleja la salud operativa de una dependencia o servicio. Para TEAM-03, los SLIs principales son:

#### Disponibilidad (Uptime)
- **Definición**: Porcentaje de solicitudes exitosas frente al total de solicitudes en un período.
- **Fórmula**: `Disponibilidad % = (Solicitudes Exitosas / Total de Solicitudes) × 100`
- **Unidad**: Porcentaje (%), hasta 2 decimales
- **Rango**: [0%, 100%]

#### Latencia (P99)
- **Definición**: Percentil 99 del tiempo de respuesta en milisegundos.
- **Fórmula**: Ordenar tiempos de respuesta, seleccionar el valor en posición `floor(0.99 × N)`
- **Unidad**: Milisegundos (ms)
- **Rango**: [0ms, +∞)

#### Error Rate
- **Definición**: Porcentaje de solicitudes que fallaron sobre el total.
- **Fórmula**: `Error Rate % = (Solicitudes Fallidas / Total de Solicitudes) × 100`
- **Unidad**: Porcentaje (%), hasta 2 decimales
- **Rango**: [0%, 100%]

### 1.2 SLO (Service Level Objective)

Un SLO es un objetivo contractual para un SLI. TEAM-03 define los siguientes SLOs mensuales:

| Dependencia | Disponibilidad Objetivo | Latencia P99 Target | Error Rate Target |
|---|---:|---:|---:|
| **IBKR (Interactive Brokers)** | ≥ 99.5% | ≤ 500ms | ≤ 0.5% |
| **ALPACA** | ≥ 99.5% | ≤ 500ms | ≤ 0.5% |
| **MARKET_DATA (Finviz, Yahoo, Alphavantage)** | ≥ 99.0% | ≤ 1000ms | ≤ 1.0% |
| **CLAUDE (Claude API)** | ≥ 99.0% | ≤ 2000ms | ≤ 1.0% |

### 1.3 Error Budget

El **Error Budget** representa la cantidad de fallos permitidos en un período mientras se mantiene el SLO.

**Fórmula**: 
```
Error Budget % = 100% - SLO Target %
Error Budget Allowed = Total Samples × (Error Budget % / 100)
```

**Ejemplo**: Si el SLO es 99.5% y hay 86,400 muestras en un mes:
- Error Budget % = 0.5%
- Error Budget Allowed = 86,400 × 0.005 = 432 fallos permitidos

Una vez consumido el error budget, se activan alertas escaladas.

---

## 2. Modelo de Cálculo de Disponibilidad Mensual

### 2.1 Período de Agregación

- **Granularidad**: Muestra instantánea por solicitud
- **Período**: Mes UTC completo (del 1 al último día del mes, 00:00 UTC a 23:59:59 UTC)
- **Zona horaria**: UTC (ISO 8601)

### 2.2 Fuentes de Datos

Las muestras de disponibilidad provienen de:

1. **Colector de Métricas en Dependencias**:
   - Cada integración (IBKR, ALPACA, MARKET_DATA, CLAUDE) registra una `AvailabilitySample` tras cada llamada.
   - Estructura:
     ```typescript
     interface AvailabilitySample {
       dependency: DependencyName;      // Qué servicio
       success: boolean;                 // Éxito/fallo
       latencyMs: number;                // Tiempo de respuesta
       timestampUtc: string;             // Cuándo ocurrió (ISO 8601)
       statusCode?: number;              // HTTP status si aplica
       errorCode?: string;               // Código de error si fallo
     }
     ```

2. **Logging de Transacciones**:
   - Sistema centralizado de auditoría registra eventos operativos.

3. **Métricas en Tiempo Real**:
   - WebSocket listeners capturan cambios de estado en posiciones abiertas.

### 2.3 Algoritmo de Agregación Mensual

```
1. Seleccionar mes/año de referencia (ej: mayo 2026)
2. Filtrar todas las muestras con timestampUtc en ese mes
3. Para cada dependencia:
   a. Filtrar muestras de esa dependencia
   b. Contar total de solicitudes
   c. Contar solicitudes exitosas (success === true)
   d. Calcular disponibilidad = (exitosas / total) × 100
   e. Comparar con SLO target: sloCompliant = (disponibilidad >= target)
   f. Calcular error budget consumido
   g. Extraer latencias de solicitudes exitosas
   h. Calcular percentiles: p50, p95, p99
   i. Contar errores por código y ordenar top 5
4. Calcular disponibilidad general = (total exitosas / total muestras) × 100
5. Verificar SC-005 compliance: general_availability >= 99.5%
6. Generar reporte consolidado
```

### 2.4 Redondeo y Precisión

- **Porcentajes de disponibilidad**: Redondear a 2 decimales (ej: 99.50%)
- **Latencias**: Mantener en enteros ms
- **Conteos**: Enteros sin redondeo

---

## 3. Mapeado a Contratos Operativos

### 3.1 SC-005: Disponibilidad Mensual Mínima

**Requisito**: TEAM-03 debe demostrar disponibilidad operativa ≥ 99.5% mensual.

**Evidencia**:
- Reporte mensual `availability-{YYYY}-{MM}.json` en `backend/reports/availability/`
- Desglose por dependencia en el reporte
- Timestamp de generación del reporte

**Auditoría**: Tabla `audit_trail` en Supabase registra:
- `action: "availability_report_generated"`
- `month`, `year`, `overall_availability_percent`, `sc005_compliant`
- `generated_by: "system"`, `generated_at` (UTC)

### 3.2 PL-011: Evidencias de Observabilidad Medibles

**Requisito**: Mantener evidencias anuales de observabilidad para cumplimiento.

**Artefactos**:
- 12 reportes mensuales (enero-diciembre)
- Cada reporte incluye: período, muestras totales, fallos, disponibilidad, SLO compliance
- Almacenados en S3 o filesystem con acceso auditado

---

## 4. Formato de Exportación: Prometheus-Compatible

### 4.1 Estándar Prometheus

TEAM-03 exporta métricas en formato de texto compatible con Prometheus:

```
# HELP team03_availability_percent Disponibilidad mensual por dependencia
# TYPE team03_availability_percent gauge
team03_availability_percent{dependency="IBKR", month="05", year="2026"} 99.85
team03_availability_percent{dependency="ALPACA", month="05", year="2026"} 99.72
team03_availability_percent{dependency="MARKET_DATA", month="05", year="2026"} 99.10
team03_availability_percent{dependency="CLAUDE", month="05", year="2026"} 99.95

# HELP team03_latency_p99_ms Latencia P99 en ms
# TYPE team03_latency_p99_ms gauge
team03_latency_p99_ms{dependency="IBKR", month="05", year="2026"} 420
team03_latency_p99_ms{dependency="ALPACA", month="05", year="2026"} 380
team03_latency_p99_ms{dependency="MARKET_DATA", month="05", year="2026"} 850
team03_latency_p99_ms{dependency="CLAUDE", month="05", year="2026"} 1200

# HELP team03_error_rate_percent Error rate en %
# TYPE team03_error_rate_percent gauge
team03_error_rate_percent{dependency="IBKR", month="05", year="2026"} 0.15
team03_error_rate_percent{dependency="ALPACA", month="05", year="2026"} 0.28
team03_error_rate_percent{dependency="MARKET_DATA", month="05", year="2026"} 0.90
team03_error_rate_percent{dependency="CLAUDE", month="05", year="2026"} 0.05

# HELP team03_slo_compliant SLO compliance (1=compliant, 0=violated)
# TYPE team03_slo_compliant gauge
team03_slo_compliant{dependency="IBKR", month="05", year="2026"} 1
team03_slo_compliant{dependency="ALPACA", month="05", year="2026"} 1
team03_slo_compliant{dependency="MARKET_DATA", month="05", year="2026"} 0
team03_slo_compliant{dependency="CLAUDE", month="05", year="2026"} 1

# HELP team03_error_budget_remaining_percent Error budget restante
# TYPE team03_error_budget_remaining_percent gauge
team03_error_budget_remaining_percent{dependency="IBKR", month="05", year="2026"} 0.35
team03_error_budget_remaining_percent{dependency="ALPACA", month="05", year="2026"} 0.22
team03_error_budget_remaining_percent{dependency="MARKET_DATA", month="05", year="2026"} -0.90
team03_error_budget_remaining_percent{dependency="CLAUDE", month="05", year="2026"} 0.95
```

### 4.2 Consumidor: Scraper Prometheus

Para integrar con un stack de Prometheus/Grafana:
- Endpoint: `/metrics` (future: implementar si requerido)
- Formato: Text-based Prometheus format (plaintext)
- Actualización: Diaria (post-generación de reporte mensual)

---

## 5. Alertas y Escalonamiento

### 5.1 Umbrales de Alerta

| Condición | Severidad | Acción |
|---|---|---|
| Error Budget Restante < 50% | ⚠️ Warning | Notificar a Slack #team-03-alerts |
| Error Budget Restante < 10% | 🔴 Critical | Notificar a Slack + Email a equipo |
| SLO Violado (mid-month) | 🔴 Critical | Crear ticket de escalación, notificar lead |
| Error Rate > 5% en 1 hora | 🔴 Critical | Alerta instantánea + fallback a caché |

### 5.2 Procedimiento de Escalación

1. **Monitoreo en tiempo real**: Job cada 1 hora verifica estado actual
2. **Alerta instantánea**: Slack, Email a on-call
3. **Registro**: `audit_trail` documenta quién fue notificado y cuándo
4. **Mitigación**: Si CLAUDE falla, usar LLM local fallback
5. **Post-mortem**: Análisis semanal de incidentes

---

## 6. Auditoría y Compliance

### 6.1 Registro de Evidencias

Toda muestra y reporte se registra en:
- **Tabla Supabase**: `availability_samples`, `monthly_availability_reports`
- **Filesystem**: `backend/reports/availability/{YYYY}/{MM}/`
- **S3** (future): Backup archivado por año

### 6.2 Acceso y Privacidad

- **Lectura**: Equipo TEAM-03, Leads, Auditoría
- **Escritura**: Solo sistema (no manual)
- **Retención**: Mínimo 7 años (regulatorio)
- **Exportación**: JSON, PDF (on-demand)

---

## 7. Ejemplos de Uso

### 7.1 Generación de Reporte Mensual

```typescript
import { AvailabilitySloService } from './observability/availabilitySlo';
import { MonthlyAvailabilityReportJob } from './jobs/monthlyAvailabilityReport';

const sloService = new AvailabilitySloService();
const job = new MonthlyAvailabilityReportJob(sloService);

// Generar reporte de mayo 2026
const result = await job.run(2026, 5, { format: 'json', outputDir: './reports' });
console.log(`Reporte: ${result.reportPath}, SC-005 Compliant: ${result.sc005Compliant}`);
```

### 7.2 Acceso a Métricas de Disponibilidad

```typescript
const dashboard = sloService.getDashboardForMonth(2026, 5);
console.log(`Disponibilidad General: ${dashboard.overallAvailabilityPercent}%`);
dashboard.dependencies.forEach(dep => {
  console.log(`${dep.dependency}: ${dep.availabilityPercent}% (SLO: ${dep.sloCompliant ? 'PASS' : 'FAIL'})`);
});
```

### 7.3 Exportación a Prometheus

```typescript
const metricsText = sloService.exportPrometheusMetrics(2026, 5);
// Retorna string en formato Prometheus text-based
```

---

## 8. Cambios Futuros (v1.1+)

- [ ] Integración con Prometheus + Grafana para dashboards en tiempo real
- [ ] Exportación a S3 con compresión gzip
- [ ] PDF reporting con gráficas
- [ ] Alertas bidireccionales (Slack → Responder con "acknowledge")
- [ ] ML-based anomaly detection en error patterns

---

## 9. Control de Cambios

| Versión | Fecha | Cambio | Autor |
|---|---|---|---|
| 1.0 | 2026-05-23 | Documento inicial | TEAM-03 |

---

**Documento Canónico**: `.drfic/diana-sdk/projects/diana-inversions/initiatives/001-inversions/teams/TEAM-03/OBSERVABILITY_MODEL.md`  
**Última Actualización**: 2026-05-23T14:00:00Z UTC
