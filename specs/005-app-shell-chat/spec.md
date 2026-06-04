# Feature Specification: App Shell VS Code — Navigation + AI Chat Panel

**Feature Branch**: `005-app-shell-chat`  
**Created**: 2026-05-28  
**Status**: Draft  
**Input**: User description: "Panel estilo VS Code con 4 zonas: Activity bar, Left panel colapsable, Dashboard central, Chat panel IA derecho"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Navegar entre secciones desde la barra de actividad (Priority: P1)

El usuario puede cambiar el contenido del panel izquierdo haciendo clic en uno de los tres íconos de la barra de actividad: Watchlist, Análisis o Estrategias. El panel izquierdo refleja instantáneamente la sección seleccionada.

**Why this priority**: Es la acción de navegación principal del nuevo layout. Sin ella, el resto del panel izquierdo no tiene utilidad.

**Independent Test**: Se puede probar completamente cargando el dashboard y haciendo clic en cada ícono de la barra de actividad; cada uno debe mostrar contenido distinto en el panel izquierdo.

**Acceptance Scenarios**:

1. **Given** el dashboard está cargado, **When** el usuario hace clic en el ícono "Watchlist", **Then** el panel izquierdo muestra la vista de Watchlist con buscador de tickers y árbol de precios/porcentajes.
2. **Given** el panel izquierdo muestra Watchlist, **When** el usuario hace clic en "Análisis", **Then** el panel izquierdo cambia a los chips de categorías de análisis sin recargar la página.
3. **Given** el panel izquierdo muestra Análisis, **When** el usuario hace clic en "Estrategias", **Then** el panel izquierdo muestra las cards de estrategias de opciones disponibles.
4. **Given** cualquier sección activa, **When** el usuario hace clic en el ícono ya activo, **Then** el panel izquierdo se colapsa (toggle); un segundo clic lo expande.

---

### User Story 2 — Gestionar y usar el Watchlist (Priority: P2)

El usuario puede buscar un ticker en el buscador del panel Watchlist, agregar nuevos tickers a su lista, quitar tickers existentes, y ver un árbol con el precio actual y el cambio porcentual de cada instrumento seguido.

**Why this priority**: El Watchlist es el punto de entrada más frecuente del usuario para seleccionar el instrumento activo del dashboard; poder curar la lista lo hace significativamente más útil.

**Independent Test**: Activar sección Watchlist, agregar un ticker, verificar que aparece en el árbol, luego quitarlo y verificar que desaparece.

**Acceptance Scenarios**:

1. **Given** la sección Watchlist está activa, **When** el usuario escribe parte de un símbolo en el buscador, **Then** el árbol filtra y muestra solo los instrumentos que coinciden.
2. **Given** el árbol tiene instrumentos, **When** el usuario hace clic en uno, **Then** el dashboard central actualiza el instrumento activo a ese ticker.
3. **Given** el usuario no escribe nada en el buscador, **When** ve el árbol, **Then** aparecen todos los instrumentos de su watchlist con precio actual y cambio % del día.
4. **Given** el usuario escribe un símbolo en el buscador, **When** hace clic en "Agregar" o presiona Enter, **Then** el ticker se añade al árbol del watchlist.
5. **Given** un ticker está en el árbol, **When** el usuario activa la opción de eliminarlo (por ejemplo, con un botón de quitar en la fila), **Then** el ticker desaparece del árbol sin afectar el instrumento activo del dashboard.

---

### User Story 3 — Seleccionar categoría de análisis para filtrar el dashboard (Priority: P3)

El usuario puede elegir entre cinco categorías de análisis — Técnico, Institucional, Fundamental, Noticias, IA — usando chips en el panel izquierdo. El chip activo filtra el dashboard central: solo se muestran las secciones del dashboard que pertenecen a esa categoría; el resto se oculta.

**Why this priority**: Permite al usuario enfocar el dashboard en su metodología de inversión, reduciendo el ruido visual de secciones no relevantes.

**Independent Test**: Activar sección Análisis, hacer clic en el chip "Técnico" y verificar que el dashboard muestra únicamente las secciones técnicas y oculta las demás.

**Acceptance Scenarios**:

1. **Given** la sección Análisis está activa, **When** el usuario hace clic en el chip "Técnico", **Then** ese chip queda resaltado como activo y el dashboard central oculta las secciones no técnicas.
2. **Given** un chip de análisis está activo, **When** el usuario hace clic en otro chip, **Then** el nuevo chip queda activo, el dashboard muestra las secciones correspondientes a la nueva categoría y oculta el resto.
3. **Given** ningún chip está activo, **When** la sección Análisis se abre, **Then** el primer chip ("Técnico") queda seleccionado por defecto y el dashboard aplica el filtro técnico.
4. **Given** el usuario estaba en otra sección (Watchlist o Estrategias) y regresa a Análisis, **When** el panel se muestra, **Then** el dashboard recupera el filtro del último chip activo seleccionado en esa sesión.

---

### User Story 4 — Explorar estrategias de opciones (Priority: P4)

El usuario puede ver una lista de estrategias de opciones disponibles (Iron Condor, Collar Put, Married Put) como cards en el panel izquierdo, y hacer clic en una para ver su descripción o configurarla.

**Why this priority**: Añade una capa de descubrimiento de estrategias sin ocupar espacio en el dashboard principal.

**Independent Test**: Activar sección Estrategias y verificar que las tres cards se muestran con nombre e icono descriptivo.

**Acceptance Scenarios**:

1. **Given** la sección Estrategias está activa, **When** el usuario ve el panel, **Then** aparecen cards para Iron Condor, Collar Put y Married Put.
2. **Given** las cards de estrategias están visibles, **When** el usuario hace clic en una card, **Then** se muestra un resumen o detalle de esa estrategia.

---

### User Story 5 — Consultar al asistente de IA sobre el instrumento activo (Priority: P2)

El usuario puede abrir el panel de chat de la derecha y hacerle preguntas al asistente de IA. El asistente conoce el instrumento y el timeframe activos en el dashboard, y el historial de la conversación se conserva durante la sesión.

**Why this priority**: El chat IA es el diferenciador más valioso del producto; conectar el contexto del instrumento lo hace inmediatamente útil.

**Independent Test**: Abrir el panel de chat, escribir una pregunta sobre el instrumento activo y verificar que la respuesta del asistente hace referencia al símbolo/timeframe correcto.

**Acceptance Scenarios**:

1. **Given** el panel de chat está abierto y hay un instrumento activo en el dashboard, **When** el usuario envía una pregunta, **Then** el asistente responde tomando en cuenta el símbolo y timeframe actuales.
2. **Given** el usuario ha tenido una conversación en el chat, **When** navega a otra sección del dashboard y vuelve al chat, **Then** el historial de mensajes sigue visible.
3. **Given** el usuario envía un mensaje, **When** el asistente está procesando, **Then** se muestra un indicador de carga, el campo de texto queda deshabilitado y el botón de envío se desactiva hasta que llega la respuesta o se produce un error.
4. **Given** el panel de chat está abierto, **When** el usuario cambia el instrumento activo en el dashboard, **Then** el badge de contexto en el chat se actualiza al nuevo símbolo/timeframe.

---

### User Story 6 — Colapsar paneles para maximizar el espacio del dashboard (Priority: P3)

El usuario puede colapsar el panel izquierdo y/o el panel derecho de chat para tener más espacio visual para el dashboard central.

**Why this priority**: En pantallas más pequeñas o cuando el usuario no necesita los paneles, poder colapsarlos mejora la experiencia de análisis.

**Independent Test**: Hacer clic en el control de colapso de cada panel y verificar que el dashboard central se expande.

**Acceptance Scenarios**:

1. **Given** el panel izquierdo está expandido, **When** el usuario lo colapsa, **Then** el dashboard central ocupa el espacio liberado y la barra de actividad permanece visible.
2. **Given** el panel derecho de chat está expandido, **When** el usuario lo colapsa, **Then** el dashboard central ocupa el espacio liberado.
3. **Given** ambos paneles están colapsados, **When** el usuario expande uno, **Then** el dashboard ajusta su ancho correspondientemente.

---

### Edge Cases

- ¿Qué pasa si el asistente de IA no responde o hay un error de red? → Mostrar mensaje de error amigable con opción de reintentar.
- ¿Qué pasa si no hay instrumento activo cuando el usuario abre el chat? → El asistente responde en modo general, sin contexto de instrumento.
- ¿Qué pasa si la pantalla es muy pequeña (tablet/móvil)? → Los paneles laterales se muestran como overlays (drawers) sobre el dashboard central en lugar de reducirlo.
- ¿Qué pasa si el usuario escribe en el buscador de Watchlist y no hay resultados? → Mostrar estado vacío con mensaje "Sin resultados para [término]".
- ¿Qué pasa si el usuario intenta agregar un ticker que ya está en su watchlist? → Mostrar mensaje informativo y no duplicarlo en el árbol.
- ¿Qué pasa si el usuario intenta agregar un símbolo inválido o inexistente? → Mostrar mensaje de error y no añadirlo al árbol.
- ¿Qué pasa si el historial del chat crece mucho? → El panel hace scroll hacia abajo automáticamente al recibir nuevas respuestas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mostrar una barra de actividad vertical fija a la izquierda con tres íconos de navegación: Watchlist, Análisis y Estrategias.
- **FR-002**: El sistema DEBE cambiar el contenido del panel izquierdo según el ícono activo en la barra de actividad.
- **FR-003**: El panel izquierdo DEBE poder colapsarse y expandirse. Cuando está colapsado, la barra de actividad permanece visible.
- **FR-004**: La sección Watchlist DEBE incluir un campo de búsqueda de tickers, un árbol con precio actual y cambio porcentual diario de cada instrumento, y controles para agregar nuevos tickers por símbolo y eliminar tickers existentes.
- **FR-005**: La sección Análisis DEBE incluir chips de selección para las categorías: Técnico, Institucional, Fundamental, Noticias e IA. Solo un chip puede estar activo a la vez. Al seleccionar un chip, el dashboard central DEBE ocultar las secciones que no pertenecen a esa categoría y mostrar únicamente las que sí pertenecen.
- **FR-006**: La sección Estrategias DEBE mostrar cards para al menos tres estrategias de opciones: Iron Condor, Collar Put y Married Put.
- **FR-007**: El sistema DEBE mostrar un panel de chat de IA a la derecha del dashboard central, colapsable por el usuario.
- **FR-008**: El chat de IA DEBE enviar con cada mensaje el símbolo y timeframe del instrumento activo como contexto.
- **FR-009**: El historial de mensajes del chat DEBE persistir durante toda la sesión del usuario; al recargar la página el historial puede perderse.
- **FR-010**: El sistema DEBE mostrar un indicador visual mientras el asistente de IA procesa una respuesta, y DEBE deshabilitar el campo de texto y el botón de envío durante ese tiempo. Ambos se reactivan al recibir la respuesta o al producirse un error.
- **FR-011**: El chat DEBE mostrar un badge o etiqueta indicando el instrumento activo al momento de cada consulta.
- **FR-012**: El dashboard central DEBE funcionar sin cambios en sus capacidades existentes; el nuevo layout lo envuelve sin alterarlo.
- **FR-013**: En pantallas de tablet, los paneles izquierdo y de chat DEBEN mostrarse como overlays (drawers) en lugar de reducir el área del dashboard.
- **FR-014**: El sistema DEBE validar que el símbolo ingresado al agregar un ticker al Watchlist existe o es reconocible antes de añadirlo a la lista; si es inválido, debe mostrar un mensaje de error.
- **FR-015**: El sistema DEBE persistir entre sesiones del navegador: (a) la sección activa en la barra de actividad, (b) el estado colapsado/expandido del panel izquierdo, y (c) el estado colapsado/expandido del panel de chat. Al recargar o reabrir el navegador, el layout debe restaurar la última configuración del usuario.
- **FR-016**: Los íconos de la barra de actividad DEBEN ser alcanzables mediante la tecla Tab y activables con Enter o Space. El resto de los controles de los paneles puede depender del comportamiento nativo del navegador.

### Key Entities

- **Instrumento activo**: El ticker y timeframe seleccionados actualmente en el dashboard; es el contexto compartido entre el dashboard y el chat.
- **Mensaje de chat**: Un intercambio usuario–asistente; contiene texto del usuario, respuesta del asistente, y el contexto del instrumento al momento del envío.
- **Ítem de Watchlist**: Un instrumento financiero seguido por el usuario; tiene símbolo, precio actual y cambio porcentual del día. El usuario puede agregar y eliminar ítems.

## Experience & Component Contract *(required for UI-heavy features)*

### Target UX

- **Reference Experience**: VS Code — barra de actividad izquierda + panel lateral colapsable + área principal + panel lateral derecho colapsable.
- **Primary User Workspace**: Split-view de 4 zonas con dashboard central como protagonista; los paneles laterales son auxiliares que no compiten con el área principal.

### Control-by-Field Contract

- **Barra de actividad**: Íconos verticales (48 px de ancho); clic en ícono activo colapsa el panel, clic en ícono inactivo cambia la sección y expande el panel si estaba colapsado.
- **Panel izquierdo — Watchlist**: Campo de búsqueda/agregar + botón "Agregar" + árbol con filas (símbolo | precio | cambio% | botón quitar); clic en fila activa el instrumento en el dashboard central; botón quitar elimina el ticker del árbol.
- **Panel izquierdo — Análisis**: Chips horizontales (uno activo a la vez); clic en chip cambia el filtro de análisis activo y oculta/muestra secciones correspondientes en el dashboard central.
- **Panel izquierdo — Estrategias**: Cards verticales apiladas (nombre + breve descripción); clic en card muestra detalle de la estrategia.
- **Panel de chat**: Historial de mensajes con scroll + campo de texto + botón de envío; badge de contexto muestra símbolo/timeframe activo.
- **Badge de contexto**: Etiqueta no interactiva en el encabezado del chat; se actualiza cuando cambia el instrumento activo en el dashboard.

### Runtime Modes & Source Selection

- **Panel visible**: Los paneles izquierdo y de chat están expandidos; el dashboard central ocupa el espacio restante.
- **Panel colapsado**: Uno o ambos paneles están ocultos; el dashboard central se expande para ocupar el espacio liberado.
- **Modo tablet**: Los paneles se muestran como drawers overlay sobre el dashboard; el dashboard siempre ocupa el 100% del ancho disponible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El usuario puede cambiar de sección (Watchlist → Análisis → Estrategias) en menos de 1 segundo sin recarga de página.
- **SC-002**: El usuario puede colapsar o expandir cualquier panel lateral en menos de 300 ms de respuesta visual.
- **SC-003**: El asistente de IA devuelve una respuesta en menos de 10 segundos para el 90% de las consultas.
- **SC-004**: El historial del chat permanece intacto durante toda la sesión (navegación entre secciones, cambio de instrumento).
- **SC-005**: El dashboard central no pierde ninguna funcionalidad existente al integrarse en el nuevo layout (0 regresiones funcionales).
- **SC-006**: El layout se adapta correctamente a pantallas de tablet sin romper la usabilidad del dashboard central.
- **SC-007**: El badge de contexto en el chat refleja el instrumento activo correcto dentro de los 500 ms posteriores al cambio.
- **SC-008**: Al recargar o reabrir el navegador, el layout restaura la última configuración de paneles del usuario (sección activa, estado colapsado/expandido) en menos de 300 ms.

## Assumptions

- El sistema de autenticación existente se reutiliza sin cambios; el chat IA hereda la sesión autenticada.
- El endpoint de chat existente está disponible y acepta las consultas con contexto de instrumento; no se requieren cambios en el backend.
- El estado del instrumento activo (símbolo y timeframe) ya está disponible globalmente en la aplicación y puede ser consumido por el panel de chat.
- El soporte móvil (smartphones) está fuera del alcance de esta feature; el diseño responsive cubre únicamente tablets y escritorio.
- Las estrategias de opciones mostradas (Iron Condor, Collar Put, Married Put) son un catálogo inicial fijo; la gestión dinámica de estrategias queda fuera del alcance.
- El usuario puede agregar y eliminar tickers del Watchlist desde el panel izquierdo; la persistencia de la lista entre sesiones se apoya en el mecanismo de estado existente de la aplicación. La sincronización con servicios externos de precios en tiempo real no está en el alcance de esta feature.
- La arquitectura del nuevo layout (AppShell) envuelve el dashboard existente sin modificar su lógica interna.

## Clarifications

### Session 2026-05-28

- Q: ¿El panel Watchlist es de solo lectura, o permite al usuario agregar/quitar tickers? → A: Gestión básica — permite agregar tickers nuevos por símbolo y eliminar existentes.
- Q: ¿Qué hace el chip de análisis seleccionado en el dashboard central? → A: Filtro de sección — el dashboard oculta/muestra secciones según la categoría activa.
- Q: ¿Puede el usuario enviar un nuevo mensaje de chat mientras el asistente aún está respondiendo? → A: Input bloqueado — el campo y botón se deshabilitan hasta recibir la respuesta.
- Q: ¿El estado de los paneles (sección activa, colapsado/expandido) persiste entre sesiones del navegador? → A: Persiste entre sesiones — el layout recuerda la última configuración al reabrir el navegador.
- Q: ¿Debe la barra de actividad soportar navegación por teclado? → A: Solo barra de actividad — íconos alcanzables por Tab y activables con Enter/Space; resto usa comportamiento nativo del navegador.
