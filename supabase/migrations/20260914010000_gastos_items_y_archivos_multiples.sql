-- ============================================================================
-- El Hongo Car Wash — Fase 31: permite varios archivos por gasto (antes solo
-- uno) y agregar el detalle de productos de una compra ("orden de compra"):
-- en vez de registrar cada insumo como un gasto separado con su propia foto
-- del ticket, se registra UN gasto con varios renglones de producto
-- (gasto_items) y se sube el ticket de compra una sola vez (puede ser más de
-- un archivo). El monto del gasto se recalcula solo a partir de la suma de
-- sus renglones cuando tiene alguno, así que Reportes/Dashboard (que solo
-- suman gastos.monto) siguen funcionando sin tocarlos.
-- ============================================================================

-- Varios archivos por gasto ------------------------------------------------

create table public.gasto_archivos (
  id uuid primary key default gen_random_uuid(),
  gasto_id uuid not null references public.gastos (id) on delete cascade,
  archivo_path text not null,
  archivo_nombre text not null,
  archivo_tipo text,
  creado_en timestamptz not null default now()
);

create index gasto_archivos_gasto_id_idx on public.gasto_archivos (gasto_id);

alter table public.gasto_archivos enable row level security;

create policy gasto_archivos_select on public.gasto_archivos
for select using (public.usuario_rol() in ('dueno', 'encargado'));

create policy gasto_archivos_insert on public.gasto_archivos
for insert with check (public.usuario_rol() in ('dueno', 'encargado'));

create policy gasto_archivos_delete on public.gasto_archivos
for delete using (public.usuario_rol() in ('dueno', 'encargado'));

-- Migra los archivos que ya existían en las columnas viejas de gastos.
insert into public.gasto_archivos (gasto_id, archivo_path, archivo_nombre, archivo_tipo, creado_en)
select id, archivo_path, archivo_nombre, archivo_tipo, creado_en
from public.gastos
where archivo_path is not null;

alter table public.gastos
  drop column if exists archivo_path,
  drop column if exists archivo_nombre,
  drop column if exists archivo_tipo;

-- Detalle de productos de una compra (orden de compra) ---------------------

create table public.gasto_items (
  id uuid primary key default gen_random_uuid(),
  gasto_id uuid not null references public.gastos (id) on delete cascade,
  producto text not null,
  cantidad numeric(10, 2) not null check (cantidad > 0),
  precio_unitario numeric(10, 2) not null check (precio_unitario >= 0),
  creado_en timestamptz not null default now()
);

create index gasto_items_gasto_id_idx on public.gasto_items (gasto_id);
create index gasto_items_producto_idx on public.gasto_items (producto);

alter table public.gasto_items enable row level security;

create policy gasto_items_select on public.gasto_items
for select using (public.usuario_rol() in ('dueno', 'encargado'));

create policy gasto_items_insert on public.gasto_items
for insert with check (public.usuario_rol() in ('dueno', 'encargado'));

create policy gasto_items_update on public.gasto_items
for update using (public.usuario_rol() in ('dueno', 'encargado'));

create policy gasto_items_delete on public.gasto_items
for delete using (public.usuario_rol() in ('dueno', 'encargado'));

-- El monto del gasto se recalcula solo con la suma de sus renglones. Si se
-- borran todos los renglones no se toca el monto (se deja el último valor
-- válido — gastos.monto tiene check (monto > 0), no puede quedar en 0).
create or replace function public.gasto_items_recalcular_monto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gasto_id uuid := coalesce(new.gasto_id, old.gasto_id);
  v_total numeric(10, 2);
begin
  select coalesce(sum(cantidad * precio_unitario), 0) into v_total
  from public.gasto_items
  where gasto_id = v_gasto_id;

  if v_total > 0 then
    update public.gastos set monto = v_total where id = v_gasto_id;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger gasto_items_recalcular_monto_trg
after insert or update or delete on public.gasto_items
for each row execute function public.gasto_items_recalcular_monto();
