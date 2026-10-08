-- ============================================================================
-- El Hongo Car Wash — Un ticket se cobra una sola vez. El código ya revisa
-- esto antes de insertar (ver registrarPago en tickets/actions.ts), pero
-- esta restricción es la garantía final a nivel de base de datos: hace
-- IMPOSIBLE que existan dos pagos para el mismo ticket, incluso si dos
-- peticiones llegaran al servidor al mismo tiempo exacto.
--
-- Seguro de correr: se verificó que, después de limpiar los 11 pagos
-- duplicados encontrados (ver _limpieza_pagos_duplicados.sql), CERO
-- tickets tienen más de un pago en el histórico real del negocio — así
-- que esta restricción no choca con ningún dato existente.
--
-- IMPORTANTE: corre primero el DELETE de _limpieza_pagos_duplicados.sql —
-- si corres esto antes, la restricción fallará al crearse porque los 11
-- duplicados todavía violarían la regla.
-- ============================================================================

alter table public.pagos
  add constraint pagos_ticket_id_unico unique (ticket_id);
