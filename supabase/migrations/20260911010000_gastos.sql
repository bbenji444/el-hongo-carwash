-- ============================================================================
-- El Hongo Car Wash — Fase 27: registro de gastos (sueldos, insumos,
-- servicios, etc.) para poder calcular la ganancia neta real del negocio,
-- no solo las ventas.
--
-- Es una tabla independiente de tickets/turnos a propósito: un gasto como
-- "Sueldos" o "Renta" normalmente no corresponde a un turno específico
-- (es semanal/mensual), así que se lleva como su propia bitácora con
-- fecha libre, y se resta de las ventas por período en Reportes — no se
-- resta de la "Ganancia" de cada turno individual.
-- ============================================================================

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  monto numeric(10, 2) not null check (monto > 0),
  fecha timestamptz not null default now(),
  notas text,
  creado_por uuid not null references public.usuarios (id),
  creado_en timestamptz not null default now()
);

create index gastos_fecha_idx on public.gastos (fecha);

alter table public.gastos enable row level security;

-- Mismo nivel de confianza que Inventario (insumos): dueño y encargado.
-- El cajero no ve nada de esto (ni siquiera lectura), igual que Reportes.
create policy gastos_select on public.gastos
for select using (public.usuario_rol() in ('dueno', 'encargado'));

create policy gastos_insert on public.gastos
for insert with check (public.usuario_rol() in ('dueno', 'encargado'));

create policy gastos_update on public.gastos
for update using (public.usuario_rol() in ('dueno', 'encargado'));

create policy gastos_delete on public.gastos
for delete using (public.usuario_rol() in ('dueno', 'encargado'));

alter table public.configuracion_app
  add column if not exists nav_gastos text not null default 'Gastos';
