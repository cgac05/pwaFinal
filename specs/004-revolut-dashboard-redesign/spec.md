# Feature Specification: Rediseño del Dashboard Principal (Revolut Design System)

**Feature Branch**: `004-redesign-ui-ux`
**Created**: 2026-05-27
**Status**: Draft
**Input**: User description: "Mira, lo que voy a necesitar es que me ayudes a rediseñar el dashboard principal que tenemos, basándote en el sistema de diseño que tiene Revolut. Necesitamos que se mejore la experiencia de usuario y la interfaz de usuario también. Eso sería lo primero que necesitamos. (npx getdesign@latest add revolut)"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Primera impresión y orientación rápida (Priority: P1)

Un trader que abre el dashboard por primera vez entiende en menos de 10 segundos dónde están los elementos clave: el estado del portafolio, los instrumentos que sigue y las señales de confluencia activas, sin necesidad de leer etiquetas ni explorar menús.

**Why this priority**: La primera impresión define si el usuario percibe la herramienta como profesional y confiable. Un dashboard desordenado genera fricci n cognitiva que reduce la productividad y la confianza.

**Independent Test**: Se puede probar mostrando el dashboard a un trader sin onboarding y midiendo en cuántos segundos identifica correctamente los 3 elementos principales.

**Acceptance Scenarios**:

1. **Given** el usuario accede al dashboard, **When** visualiza la pantalla principal, **Then** puede identificar de forma inmediata: (a) el instrumento activo, (b) el timeframe seleccionado y (c) el nivel de confluencia de señales, sin necesidad de scrollear.
2. **Given** el dashboard está cargado, **When** el usuario mira la barra superior, **Then** el nombre de la aplicación, el estado de conexión y la última actualización son visibles con contraste suficiente en cualquier condición de luz.

---

### User Story 2 - Selección rápida de instrumento y timeframe (Priority: P1)

Un trader cambia de instrumento o timeframe con máximo 2 interacciones, sin perder el contexto visual de lo que estaba viendo.

**Why this priority**: El flujo más frecuente del usuario es cambiar entre instrumentos o timeframes. Cada fricción en este flujo tiene impacto directo en la velocidad de análisis.

**Independent Test**: Se puede probar completamente registrando el tiempo que tarda un usuario en cambiar de AAPL a NVDA y de 1d a 1h, entregando valor inmediato al ver el gráfico y señales actualizados.

**Acceptance Scenarios**:

1. **Given** el usuario está viendo señales de AAPL en 1d, **When** selecciona MSFT del listado de watchlist, **Then** el gráfico, los indicadores y la tabla de confluencia se actualizan sin recargar la página completa.
2. **Given** el usuario cambia el timeframe a 15m, **When** el cambio se aplica, **Then** los controles activos muestran claramente el nuevo timeframe seleccionado con un indicador de estado visible.
3. **Given** la carga de datos tarda más de 1 segundo, **When** el usuario espera, **Then** un skeleton loader coherente con el diseño reemplaza el contenido hasta que los datos están disponibles.

---

### User Story 3 - Lectura de señales de confluencia y evidencia (Priority: P2)

Un trader lee el nivel de confluencia de una señal y accede a su evidencia detallada con una sola interacción, sin perder la vista general del dashboard.

**Why this priority**: La lectura y validación de señales es la acción de mayor valor del sistema. La UX actual requiere múltiples scrolls y clics para conectar una señal con su evidencia.

**Independent Test**: Se puede probar completamente mostrando al usuario una señal activa y midiendo cuántas interacciones le toman acceder a los refs de evidencia del core más relevante.

**Acceptance Scenarios**:

1. **Given** hay señales de confluencia activas, **When** el usuario hace clic en una tarjeta de señal, **Then** se abre un panel lateral (o modal) con el desglose de evidencia sin salir del contexto del dashboard.
2. **Given** el panel de evidencia está abierto, **When** el usuario revisa las fuentes, **Then** cada core (Technical, Options, Institutional Flow, News, AI) tiene una sección visualmente diferenciada con color y jerarquía tipográfica consistente con el design system.
3. **Given** el usuario cierra el panel de evidencia, **When** vuelve a la vista principal, **Then** la posición de scroll y el estado de los filtros se mantienen exactamente como estaban.

---

### User Story 4 - Control de modos runtime y cores activos (Priority: P2)

Un trader activa y desactiva cores de análisis (Technical, Options, AI, etc.) y cambia entre modos Demo y Real con controles visualmente claros que indican el estado actual sin ambigüedad.

**Why this priority**: Activar accidentalmente el modo Real cuando se está en Demo (o viceversa) puede tener consecuencias graves. Los controles actuales no tienen suficiente jerarquía visual para evitar errores.

**Independent Test**: Se puede probar mostrando la UI a un usuario y preguntando qué modo está activo actualmente y qué cores están habilitados, sin que interactúe con los controles.

**Acceptance Scenarios**:

1. **Given** el usuario está en modo Demo, **When** mira los controles de runtime, **Then** el modo Demo está indicado con un badge de color diferenciado (no el mismo color que Real) y texto legible.
2. **Given** el usuario quiere cambiar al modo Real, **When** activa el toggle, **Then** se muestra una confirmación explícita antes de aplicar el cambio de modo.
3. **Given** 3 cores están activos y 2 inactivos, **When** el usuario mira los indicadores de cores, **Then** puede identificar de un vistazo cuáles están encendidos y cuáles apagados por color y estado visual, no solo por texto.

---

### User Story 5 - Lectura del dashboard en condiciones de poca luz (Priority: P3)

Un trader usa el dashboard en un entorno oscuro (sala de trading, noche) y puede leer todos los valores sin fatiga visual, con contrastes adecuados para el modo oscuro.

**Why this priority**: El perfil de usuario de este sistema trabaja frecuentemente en horarios extendidos y en entornos con poca luz. El modo oscuro no es un lujo sino una necesidad de accesibilidad práctica.

**Independent Test**: Se puede probar completamente usando el dashboard en modo oscuro durante 30 minutos y verificando que no hay texto con contraste insuficiente (WCAG AA mínimo).

**Acceptance Scenarios**:

1. **Given** el sistema está en modo oscuro, **When** el usuario revisa los valores numéricos (precios, scores, scores de confluencia), **Then** todos los valores tienen contraste mínimo de 4.5:1 contra el fondo.
2. **Given** el modo oscuro está activo, **When** aparecen estados de color (verde buy, rojo sell, amarillo neutral), **Then** los colores son visualmente distinguibles tanto en modo oscuro como en modo claro.

---

### Edge Cases

- ¿Qué muestra el dashboard cuando no hay señales activas para el instrumento seleccionado?
- ¿Cómo se comporta el layout cuando el nombre de un instrumento es muy largo (ej. opciones con strike/expiry)?
- ¿Qué sucede cuando la carga inicial falla y se muestra el estado de error? ¿Es legible y accionable en el nuevo diseño?
- ¿Cómo se adapta el layout cuando hay más de 8 instrumentos en el watchlist?
- ¿Qué pasa con la tabla de confluencia cuando hay 0 filas o más de 50 filas?

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE aplicar los tokens de diseño de Revolut (colores, tipografía, espaciado, border-radius, elevación) importados vía `npx getdesign@latest add revolut` a todos los componentes del dashboard principal.
- **FR-002**: El sistema DEBE mantener todas las funcionalidades existentes del dashboard (watchlist, gráfico, controles de timeframe, selector de cores, tabla de confluencia, panel de evidencia, modos runtime, simulación).
- **FR-003**: El dashboard DEBE tener una jerarquía visual clara con 3 zonas diferenciadas: navegación superior, panel de control lateral/superior y área de contenido principal.
- **FR-004**: Los estados interactivos (hover, focus, active, disabled) de todos los controles DEBEN ser visualmente distinguibles y coherentes con el design system de Revolut. El indicador de foco visible DEBE tener contraste mínimo de 3:1 contra el fondo adyacente (WCAG 2.1 SC 1.4.11 Non-text Contrast).
- **FR-005**: El sistema DEBE mostrar estados de carga (skeleton loaders) que reflejen la estructura del contenido que se está cargando, alineados con el design system.
- **FR-006**: El cambio entre modo Demo y modo Real DEBE requerir una confirmación explícita antes de aplicarse.
- **FR-007**: El panel de evidencia de señales DEBE poder abrirse como una capa sobre el dashboard sin navegar a otra página ni perder el contexto visual.
- **FR-008**: Los indicadores de cores activos DEBEN comunicar su estado (activo/inactivo) mediante color Y forma, no solo mediante texto.
- **FR-009**: El sistema DEBE cumplir contraste mínimo WCAG AA (4.5:1 para texto normal, 3:1 para texto grande) en modo oscuro y modo claro.
- **FR-010**: El layout DEBE ser funcional en viewports de ancho mínimo 1024px (desktop) y debe mantener usabilidad básica en 768px (tablet). En desktop el sidebar de watchlist es un panel fijo; en tablet (768px–1023px) el sidebar se oculta y se abre como drawer overlay mediante un control en la nav bar.
- **FR-011**: El sistema DEBE detectar automáticamente la preferencia de color del sistema operativo (`prefers-color-scheme: dark | light`) y aplicar el set de tokens correspondiente sin requerir intervención del usuario. No se provee toggle manual de tema.
- **FR-012**: El sistema DEBE incluir animaciones de micro-interacción en tres niveles: (a) transiciones de estado UI (hover, focus, active) en todos los controles interactivos; (b) motion en apertura/cierre de drawers y panel de evidencia; (c) micro-animaciones de valores numéricos (contadores animados al actualizarse scores y precios) y loaders con motion coherentes con el design system de Revolut. Las animaciones DEBEN respetar `prefers-reduced-motion` y deshabilitarse cuando el usuario lo solicite.
- **FR-013**: Las animaciones DEBEN ejecutarse a 60fps en el hardware target (desktop/laptop moderno) y NO deben bloquear la actualización de datos financieros en tiempo real.
- **FR-014**: Cada fila del WatchlistTree DEBE mostrar ticker, precio actual y porcentaje de cambio del día. El % de cambio DEBE estar coloreado en verde (positivo) o rojo (negativo) y actualizarse con micro-animación de contador cuando el valor cambia.

### Key Entities

- **Señal de confluencia**: Resultado del orquestador que agrega evidencia de múltiples cores para un instrumento y timeframe. Tiene: instrumento, verdict, score, referencias de evidencia por core.
- **Core de análisis**: Módulo de análisis (Technical, Options, Institutional Flow, News, AI) que puede estar activo o inactivo. Afecta qué señales se generan.
- **Instrumento**: Ticker financiero (ej. AAPL, MSFT, SPY) que el usuario sigue en su watchlist. En la lista se muestra con precio actual y % de cambio del día actualizado en tiempo real.
- **Modo runtime**: Estado del sistema (Demo vs Real, Online vs Offline) que determina qué fuentes de datos y credenciales se usan.
- **Token de diseño**: Variable de diseño del design system (color, tipografía, espaciado) que garantiza consistencia visual entre componentes.

---

## Experience & Component Contract *(required for UI-heavy features)*

### Target UX

- **Reference Experience**: Revolut-like financial dashboard — limpio, tipografía bold para valores clave, colores de estado saturados y contrastados, tarjetas con elevación sutil, micro-animaciones fluidas en controles, contadores y loaders. El tema (oscuro/claro) se adapta automáticamente a la preferencia del sistema operativo (`prefers-color-scheme`) sin toggle manual.
- **Primary User Workspace**: Single-screen cockpit con sidebar de watchlist, área central de gráfico + señales, y panel deslizante de evidencia. Sin tabs ni rutas adicionales para el flujo principal.

### Control-by-Field Contract

- **Watchlist / Selector de instrumento**: Lista vertical compacta donde cada fila muestra: ticker (bold), precio actual y % de cambio del día (coloreado: verde si positivo, rojo si negativo). Al hacer clic en una fila se actualiza el área principal sin navegación. En desktop (≥1024px) es un panel fijo lateral; en tablet (768px–1023px) se oculta y se abre como drawer overlay mediante un botón en la nav bar. El drawer se cierra al seleccionar un instrumento o al hacer clic fuera. El precio y % de cambio se actualizan en tiempo real cuando hay nuevos datos disponibles, con micro-animación de contador al cambiar.
- **Timeframe selector**: Pill group (botones segmentados tipo Revolut: 15m / 1h / 4h / 1d) con estado activo claramente marcado.
- **Cores activos**: Toggle chips con color de acento cuando están activos, gris apagado cuando inactivos. Texto + ícono (no solo texto).
- **Modo runtime (Demo / Real / Online / Offline)**: Badge en la nav bar con color semafórico. Cambio de modo vía switch con confirmación modal.
- **Tabla de confluencia**: Data table con columnas configurables, celdas de estado coloreadas (buy/sell/neutral), scroll horizontal en viewports pequeños.
- **Gráfico principal (SuperChart)**: Panel card de altura fija mínima (380px), sin chrome adicional del contenedor para maximizar área de gráfico. Los tokens de Revolut se aplican únicamente al contenedor (fondo, borde, padding de la card); los colores internos del chart (velas, grid, indicadores, overlays) no se modifican.
- **Panel de evidencia**: Drawer lateral (slide-in desde la derecha) que se abre sin salir del contexto. Cierre con ESC o clic fuera.
- **Indicador de última actualización**: Texto pequeño muted en la nav bar. Sin badge animado que distraiga.

### Runtime Modes & Source Selection

- **Modo Online/Demo**: Fuentes de datos de cuentas demo por broker. Badge color azul o índigo.
- **Modo Online/Real**: Fuentes de datos de cuentas reales con controles de riesgo. Badge color naranja o ámbar con icono de advertencia. Requiere confirmación para activar.
- **Modo Offline**: Lectura solo desde cache/Supabase local. Badge color gris. Controles de edición deshabilitados.
- **Carga inicial**: Skeleton loaders que replican la estructura de las tarjetas mientras se obtienen datos del orquestador.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario nuevo identifica correctamente los 3 elementos principales del dashboard (instrumento activo, timeframe, nivel de confluencia) en menos de 10 segundos, en prueba con 5 usuarios.
- **SC-002**: El flujo de cambio de instrumento (watchlist → gráfico actualizado) se completa en máximo 2 interacciones, medido en prueba de usabilidad.
- **SC-003**: Todos los textos y valores numéricos del dashboard cumplen contraste mínimo WCAG AA (4.5:1) tanto en modo claro como en modo oscuro, verificado con herramienta de contraste.
- **SC-004**: La tasa de errores de modo (usuario activa Real cuando quería Demo o viceversa) se reduce al 0% gracias al modal de confirmación y la diferenciación visual de badges.
- **SC-005**: El dashboard mantiene el 100% de las funcionalidades existentes después del rediseño, verificado por la suite de tests existente sin regresiones.
- **SC-006**: El tiempo para acceder a la evidencia de una señal (desde clic en tarjeta hasta ver refs de evidencia) se reduce a 1 interacción, medido por conteo de clics en el flujo rediseñado vs. el actual.
- **SC-007**: Las animaciones de micro-interacción se ejecutan a 60fps sin frame drops perceptibles durante actualizaciones de datos, verificado en hardware desktop moderno con DevTools performance profiler.
- **SC-008**: Todas las animaciones están deshabilitadas cuando el usuario tiene activado `prefers-reduced-motion`, verificado con emulación en DevTools.

---

## Clarifications

### Session 2026-05-27

- Q: ¿El dashboard debe soportar dark mode forzado, un toggle manual, o seguir la preferencia del sistema operativo? → A: Sigue la preferencia del sistema operativo (`prefers-color-scheme`) sin toggle manual.
- Q: ¿El redesign aplica tokens de Revolut al interior del SuperChart (velas, grid, overlays) o solo al contenedor/wrapper? → A: Solo al contenedor — fondo de la card, borde y padding; los internos del chart (colores de velas, grid, overlays) no se modifican.
- Q: ¿Cómo se comporta el sidebar de watchlist en viewport tablet (768px–1023px)? → A: Se oculta y es accesible vía botón/drawer overlay (hamburger o icono de lista en la nav bar).
- Q: ¿Qué alcance tienen las animaciones y micro-interacciones en el rediseño? → A: Alcance completo — transiciones de UI (hover, focus, apertura/cierre de drawers) + micro-animaciones (contadores numéricos animados, loaders con motion, transiciones entre vistas).
- Q: ¿Qué información muestra cada fila del WatchlistTree? → A: Ticker + precio actual + % cambio del día (patrón Revolut estándar para listas de activos).

---

## Assumptions

- Se asume que `npx getdesign@latest add revolut` provee los tokens de diseño (colores, tipografía, espaciado) en un formato compatible con el proyecto (CSS variables o equivalente) y que los tokens son aplicables directamente sin necesidad de adaptación manual significativa.
- Se asume que el redesign es principalmente visual/UX y no incluye cambios en la lógica de negocio, APIs ni el modelo de datos.
- Se asume que el soporte móvil completo (< 768px) queda fuera del alcance de esta feature; el mínimo soportado es tablet (768px) y el target principal es desktop (1024px+).
- El tema de color (oscuro/claro) no tiene toggle manual; responde automáticamente a `prefers-color-scheme` del sistema operativo del usuario. No se persiste ninguna preferencia adicional en el cliente.
- Se asume que los componentes existentes (SuperChart, WatchlistTree, ConfluenceSignalsTable, etc.) se mantienen funcionales y solo se les aplica el nuevo skin; no se reescriben desde cero.
- Se asume que la suite de tests existente (dashboard.test.tsx, confluenceSignalsTable.test.tsx, etc.) continúa siendo válida y pasa sin modificaciones a los tests mismos.
