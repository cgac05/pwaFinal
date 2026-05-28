# Especificacion de Funcionalidad: Estrategias Complejas de Opciones (Iron Condor, Iron Butterfly, Butterfly Spread, Condor) - TEAM-08

**Feature Branch**: `003-team-08-glasscoke`  
**Created**: 2026-05-20  
**Status**: Active  
**Input**: Especificacion canonica en `.drfic/diana-sdk/projects/diana-inversions/initiatives/001-inversions/teams/TEAM-08/spec.md`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Simular y Modelar Estrategia Iron Condor (Priority: P1)

Como operador de opciones, necesito simular un Iron Condor ingresando strikes y primas por cada pata (compra/venta de Call y Put) para ver el crédito neto, los break-evens y la pérdida/ganancia máximas.

**Why this priority**: Es la base del slice de estrategias complejas de opciones que protege de grandes desplazamientos en mercados de baja volatilidad.

**Independent Test**: Se valida cuando un operador ingresa 4 patas correctas y la API calcula el retorno, el riesgo y el rango óptimo con precisión matemática.

**Acceptance Scenarios**:
1. **Given** un activo cotizando a 100, **When** el operador modela un Iron Condor con patas: Short Put 95, Long Put 90, Short Call 105, Long Call 110, **Then** calcula crédito neto positivo, ganancias máximas y límites de pérdida de forma consistente.
2. **Given** strikes incoherentes (e.g. Short Put superior al Short Call), **When** se ejecuta la simulación, **Then** el sistema bloquea con un error de negocio explicativo.

---

### User Story 2 - Comparar Estrategias Complejas y Obtener Explicación por IA (Priority: P2)

Como operador, necesito comparar la viabilidad de un Iron Condor contra un Iron Butterfly mediante análisis de escenarios y recibir una recomendación explicada en lenguaje natural por un motor de IA.

**Why this priority**: Cumple con el requerimiento de proveer explicabilidad a las decisiones de inversión antes de cualquier aprobación manual.

**Independent Test**: Se valida al consultar el comparador de estrategias con datos de precio e IV (volatilidad implícita) y recibir el análisis de escenarios junto con la recomendación textual estructurada.

**Acceptance Scenarios**:
1. **Given** un entorno de alta volatilidad implícita, **When** se evalúa el comparador de estrategias complejas, **Then** recomienda la estructura óptima fundamentando el motivo en base al riesgo/recompensa y decaimiento temporal.

---

## Success Criteria *(mandatory, measurable outcomes)*

- **SC-081**: El motor calcula el perfil completo de riesgo (Griegas: Delta, Gamma, Theta, Vega) y break-evens en un tiempo de respuesta <= 50 ms por combinación.
- **SC-082**: El comparador de estrategias soporta simulación por Monte Carlo con 10,000 caminos simulados, completándose en menos de 500 ms en desarrollo local.
- **SC-083**: Las alertas de margen y stop-loss dinámicos reducen la exposición a asignaciones tempranas en un 100% mediante lógica preventiva en el Risk Engine.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-081**: El sistema DEBE proveer un contrato base (`ComplexStrategyContract`) para validar y modelar las patas de la estrategia compleja de opciones.
- **FR-082**: El sistema DEBE implementar el motor para **Iron Condor** que calcule crédito neto, pérdida/ganancia máximas y break-evens.
- **FR-083**: El sistema DEBE implementar el motor para **Iron Butterfly** soportando variantes short y broken wing.
- **FR-084**: El sistema DEBE implementar el motor para **Butterfly Spread** con patas simétricas y asimétricas (Call y Put).
- **FR-085**: El sistema DEBE implementar el motor para **Condor** convencional calculando sensibilidad y payoff.
- **FR-086**: El sistema DEBE implementar un simulador con backtesting local y análisis de shocks de precio e IV.
- **FR-087**: El sistema DEBE implementar un Risk Engine con alertas de margen, stop-loss automático y riesgo de asignación temprana.
- **FR-088**: El sistema DEBE contar con APIs REST en `/api/strategies/complex/` para cada estrategia y un comparador centralizado.
- **FR-089**: Todo código nuevo generado DEBE incluir comentarios con prefijo `FIC:` en formato bilingüe inglés/español.
- **FR-090**: La cobertura de pruebas automatizadas (unitarias y de integración) DEBE ser superior al 80%.

## Key Entities *(mandatory)*

- **ComplexOptionLeg**: Representa cada una de las patas (long/short, call/put, strike, prima, expiración).
- **OptionStrategyProfile**: Perfil de riesgo de la estrategia (crédito/débito neto, break-evens, P&L máximo, riesgo máximo).
- **GreeksProfile**: Conjunto de sensibilidades (Delta, Gamma, Theta, Vega) de la estrategia.
- **StrategyComparisonResult**: Comparativa estructurada de rendimiento y viabilidad entre diferentes estrategias.
