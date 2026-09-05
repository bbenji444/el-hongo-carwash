-- ============================================================================
-- El Hongo Car Wash — Fase 35: registro de ingresos extra (pensiones de
-- estacionamiento u otros ingresos que no vienen de un ticket de lavado).
--
-- Mismo patrón que Gastos (tabla independiente, mismo nivel de permisos):
-- se resta de las ventas por período en Reportes con los gastos, no de la
-- "Ganancia" de cada turno individual.
-- ============================================================================

create table public.ingresos_extra (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  monto numeric(10, 2) not null check (monto > 0),
  fecha timestamptz not null default now(),
  notas text,
  creado_por uuid not null references public.usuarios (id),
  creado_en timestamptz not null default now()
);

create index ingresos_extra_fecha_idx on public.ingresos_extra (fecha);

alter table public.ingresos_extra enable row level security;

create policy ingresos_extra_select on public.ingresos_extra
for select using (public.usuario_rol() in ('dueno', 'encargado'));

create policy ingresos_extra_insert on public.ingresos_extra
for insert with check (public.usuario_rol() in ('dueno', 'encargado'));

create policy ingresos_extra_update on public.ingresos_extra
for update using (public.usuario_rol() in ('dueno', 'encargado'));

create policy ingresos_extra_delete on public.ingresos_extra
for delete using (public.usuario_rol() in ('dueno', 'encargado'));

alter table public.configuracion_app
  add column if not exists nav_ingresos text not null default 'Ingresos extra';
