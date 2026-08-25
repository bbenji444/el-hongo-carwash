-- ============================================================================
-- El Hongo Car Wash — Fase 12: paquetes reales con precio por tamaño de vehículo.
--
-- El negocio realmente vende 4 paquetes (Básico, Plus, Hongo Premium, Hongo
-- Max), cada uno con un precio distinto según el tamaño del vehículo
-- (Automóvil, Camioneta Chica, Camioneta Grande, Camioneta Extra Grande) —
-- ver el rótulo físico del negocio. El catálogo anterior solo soportaba un
-- precio único por servicio, así que no se podía representar esa matriz.
--
-- Cambios:
--   1. Nuevo enum tamano_vehiculo.
--   2. servicios_catalogo pierde `precio` (columna única) y gana
--      descripcion/caracteristicas/orden/destacado para poder mostrar cada
--      paquete igual que en el rótulo.
--   3. Nueva tabla servicios_precios: un renglón por (servicio, tamaño).
--   4. tickets gana tamano_vehiculo (obligatorio): el tamaño elegido al
--      levantar el ticket, del que depende qué precio de servicios_precios
--      aplica. Los servicios existentes se migran conservando su precio
--      anterior igual en los 4 tamaños, para no romper tickets ya abiertos.
--   5. El trigger de lealtad (6ta lavada gratis), que leía precio directo de
--      servicios_catalogo, se actualiza para leer de servicios_precios según
--      el tamaño del ticket.
--   6. Se insertan los 4 paquetes reales con sus precios reales.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tamano_vehiculo') then
    create type tamano_vehiculo as enum (
      'automovil',
      'camioneta_chica',
      'camioneta_grande',
      'camioneta_extra_grande'
    );
  end if;
end $$;

alter table public.servicios_catalogo
  add column if not exists descripcion text,
  add column if not exists caracteristicas text[] not null default '{}',
  add column if not exists orden integer not null default 0,
  add column if not exists destacado boolean not null default false;

create table if not exists public.servicios_precios (
  id uuid primary key default gen_random_uuid(),
  servicio_id uuid not null references public.servicios_catalogo (id) on delete cascade,
  tamano_vehiculo tamano_vehiculo not null,
  precio numeric(10, 2) not null check (precio > 0),
  unique (servicio_id, tamano_vehiculo)
);

create index if not exists idx_servicios_precios_servicio on public.servicios_precios (servicio_id);

alter table public.servicios_precios enable row level security;

drop policy if exists servicios_precios_select on public.servicios_precios;
create policy servicios_precios_select on public.servicios_precios
for select using (public.usuario_rol() is not null);

drop policy if exists servicios_precios_insert_dueno on public.servicios_precios;
create policy servicios_precios_insert_dueno on public.servicios_precios
for insert with check (public.usuario_rol() = 'dueno');

drop policy if exists servicios_precios_update_dueno on public.servicios_precios;
create policy servicios_precios_update_dueno on public.servicios_precios
for update using (public.usuario_rol() = 'dueno') with check (public.usuario_rol() = 'dueno');

drop policy if exists servicios_precios_delete_dueno on public.servicios_precios;
create policy servicios_precios_delete_dueno on public.servicios_precios
for delete using (public.usuario_rol() = 'dueno');

-- Migra el precio único de cada servicio existente a los 4 tamaños, para que
-- ningún servicio ya creado (ni ticket abierto que lo referencia) se quede
-- sin precio al quitar la columna vieja. Envuelto en el IF (en vez de SQL
-- plano) porque, si esta migración ya se corrió parcialmente antes y la
-- columna `precio` ya no existe, un SELECT sc.precio suelto rompería con
-- "column does not exist"; plpgsql solo valida cada sentencia hasta que le
-- toca ejecutarse, así que este chequeo la protege también en un reintento.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'servicios_catalogo' and column_name = 'precio'
  ) then
    insert into public.servicios_precios (servicio_id, tamano_vehiculo, precio)
    select sc.id, tv.tamano, sc.precio
    from public.servicios_catalogo sc
    cross join (select unnest(enum_range(null::tamano_vehiculo)) as tamano) tv
    on conflict (servicio_id, tamano_vehiculo) do nothing;

    alter table public.servicios_catalogo drop column precio;
  end if;
end $$;

alter table public.tickets add column if not exists tamano_vehiculo tamano_vehiculo;

-- Un UPDATE normal sobre tickets dispara tr_ticket_descuento_autorizado en
-- cada fila existente: ese trigger recalcula desde cero la elegibilidad de
-- la 6ta lavada gratis con los datos de HOY, y para un ticket viejo que ya
-- traía un descuento de lealtad (o autorizado) esa relectura puede no
-- volver a cumplirse y el trigger rechaza el UPDATE completo con "requiere
-- autorizacion". Se desactiva solo mientras dura este backfill puntual
-- (mismo patrón que usa supabase/seed_demo_datos.sql).
alter table public.tickets disable trigger tr_ticket_descuento_autorizado;
update public.tickets set tamano_vehiculo = 'automovil' where tamano_vehiculo is null;
alter table public.tickets enable trigger tr_ticket_descuento_autorizado;

alter table public.tickets alter column tamano_vehiculo set not null;

-- El trigger de lealtad calculaba el monto de la 6ta lavada gratis leyendo
-- directo servicios_catalogo.precio; ahora ese precio depende también del
-- tamaño de vehículo del ticket, así que se busca en servicios_precios.
create or replace function public.trg_fn_ticket_descuento_autorizado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previas integer := 0;
  v_precio numeric(10, 2);
  v_elegible boolean := false;
begin
  if new.cliente_id is not null then
    select count(*) into v_previas
    from public.tickets
    where cliente_id = new.cliente_id
      and estado = 'entregado'
      and id <> new.id;

    v_elegible := (v_previas % 6 = 5);
  end if;

  if v_elegible then
    select precio into v_precio
    from public.servicios_precios
    where servicio_id = new.servicio_id and tamano_vehiculo = new.tamano_vehiculo;

    new.descuento_monto := coalesce(v_precio, new.descuento_monto);
    new.lavada_gratis := true;
    return new;
  end if;

  new.lavada_gratis := false;

  if new.descuento_monto > 0 then
    if new.descuento_autorizado_por is not null and public.es_autorizador(new.descuento_autorizado_por) then
      return new;
    end if;

    raise exception 'Un descuento manual requiere autorizacion de un encargado o dueno activo.';
  end if;

  return new;
end;
$$;

-- Paquetes reales del negocio (ver rótulo físico), idempotente por nombre.
insert into public.servicios_catalogo (nombre, descripcion, caracteristicas, orden, destacado, activo)
values
  ('Básico', 'Lo necesario', array['Lavado carrocería', 'Aspirado interior', 'Abrillantador llantas'], 1, false, true),
  ('Plus', 'El lavado completo', array['Todo lo Básico', 'Aspirado cajuela', 'Lavado y brillo tolvas', 'Brillo plásticos exteriores'], 2, false, true),
  ('Hongo Premium', 'Recomendado · Más vendido', array['Todo lo Plus', 'Teflón tricapa en toda la carrocería', 'Crema Premium en plásticos interiores'], 3, true, true),
  ('Hongo Max', 'Tratamiento completo', array['Todo lo Premium', 'Espuma activa con cera de alta calidad', 'Lavado y desengrasado de motor', 'Abrillantador de motor'], 4, false, true)
on conflict (nombre) do update set
  descripcion = excluded.descripcion,
  caracteristicas = excluded.caracteristicas,
  orden = excluded.orden,
  destacado = excluded.destacado;

insert into public.servicios_precios (servicio_id, tamano_vehiculo, precio)
select sc.id, p.tamano, p.precio
from public.servicios_catalogo sc
join (
  values
    ('Básico', 'automovil'::tamano_vehiculo, 100.00),
    ('Básico', 'camioneta_chica'::tamano_vehiculo, 120.00),
    ('Básico', 'camioneta_grande'::tamano_vehiculo, 140.00),
    ('Básico', 'camioneta_extra_grande'::tamano_vehiculo, 160.00),
    ('Plus', 'automovil'::tamano_vehiculo, 120.00),
    ('Plus', 'camioneta_chica'::tamano_vehiculo, 140.00),
    ('Plus', 'camioneta_grande'::tamano_vehiculo, 170.00),
    ('Plus', 'camioneta_extra_grande'::tamano_vehiculo, 190.00),
    ('Hongo Premium', 'automovil'::tamano_vehiculo, 180.00),
    ('Hongo Premium', 'camioneta_chica'::tamano_vehiculo, 220.00),
    ('Hongo Premium', 'camioneta_grande'::tamano_vehiculo, 270.00),
    ('Hongo Premium', 'camioneta_extra_grande'::tamano_vehiculo, 300.00),
    ('Hongo Max', 'automovil'::tamano_vehiculo, 310.00),
    ('Hongo Max', 'camioneta_chica'::tamano_vehiculo, 340.00),
    ('Hongo Max', 'camioneta_grande'::tamano_vehiculo, 400.00),
    ('Hongo Max', 'camioneta_extra_grande'::tamano_vehiculo, 440.00)
) as p(nombre, tamano, precio) on p.nombre = sc.nombre
on conflict (servicio_id, tamano_vehiculo) do update set precio = excluded.precio;
