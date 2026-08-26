-- ============================================================================
-- El Hongo Car Wash — Deja el sistema en blanco para entregarlo al cliente
-- final (como recién instalado, sin datos de prueba).
--
-- ADVERTENCIA: BORRA PERMANENTEMENTE, sin posibilidad de recuperación:
--   - Todos los pagos
--   - Todos los tickets
--   - Todos los turnos (caja) — incluye cualquier turno abierto ahora mismo
--   - Todos los clientes (sus vehículos se borran en cascada junto con ellos)
--   - Todos los insumos de inventario (sus recetas de consumo por paquete
--     se borran en cascada junto con ellos)
--
-- NO TOCA (se conserva tal cual):
--   - Cuentas de usuarios (dueño/encargado/cajero) — nadie se queda sin
--     poder entrar
--   - Lavadores registrados
--   - Catálogo de paquetes y sus precios por tamaño de vehículo
--   - La configuración de Ajustes (textos, emojis, colores, semáforo)
-- ============================================================================

begin;

delete from public.pagos;
delete from public.tickets;
delete from public.turnos;
delete from public.clientes;
delete from public.inventario;

commit;
