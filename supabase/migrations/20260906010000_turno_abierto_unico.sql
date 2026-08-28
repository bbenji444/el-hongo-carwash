-- ============================================================================
-- El Hongo Car Wash — Fase 22: garantiza que solo pueda existir un turno
-- abierto a la vez, a nivel de base de datos.
--
-- Antes nada impedía crear varios turnos con estado = 'abierto' al mismo
-- tiempo (solo se evitaba a medias desde la app). Cuando eso pasaba, la
-- consulta que busca "el" turno abierto (.maybeSingle(), que espera como
-- máximo una fila) fallaba, y la página se quedaba mostrando "no hay turno
-- abierto" aunque sí lo hubiera — el síntoma de "no me deja abrir turno".
--
-- IMPORTANTE: antes de correr esta migración debe quedar como mucho UN
-- turno con estado = 'abierto' en la tabla, si no, la creación del índice
-- va a fallar. Corre primero (en el mismo SQL Editor) el script de limpieza
-- que se compartió junto con esta migración.
-- ============================================================================

create unique index if not exists turnos_un_abierto
  on public.turnos (estado)
  where estado = 'abierto';
