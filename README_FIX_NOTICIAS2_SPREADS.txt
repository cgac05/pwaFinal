Parche: Noticias 2 + autollenado de spreads desde Cadena de Opciones

Aplicacion:
  1. Copia este zip a la raiz del proyecto inversions_app_pwa-main.
  2. Ejecuta en PowerShell:
     Expand-Archive -Path "$env:USERPROFILE\Downloads\fix_noticias2_y_spreads_v3.zip" -DestinationPath "." -Force
  3. Reinicia backend y frontend.

Que arregla:
  - Noticias 2 ya no manda coresHabilitados vacio al backend cuando se usa solo ese chip.
  - Ejecutar con solo Noticias 2 activo abre el panel NewsSourcesAnalyzer sin romper la simulacion.
  - Al seleccionar un strike en la Cadena de Opciones, se guardan sugerencias de spreads con strikes vecinos.
  - Los modales Bull Call, Bear Put, Bull Put y Bear Call se autollenan con precio actual, strikes y primas.
