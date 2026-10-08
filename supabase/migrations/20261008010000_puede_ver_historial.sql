-- ============================================================================
-- Prepara el terreno para el futuro "histórico de movimientos" (logs de
-- auditoría) que va a vivir en el Dashboard, debajo del AI Assistant —
-- la tabla de movimientos todavía no existe, esto solo agrega el permiso
-- para controlar quién la va a poder ver cuando se construya: por ahora
-- solo Benjamin, el resto de las cuentas (aunque sean "dueno") no.
-- ============================================================================

alter table public.usuarios
  add column puede_ver_historial boolean not null default false;
