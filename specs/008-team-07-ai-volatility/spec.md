# TEAM-07 SixPackDevs - AI Volatility Analysis
**Equipo:** TEAM-07 (SixPackDevs)  
**Líder:** Guillermo Ávila Camberos  
**Rol:** Lead Data  
**Fecha:** May 19, 2026  
**Estado:** In Progress  

---

## 📋 Resumen Ejecutivo

TEAM-07 (SixPackDevs) es responsable del **análisis de volatilidad con IA** y la implementación de **estrategias de opciones Long/Short** (Straddle, Strangle). Este equipo proporciona capacidades de análisis técnico avanzado integradas con inteligencia artificial para la toma de decisiones de inversión.

---

## 🎯 Funcionalidades Principales

### 1. Core AI Multi-Agente
- Orquestación de múltiples agentes de IA
- Análisis predictivo de volatilidad
- Integración con Claude API
- Context enrichment para decisiones

### 2. Estrategias de Volatility
- **Straddle:** Compra/Venta simultánea de Call y Put al mismo strike
- **Strangle:** Compra/Venta de Call y Put a diferentes strikes
- Cálculo de márgenes y riesgos
- Análisis de payoff

### 3. Motor de Análisis Técnico
- Indicadores técnicos avanzados
- Pattern recognition
- Soporte para múltiples timeframes
- Integración con TradingView Lightweight Charts

### 4. Historial Operativo
- Persistencia de operaciones ejecutadas
- Métricas de rendimiento
- Auditoría y compliance
- Análisis histórico

---

## 📊 Dependencias

### Depende de:
- **TEAM-01:** Conexiones a brokers (IBKR, Alpaca)
- **TEAM-02:** API REST infrastructure
- **TEAM-03:** Frontend components
- **TEAM-04:** Auth & identity

### Dependientes:
- **TEAM-05:** Dashboard de resultados
- **TEAM-06:** Reporting y analytics

---

## 🔧 Stack Técnico

- **Backend:** Node.js 22 LTS, TypeScript 5.x, Express
- **AI:** Claude API, Multi-Agent Orchestration
- **Broker APIs:** IBKR SDK, Alpaca SDK
- **Database:** Supabase, MongoDB (históricos)
- **Frontend:** React 18, TradingView Charts

---

## 📝 Notas

- Usa guía de creación de feature según PDF DIANA-SDK
- Se ejecuta desde rama: `feature/008-team-07-ai-volatility`
- Debe sincronizarse con `001-inversiones` initiative en DIANA
