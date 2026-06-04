FIX V4 - Noticias 2 separado de Noticias

Este parche corrige la mezcla entre el core "Noticias" (A_NOTICIAS) y el chip "Noticias 2".

Cambios:
- Noticias normal sigue usando NewsSection / news-team06.
- Noticias 2 vuelve a usar el modulo original de main: src/features/news.
- MainDashboard ya no manda props de Team06/Noticias al componente de Noticias 2.
- Noticias 2 recibe el ticker correcto con la prop symbol={selectedSymbol}; ya no cae al default SPY.
- Si ejecutas solo Noticias 2, no se manda A_NOTICIAS al backend; se crea una respuesta local vacia solo para desbloquear el panel de Noticias 2 sin romper la simulacion.

Aplicacion:
Expand-Archive -Path "$env:USERPROFILE\Downloads\fix_noticias2_original_v4.zip" -DestinationPath "." -Force

Luego reinicia backend y frontend.
