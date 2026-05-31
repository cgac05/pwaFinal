# Modelo de Datos: Análisis de Noticias y Estrategias de Spreads (TEAM-06)

**Identificador**: 007-TEAM-06-DATA-MODEL  
**Fase**: Fase 1 (Diseño y Contratos)  
**Idioma**: Español  
**Estado**: Finalizado  

---

## 1. Esquema Operacional (Supabase PostgreSQL)

El core de noticias y spreads operará en la base de datos Supabase utilizando PostgreSQL. Para mantener la consistencia con el ecosistema, las tablas contarán con RLS (Row Level Security) y control de concurrencia mediante `version` donde aplique.

### 1.1 Tabla `noticia_financiera`
Almacena las noticias ingestadas de múltiples fuentes, normalizadas, con sus respectivas clasificaciones de impacto y sentimiento.

```sql
CREATE TYPE tipo_sentimiento AS ENUM ('positivo', 'negativo', 'neutro');

CREATE TABLE noticia_financiera (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(500) NOT NULL,
    contenido TEXT NOT NULL,
    ticker VARCHAR(20) NOT NULL, -- Activo financiero asociado (ej. AAPL, TSLA)
    fuente VARCHAR(100) NOT NULL, -- Finnhub, Polygon, SEC, etc.
    url TEXT,
    timestamp_publicacion TIMESTAMPTZ NOT NULL,
    sentimiento tipo_sentimiento NOT NULL DEFAULT 'neutro',
    score_impacto DECIMAL(3, 2) NOT NULL DEFAULT 0.00 CHECK (score_impacto BETWEEN -1.00 AND 1.00),
    confianza DECIMAL(3, 2) NOT NULL DEFAULT 0.00 CHECK (confianza BETWEEN 0.00 AND 1.00),
    procesado_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Restricción para evitar duplicación de noticias en una ventana de corto plazo
    CONSTRAINT uq_noticia_frescura UNIQUE (ticker, titulo, timestamp_publicacion)
);

-- Índices optimizados para consulta rápida
CREATE INDEX idx_noticias_ticker_fecha ON noticia_financiera (ticker, timestamp_publicacion DESC);
CREATE INDEX idx_noticias_sentimiento ON noticia_financiera (sentimiento);
```

---

### 1.2 Tabla `estrategia_spread`
Modela las combinaciones de spreads de opciones diseñadas o simuladas por los usuarios.

```sql
CREATE TYPE tipo_spread AS ENUM ('DEBIT_SPREAD', 'CREDIT_SPREAD');

CREATE TABLE estrategia_spread (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo_spread tipo_spread NOT NULL,
    subyacente VARCHAR(20) NOT NULL, -- Ticker del subyacente
    strike_largo DECIMAL(10, 2) NOT NULL CHECK (strike_largo > 0),
    strike_corto DECIMAL(10, 2) NOT NULL CHECK (strike_corto > 0),
    prima_larga DECIMAL(10, 2) NOT NULL CHECK (prima_larga >= 0),
    prima_corta DECIMAL(10, 2) NOT NULL CHECK (prima_corta >= 0),
    fecha_vencimiento TIMESTAMPTZ NOT NULL CHECK (fecha_vencimiento > NOW()),
    cantidad_contratos INTEGER NOT NULL DEFAULT 1 CHECK (cantidad_contratos > 0),
    limite_stop_loss DECIMAL(10, 2) CHECK (limite_stop_loss >= 0),
    costo_ingreso_neto DECIMAL(10, 2) NOT NULL, -- Calculado automáticamente
    version INTEGER NOT NULL DEFAULT 1, -- Optimistic locking
    creado_at TIMESTAMPTZ DEFAULT NOW(),
    actualizado_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Restricción de strikes para evitar combinaciones lógicamente inválidas (ej. strikes iguales)
    CONSTRAINT chk_strikes_distintos CHECK (strike_largo <> strike_corto)
);

-- Índices de consulta
CREATE INDEX idx_spreads_user ON estrategia_spread (user_id);
CREATE INDEX idx_spreads_subyacente ON estrategia_spread (subyacente);
```

---

### 1.3 Tabla `simulacion_resultado`
Guarda el payoff proyectado y los resultados analíticos asociados a una estrategia bajo diferentes precios del subyacente.

```sql
CREATE TABLE simulacion_resultado (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estrategia_id UUID NOT NULL REFERENCES estrategia_spread(id) ON DELETE CASCADE,
    precio_subyacente_simulado DECIMAL(10, 2) NOT NULL CHECK (precio_subyacente_simulado >= 0),
    payoff_esperado DECIMAL(10, 2) NOT NULL, -- Pérdida o Ganancia teórica calculada
    probabilidad_exito DECIMAL(5, 4) NOT NULL CHECK (probabilidad_exito BETWEEN 0.0000 AND 1.0000),
    creado_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para recuperación rápida de la curva de payoff de una simulación
CREATE INDEX idx_simulaciones_estrategia ON simulacion_resultado (estrategia_id, precio_subyacente_simulado ASC);
```

---

### 1.4 Tabla `news_source_configurations`
Permite el enrutamiento de fallbacks dinámicos para las fuentes de ingesta sin necesidad de redeploy.

```sql
CREATE TABLE news_source_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fuente_nombre VARCHAR(100) UNIQUE NOT NULL, -- Finnhub, Polygon, etc.
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    prioridad_enrutamiento INTEGER NOT NULL DEFAULT 1,
    endpoint_base TEXT NOT NULL,
    config_adicional JSONB DEFAULT '{}'::jsonb,
    actualizado_at TIMESTAMPTZ DEFAULT NOW()
);

-- Semilla de configuración por defecto
INSERT INTO news_source_configurations (fuente_nombre, activa, prioridad_enrutamiento, endpoint_base)
VALUES 
('Polygon', TRUE, 1, 'https://api.polygon.io'),
('Finnhub', TRUE, 2, 'https://finnhub.io/api/v1'),
('NewsAPI', TRUE, 3, 'https://newsapi.org/v2'),
('SEC_EDGAR', TRUE, 1, 'https://data.sec.gov');
```

---

## 2. Reglas de Negocio en Base de Datos

### 2.1 Trigger de Cálculo Automático del Costo/Ingreso Neto
Para evitar desalineamiento de cálculos matemáticos, la columna `costo_ingreso_neto` en `estrategia_spread` se auto-calcula al insertar o modificar un registro.

```sql
CREATE OR REPLACE FUNCTION calcular_costo_ingreso_neto_spread()
RETURNS TRIGGER AS $$
BEGIN
    -- Si es Spread de Débito: Prima Larga (Comprada) > Prima Corta (Vendida)
    -- Si es Spread de Crédito: Prima Corta (Vendida) > Prima Larga (Comprada)
    -- El valor neto se expresa como el balance por contrato * multiplicador (100)
    NEW.costo_ingreso_neto := (NEW.prima_larga - NEW.prima_corta) * 100 * NEW.cantidad_contratos;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_calcular_neto_spread
BEFORE INSERT OR UPDATE ON estrategia_spread
FOR EACH ROW
EXECUTE FUNCTION calcular_costo_ingreso_neto_spread();
```

### 2.2 Control de Concurrencia (Optimistic Locking)
Al actualizar una `estrategia_spread`, la transacción debe verificar que la `version` corresponda a la última leída:

```sql
-- Ejemplo de query transaccional
UPDATE estrategia_spread 
SET 
    strike_largo = $1, 
    strike_corto = $2, 
    prima_larga = $3, 
    prima_corta = $4,
    version = version + 1,
    actualizado_at = NOW()
WHERE id = $5 AND version = $6; -- Si no afecta filas, significa conflicto de actualización.
```

---

## 3. Políticas de Row Level Security (RLS)

Cumpliendo con la Constitución del Proyecto, el acceso directo a los datos operativos está restringido según el token JWT y claims del usuario.

### 3.1 RLS para `noticia_financiera` y `news_source_configurations`
- **Lectura**: Cualquier usuario autenticado (`authenticated`) puede leer noticias financieras y configuraciones de fuentes.
- **Escritura/Modificación**: Solo el backend API (`service_role` o rol administrador dedicado) tiene permiso para insertar o modificar noticias financieras y parámetros de configuración.

```sql
ALTER TABLE noticia_financiera ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_source_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura libre de noticias para usuarios autenticados"
ON noticia_financiera FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Lectura libre de configuraciones para usuarios autenticados"
ON news_source_configurations FOR SELECT
TO authenticated
USING (true);
```

### 3.2 RLS para `estrategia_spread` y `simulacion_resultado`
- **Lectura e Inserción**: Restringido al propietario del recurso (`user_id == auth.uid()`).
- **Modificación/Eliminación**: Solo permitida al propietario del recurso (`user_id == auth.uid()`).

```sql
ALTER TABLE estrategia_spread ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulacion_resultado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios solo ven y manejan sus propias estrategias"
ON estrategia_spread FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios solo ven simulaciones de sus estrategias"
ON simulacion_resultado FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM estrategia_spread
        WHERE estrategia_spread.id = simulacion_resultado.estrategia_id
        AND estrategia_spread.user_id = auth.uid()
    )
);
```
