-- ============================================================================
-- El Hongo Car Wash — Fase 18a: agrega Moto Chica y Moto Grande como
-- tamaños de vehículo (paso 1 de 2).
--
-- IMPORTANTE: Postgres no deja usar un valor de enum recién agregado
-- (ALTER TYPE ... ADD VALUE) dentro de la MISMA transacción en que se
-- agregó — hay que esperar a que ese ADD VALUE quede confirmado. Por eso
-- este cambio se parte en dos migraciones: esta primera solo agrega los
-- valores del enum y las columnas de emoji en Ajustes (no los usa
-- todavía); la siguiente
-- (20260902020000_moto_precios_seed.sql) ya los usa para sembrar precios.
--
-- Corre esta migración primero, confirma que no dio error, y HASTA
-- ENTONCES corre la siguiente.
-- ============================================================================

alter type tamano_vehiculo add value if not exists 'moto_chica';
alter type tamano_vehiculo add value if not exists 'moto_grande';

alter table public.configuracion_app
  add column if not exists emoji_moto_chica text not null default '🛵',
  add column if not exists emoji_moto_grande text not null default '🏍️';
