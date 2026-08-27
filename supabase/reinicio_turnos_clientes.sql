-- ============================================================================
-- El Hongo Car Wash — Reinicio de turnos y clientes para el arranque real
-- del sistema (día de inauguración).
--
-- ADVERTENCIA: BORRA PERMANENTEMENTE, sin posibilidad de recuperación:
--   - Todos los pagos
--   - Todos los tickets
--   - Todos los turnos (caja) — incluye cualquier turno abierto ahora mismo
--   - Todos los clientes (sus vehículos se borran en cascada junto con
--     ellos)
--
-- NO TOCA (se conserva tal cual):
--   - Cuentas de usuarios (dueño/encargado/cajero)
--   - Inventario de productos
--   - Lavadores registrados
--   - Catálogo de paquetes y sus precios por tamaño de vehículo
--   - La configuración de Ajustes
-- ============================================================================

begin;

delete from public.pagos;
delete from public.tickets;
delete from public.turnos;
delete from public.clientes;

commit;
