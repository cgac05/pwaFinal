# Contrato de API: Modelado y Simulación de Spreads (TEAM-06)

**Identificador**: 007-TEAM-06-SPREAD-CONTRACT  
**Fase**: Fase 1 (Diseño y Contratos)  
**Idioma**: Español  
**Estado**: Finalizado  

---

## 1. Resumen de Endpoints

| Método | Endpoint | Descripción | Acceso |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/spreads` | Obtiene el listado de estrategias de spreads simuladas por el usuario. | Autenticado (Propietario) |
| **POST** | `/api/v1/spreads` | Crea y simula una nueva estrategia de spread de opciones. | Autenticado (Propietario) |
| **GET** | `/api/v1/spreads/:id` | Obtiene el detalle de una estrategia y su matriz de simulación de payoff. | Autenticado (Propietario) |
| **PUT** | `/api/v1/spreads/:id` | Modifica parámetros de un spread activo (Valida concurrencia optimista). | Autenticado (Propietario) |
| **DELETE** | `/api/v1/spreads/:id` | Elimina una estrategia y sus resultados de simulación asociados. | Autenticado (Propietario) |

---

## 2. Definición Detallada de Endpoints

### 2.1 GET `/api/v1/spreads`

Obtiene la lista de todas las estrategias de spreads registradas por el usuario autenticado.

#### Parámetros de Consulta (Query Parameters)
- `subyacente` (string, opcional): Filtrar por ticker (ej. `AAPL`).
- `tipo_spread` (string, opcional): Filtrar por tipo (`DEBIT_SPREAD`, `CREDIT_SPREAD`).

#### Respuesta de Éxito (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "a90df21d-91b4-4903-8889-cb8dbcb64424",
      "tipo_spread": "CREDIT_SPREAD",
      "subyacente": "AAPL",
      "strike_largo": 160.00,
      "strike_corto": 165.00,
      "prima_larga": 1.20,
      "prima_corta": 3.40,
      "fecha_vencimiento": "2026-06-18T16:00:00Z",
      "cantidad_contratos": 2,
      "limite_stop_loss": 300.00,
      "costo_ingreso_neto": 440.00, -- Prima corta (3.40) - larga (1.20) = 2.20 * 100 * 2 = $440 de crédito recibido
      "version": 1,
      "creado_at": "2026-05-22T02:00:00Z"
    }
  ]
}
```

---

### 2.2 POST `/api/v1/spreads`

Registra y calcula automáticamente los parámetros clave (costo neto, ganancia máxima, pérdida máxima, break-even) de una estrategia, persistiendo y gatillando el motor de simulación de payoff.

#### Cuerpo de la Solicitud (Request Body)
```json
{
  "tipo_spread": "CREDIT_SPREAD",
  "subyacente": "AAPL",
  "strike_largo": 160.00,
  "strike_corto": 165.00,
  "prima_larga": 1.20,
  "prima_corta": 3.40,
  "fecha_vencimiento": "2026-06-18T16:00:00Z",
  "cantidad_contratos": 2,
  "limite_stop_loss": 300.00
}
```

#### Respuesta de Éxito (`201 Created`)
```json
{
  "success": true,
  "data": {
    "estrategia": {
      "id": "a90df21d-91b4-4903-8889-cb8dbcb64424",
      "tipo_spread": "CREDIT_SPREAD",
      "subyacente": "AAPL",
      "strike_largo": 160.00,
      "strike_corto": 165.00,
      "prima_larga": 1.20,
      "prima_corta": 3.40,
      "fecha_vencimiento": "2026-06-18T16:00:00Z",
      "cantidad_contratos": 2,
      "limite_stop_loss": 300.00,
      "costo_ingreso_neto": 440.00,
      "ganancia_maxima": 440.00,
      "perdida_maxima": 560.00, -- (Distancia Strikes 5.00 * 100 * 2) - 440.00 = 560.00
      "break_even": 162.80, -- Strike corto 165.00 - Crédito Neto Unitario 2.20 = 162.80
      "version": 1
    },
    "simulacion_payoff_url": "/api/v1/spreads/a90df21d-91b4-4903-8889-cb8dbcb64424"
  }
}
```

#### Respuestas de Error Comunes
- `400 Bad Request` (Strikes inválidos o fecha pasada):
```json
{
  "success": false,
  "error": {
    "code": "INVALID_STRATEGY_PARAMETERS",
    "message": "Los strikes no coinciden con la estructura de un Credit Spread válido o la fecha de vencimiento ya expiró."
  }
}
```

---

### 2.3 GET `/api/v1/spreads/:id`

Obtiene el detalle completo de un spread y retorna un conjunto proyectado de puntos de simulación de payoff según variaciones del subyacente para poder renderizar la curva en el frontend.

#### Respuesta de Éxito (`200 OK`)
```json
{
  "success": true,
  "data": {
    "estrategia": {
      "id": "a90df21d-91b4-4903-8889-cb8dbcb64424",
      "tipo_spread": "CREDIT_SPREAD",
      "subyacente": "AAPL",
      "strike_largo": 160.00,
      "strike_corto": 165.00,
      "prima_larga": 1.20,
      "prima_corta": 3.40,
      "fecha_vencimiento": "2026-06-18T16:00:00Z",
      "cantidad_contratos": 2,
      "costo_ingreso_neto": 440.00,
      "ganancia_maxima": 440.00,
      "perdida_maxima": 560.00,
      "break_even": 162.80,
      "riesgo_asignacion_temprana": {
        "probabilidad": 0.15, -- 15% de riesgo estimado
        "delta_opcion_corta": 0.42,
        "dias_al_vencimiento": 27,
        "clasificacion_alerta": "BAJA" -- BAJA, MEDIA, CRÍTICA
      },
      "version": 1
    },
    "simulacion_payoff": [
      {
        "precio_subyacente_simulado": 150.00,
        "payoff_esperado": -560.00,
        "probabilidad_exito": 0.05
      },
      {
        "precio_subyacente_simulado": 162.80,
        "payoff_esperado": 0.00,
        "probabilidad_exito": 0.50
      },
      {
        "precio_subyacente_simulado": 170.00,
        "payoff_esperado": 440.00,
        "probabilidad_exito": 0.85
      }
    ]
  }
}
```

---

### 2.4 PUT `/api/v1/spreads/:id`

Modifica las opciones del spread simulado activo. Para evitar que dos procesos modifiquen los mismos datos simultáneamente provocando una condición de carrera, se requiere pasar la clave `version` en el cuerpo.

#### Cuerpo de la Solicitud (Request Body)
```json
{
  "strike_largo": 161.00,
  "strike_corto": 165.00,
  "prima_larga": 1.10,
  "prima_corta": 3.40,
  "cantidad_contratos": 2,
  "limite_stop_loss": 250.00,
  "version": 1 -- Debe coincidir con la versión actual en la DB
}
```

#### Respuesta de Éxito (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "a90df21d-91b4-4903-8889-cb8dbcb64424",
    "costo_ingreso_neto": 460.00,
    "ganancia_maxima": 460.00,
    "perdida_maxima": 340.00, -- (Distancia strikes 4.00 * 100 * 2) - 460.00 = 340.00
    "break_even": 162.70,
    "version": 2 -- Version autoincrementada
  }
}
```

#### Respuesta de Conflicto de Concurrencia (`409 Conflict`)
```json
{
  "success": false,
  "error": {
    "code": "CONCURRENCY_CONFLICT",
    "message": "La estrategia fue modificada por otro usuario o sesión. Por favor, recarga los datos e intenta de nuevo."
  }
}
```

---

### 2.5 DELETE `/api/v1/spreads/:id`

Elimina de forma permanente un spread registrado junto con sus simulaciones asociadas.

#### Respuesta de Éxito (`200 OK`)
```json
{
  "success": true,
  "message": "Estrategia de spread y simulaciones asociadas eliminadas correctamente."
}
```
