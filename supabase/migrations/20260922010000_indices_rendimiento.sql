-- ============================================================================
-- El Hongo Car Wash — Fase 39: índices que faltaban en las columnas que de
-- verdad se filtran/ordenan en casi cada página (Dashboard, Reportes,
-- Lavadores, Turnos, búsqueda de tickets): hora_entrada, estado, servicio_id
-- en tickets; creado_en en pagos; hora_cierre/estado en turnos. Sin estos
-- índices, cada una de esas consultas revisa la tabla completa de tickets
-- renglón por renglón — hoy no se nota tanto porque el negocio es joven,
-- pero es justo el tipo de cosa que se pone lenta sola conforme se
-- acumulan meses de historial, sin que nadie toque una línea de código.
-- ============================================================================

-- El filtro más común de toda la app es "estado = 'entregado' AND
-- hora_entrada >= X" (Dashboard, Reportes, Lavadores, búsqueda de tickets)
-- — un índice compuesto en ese orden sirve ese patrón directo, y de paso
-- cubre también las consultas que solo filtran por hora_entrada.
create index if not exists idx_tickets_estado_hora_entrada on public.tickets (estado, hora_entrada);

create index if not exists idx_tickets_servicio on public.tickets (servicio_id);

create index if not exists idx_pagos_creado_en on public.pagos (creado_en);

create index if not exists idx_turnos_estado on public.turnos (estado);
create index if not exists idx_turnos_hora_cierre on public.turnos (hora_cierre);
