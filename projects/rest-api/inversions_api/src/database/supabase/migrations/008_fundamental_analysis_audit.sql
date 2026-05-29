-- T017-US4: Crear tabla de auditoría de análisis fundamental
-- Migration: 008_fundamental_analysis_audit.sql

CREATE TABLE IF NOT EXISTS fundamental_analysis_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación del análisis
  ticker TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  
  -- Datos capturados en snapshot
  snapshot_data JSONB NOT NULL, -- Contiene: precios, ratios, volatilidad, etc.
  calculated_metrics JSONB NOT NULL, -- Métricas calculadas durante el análisis
  
  -- Resultado del análisis
  viability_score NUMERIC(3,2) NOT NULL CHECK (viability_score >= 0 AND viability_score <= 1),
  viability_classification VARCHAR(20) NOT NULL CHECK (viability_classification IN ('VIABLE', 'NEUTRAL', 'NOT_VIABLE')),
  
  -- Metadatos de cálculo
  timestamp_calculated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assumptions JSONB NOT NULL, -- volatility_calc_method, benchmark_market_cap, etc.
  
  -- Auditoría
  user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Índices para búsqueda y reproducibilidad
  UNIQUE(ticker, snapshot_date)
);

-- T017e: Índices para endpoint GET /api/team-03/audit/{ticker}/{dateIso}
CREATE INDEX IF NOT EXISTS idx_fundamental_analysis_audit_ticker_date
  ON fundamental_analysis_audit(ticker, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_fundamental_analysis_audit_created_at
  ON fundamental_analysis_audit(created_at DESC);

-- Hacer la tabla inmutable mediante RLS policy
-- INSERT permitido solo para sistema
-- UPDATE y DELETE prohibidos
ALTER TABLE fundamental_analysis_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_insert_system_only" ON fundamental_analysis_audit;
CREATE POLICY "audit_insert_system_only" ON fundamental_analysis_audit
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "audit_select_all" ON fundamental_analysis_audit;
CREATE POLICY "audit_select_all" ON fundamental_analysis_audit
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "audit_no_update" ON fundamental_analysis_audit;
CREATE POLICY "audit_no_update" ON fundamental_analysis_audit
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "audit_no_delete" ON fundamental_analysis_audit;
CREATE POLICY "audit_no_delete" ON fundamental_analysis_audit
  FOR DELETE USING (false);

-- Comentarios para documentación
COMMENT ON TABLE fundamental_analysis_audit IS
  'T017-US4: Auditoría trail inmutable de análisis fundamental. Captura snapshot de datos, métricas y score en cada análisis.';

COMMENT ON COLUMN fundamental_analysis_audit.snapshot_data IS
  'JSON con todos los datos usados en el cálculo: precios, ratios financieros, volatilidad histórica, dividendos.';

COMMENT ON COLUMN fundamental_analysis_audit.calculated_metrics IS
  'JSON con métricas calculadas: volatilidad normalizada, ratios normalizados, scores de componentes.';

COMMENT ON COLUMN fundamental_analysis_audit.assumptions IS
  'JSON con supuestos: método de cálculo de volatilidad, rango de market cap benchmark, versión de engine.';
