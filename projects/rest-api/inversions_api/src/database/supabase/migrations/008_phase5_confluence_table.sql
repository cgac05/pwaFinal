-- FIC: Phase 5 — Tabla canonica de confluencia + simulacion (FR-014..FR-020, US5/US6).
-- FIC: Phase 5 — Canonical confluence table + simulation persistence (TEAM-02).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) signal_observations: observacion estructurada por fila (objetivo/senal/explicacion + metricas JSONB).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signal_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objetivo TEXT NOT NULL DEFAULT '',
  senal TEXT NOT NULL DEFAULT '',
  explicacion TEXT NOT NULL DEFAULT '',
  metricas JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) option_legs: greeks opcionales por fila (solo cuando la senal apunta a una opcion).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS option_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ala TEXT NOT NULL CHECK (ala IN ('ALA1', 'ALA2')),
  vencimiento DATE NOT NULL,
  strike NUMERIC NOT NULL,
  gamma NUMERIC NOT NULL,
  theta NUMERIC NOT NULL,
  delta NUMERIC NOT NULL,
  posicion TEXT NOT NULL CHECK (posicion IN ('SHORT', 'LONG')),
  tolerancia TEXT NOT NULL CHECK (tolerancia IN ('BAJO', 'MEDIO', 'ALTO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) confluence_signal_rows: fila canonica de la tabla (1 por core, o 1 por subCore en A_INDICADORES).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS confluence_signal_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket TEXT NOT NULL,
  core TEXT NOT NULL CHECK (core IN (
    'A_INDICADORES', 'A_FUNDAMENTAL', 'A_TECNICO',
    'A_INSTITUCIONAL', 'A_NOTICIAS', 'A_IA'
  )),
  sub_core TEXT, -- 'RSI'|'MACD'|'EMA'|'ADX'|'BB' cuando core=A_INDICADORES (FR-017)
  precio NUMERIC NOT NULL,
  tipo_senal TEXT NOT NULL CHECK (tipo_senal IN ('CALL', 'PUT', 'HOLD')), -- FR-018
  fecha DATE NOT NULL,
  timeframe TEXT NOT NULL CHECK (timeframe IN ('1m', '5m', '15m', '1h', '4h', '1d')),
  tendencia TEXT NOT NULL CHECK (tendencia IN ('ALCISTA', 'BAJISTA', 'LATERAL')),
  score NUMERIC NOT NULL CHECK (score >= -1 AND score <= 1),
  peso NUMERIC NOT NULL CHECK (peso >= 0),
  invertir BOOLEAN NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('ACTIVA', 'EXPIRADA', 'INVALIDADA', 'DEGRADADA')),
  vigencia TIMESTAMPTZ NOT NULL,
  fuente TEXT NOT NULL,
  evidencia_refs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ia_revisada BOOLEAN NOT NULL DEFAULT FALSE,
  disclaimer_id TEXT,
  delta_vs_anterior TEXT NOT NULL CHECK (delta_vs_anterior IN ('NUEVA', 'CONFIRMADA', 'INVERTIDA', 'DEGRADADA')),
  observation_id UUID REFERENCES signal_observations(id) ON DELETE SET NULL,
  option_leg_id UUID REFERENCES option_legs(id) ON DELETE SET NULL,
  algorithm_version TEXT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_input_hash TEXT NOT NULL,
  simulation_run_id UUID,
  -- FIC: FR-019 / SC-009 — toda fila con core=A_IA exige ia_revisada=true + disclaimer_id no nulo.
  CONSTRAINT ia_rows_must_be_revised CHECK (
    core <> 'A_IA' OR (ia_revisada = TRUE AND disclaimer_id IS NOT NULL)
  ),
  -- FIC: FR-017 — sub_core obligatorio si core=A_INDICADORES.
  CONSTRAINT indicadores_require_sub_core CHECK (
    core <> 'A_INDICADORES' OR sub_core IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_confluence_rows_ticket_time
  ON confluence_signal_rows(ticket, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_confluence_rows_core
  ON confluence_signal_rows(core);
CREATE INDEX IF NOT EXISTS idx_confluence_rows_estado
  ON confluence_signal_rows(estado);
CREATE INDEX IF NOT EXISTS idx_confluence_rows_run
  ON confluence_signal_rows(simulation_run_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) simulation_runs: auditoria de cada POST /api/simulation/run (FR-008, US6, T088).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  ticket TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  estrategia TEXT NOT NULL,
  tolerancia_riesgo TEXT NOT NULL CHECK (tolerancia_riesgo IN ('BAJO', 'MEDIO', 'ALTO')),
  runtime_mode TEXT NOT NULL CHECK (runtime_mode IN ('ONLINE', 'OFFLINE')),
  cores_habilitados TEXT[] NOT NULL,
  indicadores_habilitados TEXT[] NOT NULL,
  rango_historico JSONB NOT NULL, -- preset string o {from,to}
  rango_estrategia JSONB NOT NULL, -- {from,to}
  inputs_echo JSONB NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('alcista', 'neutral', 'bajista')),
  score NUMERIC NOT NULL,
  degraded BOOLEAN NOT NULL DEFAULT FALSE,
  algorithm_version TEXT NOT NULL,
  source_input_hash TEXT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simulation_runs_ticket_time
  ON simulation_runs(ticket, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_user
  ON simulation_runs(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) confluence_columns: config metadata-driven con applies_to_cores[] (Phase 5).
--    Coexiste con `confluence_column_configs` de la migracion 006 (Phase 8 dashboard).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS confluence_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  data_type TEXT NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'timestamp', 'json', 'enum')),
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  order_index INTEGER NOT NULL DEFAULT 0,
  applies_to_cores TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FIC: Semillas iniciales — columnas del PDF v1 + columnas tecnicas (SC-007).
INSERT INTO confluence_columns (field_key, label, data_type, visible, order_index, applies_to_cores) VALUES
  ('ticket',            'TICKET',        'string',    TRUE,  1,  ARRAY['A_INDICADORES','A_FUNDAMENTAL','A_TECNICO','A_INSTITUCIONAL','A_NOTICIAS','A_IA']),
  ('core',              'CORE',          'enum',      TRUE,  2,  ARRAY['A_INDICADORES','A_FUNDAMENTAL','A_TECNICO','A_INSTITUCIONAL','A_NOTICIAS','A_IA']),
  ('subCore',           'SUBCORE',       'string',    TRUE,  3,  ARRAY['A_INDICADORES']),
  ('precio',            'PRECIO',        'number',    TRUE,  4,  ARRAY['A_INDICADORES','A_FUNDAMENTAL','A_TECNICO','A_INSTITUCIONAL','A_NOTICIAS','A_IA']),
  ('tipoSenal',         'TIPO SEÑAL',    'enum',      TRUE,  5,  ARRAY['A_INDICADORES','A_FUNDAMENTAL','A_TECNICO','A_INSTITUCIONAL','A_NOTICIAS','A_IA']),
  ('fecha',             'FECHA',         'timestamp', TRUE,  6,  ARRAY['A_INDICADORES','A_FUNDAMENTAL','A_TECNICO','A_INSTITUCIONAL','A_NOTICIAS','A_IA']),
  ('timeframe',         'TIMEFRAME',     'string',    TRUE,  7,  ARRAY['A_INDICADORES','A_TECNICO']),
  ('tendencia',         'TENDENCIA',     'enum',      TRUE,  8,  ARRAY['A_INDICADORES','A_FUNDAMENTAL','A_TECNICO','A_INSTITUCIONAL','A_NOTICIAS','A_IA']),
  ('score',             'SCORE',         'number',    TRUE,  9,  ARRAY['A_INDICADORES','A_FUNDAMENTAL','A_TECNICO','A_INSTITUCIONAL','A_NOTICIAS','A_IA']),
  ('peso',              'PESO',          'number',    TRUE,  10, ARRAY['A_INDICADORES','A_FUNDAMENTAL','A_TECNICO','A_INSTITUCIONAL','A_NOTICIAS','A_IA']),
  ('invertir',          'INVERTIR S/N',  'boolean',   TRUE,  11, ARRAY['A_INDICADORES','A_FUNDAMENTAL','A_TECNICO','A_INSTITUCIONAL','A_NOTICIAS','A_IA']),
  ('estado',            'ESTADO',        'enum',      TRUE,  12, ARRAY['A_INDICADORES','A_FUNDAMENTAL','A_TECNICO','A_INSTITUCIONAL','A_NOTICIAS','A_IA']),
  ('observacion',       'OBSERVACION',   'json',      TRUE,  13, ARRAY['A_INDICADORES','A_FUNDAMENTAL','A_TECNICO','A_INSTITUCIONAL','A_NOTICIAS','A_IA']),
  ('vigencia',          'VIGENCIA',      'timestamp', FALSE, 20, ARRAY['A_INDICADORES','A_FUNDAMENTAL','A_TECNICO','A_INSTITUCIONAL','A_NOTICIAS','A_IA']),
  ('fuente',            'FUENTE',        'string',    FALSE, 21, ARRAY['A_INDICADORES','A_FUNDAMENTAL','A_TECNICO','A_INSTITUCIONAL','A_NOTICIAS','A_IA']),
  ('ia_revisada',       'IA REVISADA',   'boolean',   FALSE, 22, ARRAY['A_IA']),
  ('disclaimer_id',     'DISCLAIMER',    'string',    FALSE, 23, ARRAY['A_IA']),
  ('delta_vs_anterior', 'DELTA',         'enum',      FALSE, 24, ARRAY['A_INDICADORES','A_FUNDAMENTAL','A_TECNICO','A_INSTITUCIONAL','A_NOTICIAS','A_IA']),
  ('evidencia_refs',    'EVIDENCIA',     'json',      FALSE, 25, ARRAY['A_INDICADORES','A_FUNDAMENTAL','A_TECNICO','A_INSTITUCIONAL','A_NOTICIAS','A_IA']),
  ('optionLeg',         'GREEKS',        'json',      FALSE, 26, ARRAY['A_TECNICO'])
ON CONFLICT (field_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Vista v_confluence_table: join fila + observacion + greeks para servir sin N+1.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_confluence_table AS
SELECT
  r.id,
  r.ticket,
  r.core,
  r.sub_core AS "subCore",
  r.precio,
  r.tipo_senal AS "tipoSenal",
  r.fecha,
  r.timeframe,
  r.tendencia,
  r.score,
  r.peso,
  r.invertir,
  r.estado,
  r.vigencia,
  r.fuente,
  r.evidencia_refs,
  r.ia_revisada,
  r.disclaimer_id,
  r.delta_vs_anterior AS "delta_vs_anterior",
  jsonb_build_object(
    'objetivo',    COALESCE(o.objetivo, ''),
    'senal',       COALESCE(o.senal, ''),
    'explicacion', COALESCE(o.explicacion, ''),
    'metricas',    COALESCE(o.metricas, '{}'::jsonb)
  ) AS observacion,
  CASE
    WHEN l.id IS NULL THEN NULL
    ELSE jsonb_build_object(
      'ala',         l.ala,
      'vencimiento', l.vencimiento,
      'strike',      l.strike,
      'gamma',       l.gamma,
      'theta',       l.theta,
      'delta',       l.delta,
      'posicion',    l.posicion,
      'tolerancia',  l.tolerancia
    )
  END AS "optionLeg",
  r.algorithm_version,
  r.computed_at,
  r.source_input_hash,
  r.simulation_run_id
FROM confluence_signal_rows r
LEFT JOIN signal_observations o ON o.id = r.observation_id
LEFT JOIN option_legs l         ON l.id = r.option_leg_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) Triggers updated_at + RLS.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_confluence_columns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS confluence_columns_touch ON confluence_columns;
CREATE TRIGGER confluence_columns_touch
  BEFORE UPDATE ON confluence_columns
  FOR EACH ROW
  EXECUTE FUNCTION touch_confluence_columns_updated_at();

ALTER TABLE confluence_signal_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_observations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_legs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE confluence_columns     ENABLE ROW LEVEL SECURITY;

CREATE POLICY confluence_rows_read ON confluence_signal_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY signal_observations_read ON signal_observations FOR SELECT TO authenticated USING (true);
CREATE POLICY option_legs_read ON option_legs FOR SELECT TO authenticated USING (true);
CREATE POLICY simulation_runs_read ON simulation_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY confluence_columns_read ON confluence_columns FOR SELECT TO authenticated USING (true);

-- FIC: Insert/update solo via service-role (lo hace el backend; el cliente no escribe directo).
CREATE POLICY confluence_rows_admin_write ON confluence_signal_rows FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'trader'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'trader'));
CREATE POLICY simulation_runs_admin_write ON simulation_runs FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'trader'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'trader'));
CREATE POLICY confluence_columns_admin_write ON confluence_columns FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

COMMIT;
