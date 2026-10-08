-- ============================================================================
-- Permite EDITAR/ELIMINAR renglones del histórico de movimientos — pero
-- únicamente desde la cuenta de Benjamin. Hasta ahora historial_movimientos
-- solo tenía políticas de SELECT e INSERT; sin una política de UPDATE/DELETE,
-- Postgres las bloquea para todos por default en una tabla con RLS activado.
-- Esto es a propósito más estricto que "quien tenga puede_ver_historial":
-- Pepe puede VER el histórico, pero no puede editarlo ni borrarlo — solo
-- Benjamin.
-- ============================================================================

create policy historial_movimientos_update on public.historial_movimientos
for update using (auth.uid() = '3069df5a-d7c0-4f0a-8b6e-7d8914f13a51');

create policy historial_movimientos_delete on public.historial_movimientos
for delete using (auth.uid() = '3069df5a-d7c0-4f0a-8b6e-7d8914f13a51');
