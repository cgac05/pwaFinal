# QA Frontend - Ejemplos Manuales para Estrategias de Opciones

Este documento contiene casos de prueba manuales para validar que la interfaz muestre correctamente los calculos principales de las cuatro estrategias de opciones: Long Call, Long Put, Short Call y Short Put.

Los valores son hipoteticos y estan pensados para pruebas de interfaz. Cada contrato representa 100 acciones.

## Como ejecutar cada caso en la UI

1. Abrir el panel o vista de estrategias de opciones.
2. Seleccionar la estrategia indicada en cada caso.
3. Capturar exactamente los campos de entrada.
4. Ejecutar el calculo desde la interfaz.
5. Comparar el resultado visual contra la seccion "Resultado esperado".

## Formulas esperadas por la UI

- Long Call: Break-even = Strike Price + Prima.
- Long Put: Break-even = Strike Price - Prima.
- Short Call: Break-even = Strike Price + Prima.
- Short Put: Break-even = Strike Price - Prima.
- Costo de prima en estrategias Long = Prima x Numero de Contratos x 100.
- Margen requerido en estrategias Short = Strike Price x Numero de Contratos x 100 x 20%.

---

## 1. Long Call

### Caso 1A - Exito viable: Apple

Objetivo de QA: validar una compra de call con capital suficiente, prima razonable y break-even cercano al precio actual.

Campos a capturar:

| Campo | Valor |
|---|---:|
| Ticker (Empresa) | AAPL - Apple |
| Precio Actual de la accion (USD) | 190.00 |
| Strike Price / Precio de Ejercicio (USD) | 185.00 |
| Prima por contrato (USD) | 4.50 |
| Numero de Contratos | 2 |
| Dias para la Expiracion | 45 |
| Capital Disponible del Usuario (USD) | 5,000.00 |

Resultado esperado:

| Validacion visual | Debe mostrar |
|---|---:|
| Veredicto | VIABLE |
| Break-even Price | 189.50 |
| Costo de la Prima | 900.00 USD |
| Warnings en rojo | Ninguna advertencia critica esperada |

### Caso 1B - Riesgo no viable: Nvidia

Objetivo de QA: validar advertencias por prima alta, capital insuficiente y expiracion muy cercana.

Campos a capturar:

| Campo | Valor |
|---|---:|
| Ticker (Empresa) | NVDA - Nvidia |
| Precio Actual de la accion (USD) | 120.00 |
| Strike Price / Precio de Ejercicio (USD) | 130.00 |
| Prima por contrato (USD) | 15.00 |
| Numero de Contratos | 1 |
| Dias para la Expiracion | 5 |
| Capital Disponible del Usuario (USD) | 800.00 |

Resultado esperado:

| Validacion visual | Debe mostrar |
|---|---:|
| Veredicto | NO_VIABLE |
| Break-even Price | 145.00 |
| Costo de la Prima | 1,500.00 USD |
| Warnings en rojo | Prima mayor al 10% del precio actual; capital insuficiente para cubrir la prima; menos de 7 dias para expiracion, riesgo de decay acelerado |

---

## 2. Long Put

### Caso 2A - Exito viable: Tesla

Objetivo de QA: validar una compra de put con prima razonable y capital suficiente.

Campos a capturar:

| Campo | Valor |
|---|---:|
| Ticker (Empresa) | TSLA - Tesla |
| Precio Actual de la accion (USD) | 185.00 |
| Strike Price / Precio de Ejercicio (USD) | 195.00 |
| Prima por contrato (USD) | 6.00 |
| Numero de Contratos | 1 |
| Dias para la Expiracion | 30 |
| Capital Disponible del Usuario (USD) | 2,000.00 |

Resultado esperado:

| Validacion visual | Debe mostrar |
|---|---:|
| Veredicto | VIABLE |
| Break-even Price | 189.00 |
| Costo de la Prima | 600.00 USD |
| Warnings en rojo | Ninguna advertencia critica esperada |

### Caso 2B - Riesgo no viable: Microsoft

Objetivo de QA: validar advertencias por prima alta, capital insuficiente y decay acelerado.

Campos a capturar:

| Campo | Valor |
|---|---:|
| Ticker (Empresa) | MSFT - Microsoft |
| Precio Actual de la accion (USD) | 430.00 |
| Strike Price / Precio de Ejercicio (USD) | 410.00 |
| Prima por contrato (USD) | 50.00 |
| Numero de Contratos | 1 |
| Dias para la Expiracion | 4 |
| Capital Disponible del Usuario (USD) | 3,000.00 |

Resultado esperado:

| Validacion visual | Debe mostrar |
|---|---:|
| Veredicto | NO_VIABLE |
| Break-even Price | 360.00 |
| Costo de la Prima | 5,000.00 USD |
| Warnings en rojo | Prima mayor al 10% del precio actual; capital insuficiente para cubrir la prima; menos de 7 dias para expiracion, riesgo de decay acelerado |

---

## 3. Short Call

### Caso 3A - Exito con riesgo controlado: Microsoft

Objetivo de QA: validar una venta de call fuera del dinero con margen suficiente. Aunque el caso sea viable, la UI debe seguir mostrando advertencias propias de Short Call.

Campos a capturar:

| Campo | Valor |
|---|---:|
| Ticker (Empresa) | MSFT - Microsoft |
| Precio Actual de la accion (USD) | 410.00 |
| Strike Price / Precio de Ejercicio (USD) | 430.00 |
| Prima por contrato (USD) | 5.00 |
| Numero de Contratos | 1 |
| Dias para la Expiracion | 35 |
| Capital Disponible del Usuario (USD) | 12,000.00 |

Resultado esperado:

| Validacion visual | Debe mostrar |
|---|---:|
| Veredicto | VIABLE |
| Break-even Price | 435.00 |
| Margen Requerido | 8,600.00 USD |
| Prima Recibida | 500.00 USD |
| Warnings en rojo | Riesgo de perdida ilimitada si el precio sube por encima del break-even; requiere capital de margen significativo; recomendado solo con conviccion alta o cobertura |

### Caso 3B - Riesgo no viable: Nvidia

Objetivo de QA: validar Short Call In-The-Money, capital insuficiente y riesgo de asignacion temprana.

Campos a capturar:

| Campo | Valor |
|---|---:|
| Ticker (Empresa) | NVDA - Nvidia |
| Precio Actual de la accion (USD) | 135.00 |
| Strike Price / Precio de Ejercicio (USD) | 125.00 |
| Prima por contrato (USD) | 3.00 |
| Numero de Contratos | 2 |
| Dias para la Expiracion | 21 |
| Capital Disponible del Usuario (USD) | 3,000.00 |

Resultado esperado:

| Validacion visual | Debe mostrar |
|---|---:|
| Veredicto | NO_VIABLE |
| Break-even Price | 128.00 |
| Margen Requerido | 5,000.00 USD |
| Prima Recibida | 600.00 USD |
| Warnings en rojo | Riesgo de perdida ilimitada; capital insuficiente para margen estimado; Short Call esta In-The-Money; riesgo de asignacion temprana; recomendado solo con cobertura |

---

## 4. Short Put

### Caso 4A - Exito viable: Apple

Objetivo de QA: validar una venta de put fuera del dinero con margen suficiente y perdida maxima finita.

Campos a capturar:

| Campo | Valor |
|---|---:|
| Ticker (Empresa) | AAPL - Apple |
| Precio Actual de la accion (USD) | 190.00 |
| Strike Price / Precio de Ejercicio (USD) | 180.00 |
| Prima por contrato (USD) | 3.00 |
| Numero de Contratos | 1 |
| Dias para la Expiracion | 30 |
| Capital Disponible del Usuario (USD) | 5,000.00 |

Resultado esperado:

| Validacion visual | Debe mostrar |
|---|---:|
| Veredicto | VIABLE |
| Break-even Price | 177.00 |
| Margen Requerido | 3,600.00 USD |
| Prima Recibida | 300.00 USD |
| Warnings en rojo | Maxima perdida teorica de 17,700.00 USD; requiere capital de margen suficiente |

### Caso 4B - Riesgo no viable: Tesla

Objetivo de QA: validar Short Put In-The-Money, capital insuficiente y riesgo de asignacion.

Campos a capturar:

| Campo | Valor |
|---|---:|
| Ticker (Empresa) | TSLA - Tesla |
| Precio Actual de la accion (USD) | 170.00 |
| Strike Price / Precio de Ejercicio (USD) | 190.00 |
| Prima por contrato (USD) | 8.00 |
| Numero de Contratos | 2 |
| Dias para la Expiracion | 14 |
| Capital Disponible del Usuario (USD) | 5,000.00 |

Resultado esperado:

| Validacion visual | Debe mostrar |
|---|---:|
| Veredicto | NO_VIABLE |
| Break-even Price | 182.00 |
| Margen Requerido | 7,600.00 USD |
| Prima Recibida | 1,600.00 USD |
| Warnings en rojo | Probabilidad alta de asignacion; Short Put esta In-The-Money; capital insuficiente para margen estimado; maxima perdida teorica de 36,400.00 USD |

---

## Checklist general de QA visual

- El veredicto debe usar color verde para VIABLE y rojo para NO_VIABLE.
- El Break-even Price debe aparecer como valor monetario y coincidir con la estrategia.
- En Long Call y Long Put, la UI debe restar o mostrar como costo la prima total pagada.
- En Short Call y Short Put, la UI debe mostrar margen requerido y prima recibida.
- Las advertencias deben aparecer debajo del panel de resultado o en la seccion de riesgo, con color rojo o estilo de alerta.
- Short Call siempre debe comunicar perdida potencial ilimitada.
- Short Put debe comunicar riesgo de asignacion y perdida maxima finita.
- Los valores monetarios deben respetar dos decimales cuando la UI lo permita.
