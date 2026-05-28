-- T020-US4: Crear tabla de auditoría de recomendación de estrategia
-- Migration: 009_strategy_recommendation_audit.sql

CREATE TABLE IF NOT EXISTS strategy_recommendation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  ticker TEXT NOT NULL,
  analysis_date DATE NOT NULL,
  
  -- Contexto fundamental
  fundamental_viability_score NUMERIC(3,2) NOT NULL CHECK (fundamental_viability_score >= 0 AND fundamental_viability_score <= 1),
  direction_hypothesis VARCHAR(20) NOT NULL CHECK (direction_hypothesis IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
  
  -- Ranking completo de estrategias
  comparator_results JSONB NOT NULL, -- Array de {strategy: string, rank: number, score: number, rationale: string, scenarios: {...}}
  
  -- Estrategia recomendada
  top_recommended_strategy VARCHAR(50) NOT NULL, -- "Long Call", "Long Put", "Short Call", "Short Put"
  reasoning TEXT NOT NULL,
  
  -- Metadatos
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Único por análisis
  UNIQUE(ticker, analysis_date)
);

-- T020d: Índices para endpoint GET /api/team-03/audit/{ticker}/{dateIso}/strategy
CREATE INDEX IF NOT EXISTS idx_strategy_recommendation_audit_ticker_date
  ON strategy_recommendation_audit(ticker, analysis_date DESC);

CREATE INDEX IF NOT EXISTS idx_strategy_recommendation_audit_created_at
  ON strategy_recommendation_audit(created_at DESC);

-- Hacer la tabla inmutable
ALTER TABLE strategy_recommendation_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "strategy_audit_insert_system_only" ON strategy_recommendation_audit;
CREATE POLICY "strategy_audit_insert_system_only" ON strategy_recommendation_audit
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "strategy_audit_select_all" ON strategy_recommendation_audit;
CREATE POLICY "strategy_audit_select_all" ON strategy_recommendation_audit
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "strategy_audit_no_update" ON strategy_recommendation_audit;
CREATE POLICY "strategy_audit_no_update" ON strategy_recommendation_audit
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "strategy_audit_no_delete" ON strategy_recommendation_audit;
CREATE POLICY "strategy_audit_no_delete" ON strategy_recommendation_audit
  FOR DELETE USING (false);

-- Comentarios
COMMENT ON TABLE strategy_recommendation_audit IS
  'T020-US4: Auditoría trail inmutable de recomendación de estrategia de opciones. Captura ranking completo y reasoning.';

COMMENT ON COLUMN strategy_recommendation_audit.comparator_results IS
  'JSON array con ranking: [{strategy: "Long Call", rank: 1, score: 0.85, rationale: "...", scenarios: {...}}, ...]';

COMMENT ON COLUMN strategy_recommendation_audit.reasoning IS
  'Explicación legible: por qué esta estrategia fue recomendada dado el contexto fundamental y dirección.';
