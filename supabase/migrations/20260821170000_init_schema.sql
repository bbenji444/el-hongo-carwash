-- ============================================================================
-- El Hongo Car Wash — Fase 1: schema, triggers anti-robo y RLS
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type rol_usuario as enum ('dueno', 'encargado', 'cajero');
create type turno_estado as enum ('abierto', 'cerrado');
create type ticket_estado as enum ('en_espera', 'en_proceso', 'terminado', 'entregado');
create type pago_metodo as enum ('efectivo', 'tarjeta', 'transferencia', 'membresia');
create type membresia_tipo as enum ('descuento_fijo', 'paquete_prepagado');

-- ----------------------------------------------------------------------------
-- TABLAS
-- ----------------------------------------------------------------------------

create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  rol rol_usuario not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.turnos (
  id uuid primary key default gen_random_uuid(),
  usuario_apertura_id uuid not null references public.usuarios (id),
  usuario_cierre_id uuid references public.usuarios (id),
  efectivo_inicial numeric(10, 2) not null default 0 check (efectivo_inicial >= 0),
  efectivo_esperado numeric(10, 2),
  efectivo_contado numeric(10, 2),
  diferencia numeric(10, 2),
  alerta_diferencia boolean generated always as (coalesce(diferencia, 0) <> 0) stored,
  estado turno_estado not null default 'abierto',
  hora_apertura timestamptz not null default now(),
  hora_cierre timestamptz
);

create table public.servicios_catalogo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  precio numeric(10, 2) not null check (precio > 0),
  tiempo_estimado_min integer check (tiempo_estimado_min > 0),
  activo boolean not null default true
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  creado_en timestamptz not null default now()
);

create table public.membresias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo membresia_tipo not null,
  beneficio_valor numeric(10, 2) not null check (beneficio_valor >= 0),
  precio numeric(10, 2) not null check (precio >= 0),
  vigencia_dias integer not null check (vigencia_dias > 0),
  activo boolean not null default true
);

create table public.membresias_clientes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  membresia_id uuid not null references public.membresias (id),
  fecha_inicio date not null default current_date,
  fecha_fin date not null,
  saldo_paquete numeric(10, 2) not null default 0 check (saldo_paquete >= 0),
  activa boolean not null default true
);

create table public.vehiculos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  placas text,
  tipo_vehiculo text
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid references public.vehiculos (id),
  cliente_id uuid references public.clientes (id),
  servicio_id uuid not null references public.servicios_catalogo (id),
  empleado_id uuid not null references public.usuarios (id),
  turno_id uuid not null references public.turnos (id),
  membresia_cliente_id uuid references public.membresias_clientes (id),
  prioridad boolean not null default false,
  descuento_monto numeric(10, 2) not null default 0 check (descuento_monto >= 0),
  descuento_autorizado_por uuid references public.usuarios (id),
  estado ticket_estado not null default 'en_espera',
  hora_entrada timestamptz not null default now(),
  hora_salida timestamptz,
  creado_por uuid not null references public.usuarios (id) default auth.uid()
);

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id),
  metodo pago_metodo not null,
  monto numeric(10, 2) not null check (monto > 0),
  turno_id uuid not null references public.turnos (id),
  membresia_usada boolean not null default false,
  usuario_id uuid not null references public.usuarios (id) default auth.uid(),
  creado_en timestamptz not null default now()
);

create table public.inventario (
  id uuid primary key default gen_random_uuid(),
  nombre_insumo text not null unique,
  stock_actual numeric(12, 3) not null default 0 check (stock_actual >= 0),
  costo_unitario numeric(10, 2) not null default 0 check (costo_unitario >= 0)
);

create table public.consumo_inventario (
  id uuid primary key default gen_random_uuid(),
  servicio_id uuid not null references public.servicios_catalogo (id) on delete cascade,
  insumo_id uuid not null references public.inventario (id) on delete cascade,
  cantidad_estimada numeric(12, 3) not null check (cantidad_estimada > 0),
  unique (servicio_id, insumo_id)
);

create index idx_tickets_turno on public.tickets (turno_id);
create index idx_tickets_estado on public.tickets (estado);
create index idx_tickets_empleado on public.tickets (empleado_id);
create index idx_pagos_ticket on public.pagos (ticket_id);
create index idx_pagos_turno on public.pagos (turno_id);
create index idx_membresias_clientes_cliente on public.membresias_clientes (cliente_id);
create index idx_vehiculos_cliente on public.vehiculos (cliente_id);
create index idx_consumo_servicio on public.consumo_inventario (servicio_id);

-- ----------------------------------------------------------------------------
-- FUNCIONES DE APOYO PARA RLS (SECURITY DEFINER — evitan recursión sobre usuarios)
-- ----------------------------------------------------------------------------

create or replace function public.usuario_rol()
returns rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.usuarios where id = auth.uid() and activo = true;
$$;

create or replace function public.es_autorizador(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios
    where id = uid and activo = true and rol in ('encargado', 'dueno')
  );
$$;

-- ----------------------------------------------------------------------------
-- TRIGGERS ANTI-ROBO (defensa en profundidad a nivel de base de datos)
-- ----------------------------------------------------------------------------

-- 1) Prioridad de fila: siempre derivada de membresía activa, nunca editable a mano.
create or replace function public.trg_fn_ticket_prioridad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.membresia_cliente_id is not null then
    new.prioridad := exists (
      select 1 from public.membresias_clientes mc
      where mc.id = new.membresia_cliente_id
        and mc.activa = true
        and mc.fecha_fin >= current_date
    );
  else
    new.prioridad := false;
  end if;
  return new;
end;
$$;

create trigger tr_ticket_prioridad
before insert or update on public.tickets
for each row execute function public.trg_fn_ticket_prioridad();

-- 2) No se puede marcar "entregado" sin al menos un pago asociado (elimina servicio fantasma).
create or replace function public.trg_fn_ticket_requiere_pago()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'entregado' and old.estado is distinct from 'entregado' then
    if not exists (select 1 from public.pagos where ticket_id = new.id) then
      raise exception 'No se puede marcar el ticket % como entregado sin un pago registrado.', new.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger tr_ticket_requiere_pago
before update on public.tickets
for each row execute function public.trg_fn_ticket_requiere_pago();

-- 3) Descuento manual requiere autorización real de encargado/dueño activo.
create or replace function public.trg_fn_ticket_descuento_autorizado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.descuento_monto > 0 then
    if new.descuento_autorizado_por is null or not public.es_autorizador(new.descuento_autorizado_por) then
      raise exception 'Un descuento manual requiere autorizacion de un encargado o dueno activo.';
    end if;
  end if;
  return new;
end;
$$;

create trigger tr_ticket_descuento_autorizado
before insert or update on public.tickets
for each row execute function public.trg_fn_ticket_descuento_autorizado();

-- 4) No se pueden registrar pagos sobre un turno ya cerrado.
create or replace function public.trg_fn_pago_bloquea_turno_cerrado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado turno_estado;
begin
  select estado into v_estado from public.turnos where id = new.turno_id;
  if v_estado = 'cerrado' then
    raise exception 'No se pueden registrar pagos sobre un turno ya cerrado.';
  end if;
  return new;
end;
$$;

create trigger tr_pago_bloquea_turno_cerrado
before insert on public.pagos
for each row execute function public.trg_fn_pago_bloquea_turno_cerrado();

-- 5) Pago con membresía: valida y descuenta saldo_paquete; bloquea si saldo agotado.
create or replace function public.trg_fn_pago_membresia_saldo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo membresia_tipo;
  v_saldo numeric(10, 2);
begin
  if new.metodo = 'membresia' then
    if new.membresia_usada is distinct from true then
      raise exception 'Un pago con metodo membresia debe tener membresia_usada = true.';
    end if;

    select mc.saldo_paquete, m.tipo into v_saldo, v_tipo
    from public.tickets t
    join public.membresias_clientes mc on mc.id = t.membresia_cliente_id
    join public.membresias m on m.id = mc.membresia_id
    where t.id = new.ticket_id
    for update of mc;

    if v_tipo is null then
      raise exception 'El ticket no tiene una membresia de cliente asociada.';
    end if;

    if v_tipo = 'paquete_prepagado' then
      if v_saldo is null or v_saldo <= 0 or v_saldo < new.monto then
        raise exception 'Saldo de paquete insuficiente. Debe cobrarse aparte.';
      end if;

      update public.membresias_clientes mc
      set saldo_paquete = mc.saldo_paquete - new.monto
      from public.tickets t
      where t.id = new.ticket_id and mc.id = t.membresia_cliente_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger tr_pago_membresia_saldo
before insert on public.pagos
for each row execute function public.trg_fn_pago_membresia_saldo();

-- 6) Cierre de turno: efectivo_esperado y diferencia se calculan siempre en el servidor.
create or replace function public.trg_fn_turno_cierre_calcula()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_efectivo numeric(10, 2);
begin
  if new.estado = 'cerrado' and old.estado is distinct from 'cerrado' then
    select coalesce(sum(monto), 0) into v_total_efectivo
    from public.pagos
    where turno_id = new.id and metodo = 'efectivo';

    new.efectivo_esperado := new.efectivo_inicial + v_total_efectivo;

    if new.efectivo_contado is null then
      raise exception 'Debes capturar el efectivo contado antes de cerrar el turno.';
    end if;

    new.diferencia := new.efectivo_contado - new.efectivo_esperado;
    new.hora_cierre := coalesce(new.hora_cierre, now());
    new.usuario_cierre_id := coalesce(new.usuario_cierre_id, auth.uid());
  end if;
  return new;
end;
$$;

create trigger tr_turno_cierre_calcula
before update on public.turnos
for each row execute function public.trg_fn_turno_cierre_calcula();

-- ----------------------------------------------------------------------------
-- RLS — nunca USING (true). Cada tabla con políticas explícitas por rol.
-- ----------------------------------------------------------------------------

-- usuarios
alter table public.usuarios enable row level security;

create policy usuarios_select on public.usuarios
for select using (
  id = auth.uid() or public.usuario_rol() in ('encargado', 'dueno')
);

create policy usuarios_insert_dueno on public.usuarios
for insert with check (public.usuario_rol() = 'dueno');

create policy usuarios_update_dueno on public.usuarios
for update using (public.usuario_rol() = 'dueno') with check (public.usuario_rol() = 'dueno');

-- (sin DELETE: los usuarios se desactivan con `activo = false`, nunca se borran)

-- turnos
alter table public.turnos enable row level security;

create policy turnos_select on public.turnos
for select using (
  public.usuario_rol() in ('dueno', 'encargado')
  or usuario_apertura_id = auth.uid()
  or usuario_cierre_id = auth.uid()
  or estado = 'abierto'
);

create policy turnos_insert on public.turnos
for insert with check (
  public.usuario_rol() is not null and usuario_apertura_id = auth.uid()
);

create policy turnos_update on public.turnos
for update using (
  public.usuario_rol() = 'dueno'
  or (public.usuario_rol() in ('encargado', 'cajero') and estado = 'abierto')
) with check (
  public.usuario_rol() = 'dueno'
  or public.usuario_rol() in ('encargado', 'cajero')
);

-- (sin DELETE: el historial de turnos es inmutable)

-- servicios_catalogo
alter table public.servicios_catalogo enable row level security;

create policy servicios_select on public.servicios_catalogo
for select using (public.usuario_rol() is not null);

create policy servicios_insert_dueno on public.servicios_catalogo
for insert with check (public.usuario_rol() = 'dueno');

create policy servicios_update_dueno on public.servicios_catalogo
for update using (public.usuario_rol() = 'dueno') with check (public.usuario_rol() = 'dueno');

create policy servicios_delete_dueno on public.servicios_catalogo
for delete using (public.usuario_rol() = 'dueno');

-- clientes
alter table public.clientes enable row level security;

create policy clientes_select on public.clientes
for select using (public.usuario_rol() is not null);

create policy clientes_insert on public.clientes
for insert with check (public.usuario_rol() is not null);

create policy clientes_update on public.clientes
for update using (public.usuario_rol() is not null) with check (public.usuario_rol() is not null);

create policy clientes_delete on public.clientes
for delete using (public.usuario_rol() in ('encargado', 'dueno'));

-- vehiculos
alter table public.vehiculos enable row level security;

create policy vehiculos_select on public.vehiculos
for select using (public.usuario_rol() is not null);

create policy vehiculos_insert on public.vehiculos
for insert with check (public.usuario_rol() is not null);

create policy vehiculos_update on public.vehiculos
for update using (public.usuario_rol() is not null) with check (public.usuario_rol() is not null);

create policy vehiculos_delete on public.vehiculos
for delete using (public.usuario_rol() in ('encargado', 'dueno'));

-- membresias (catálogo)
alter table public.membresias enable row level security;

create policy membresias_select on public.membresias
for select using (public.usuario_rol() is not null);

create policy membresias_insert_dueno on public.membresias
for insert with check (public.usuario_rol() = 'dueno');

create policy membresias_update_dueno on public.membresias
for update using (public.usuario_rol() = 'dueno') with check (public.usuario_rol() = 'dueno');

create policy membresias_delete_dueno on public.membresias
for delete using (public.usuario_rol() = 'dueno');

-- membresias_clientes
alter table public.membresias_clientes enable row level security;

create policy membresias_clientes_select on public.membresias_clientes
for select using (public.usuario_rol() is not null);

create policy membresias_clientes_insert on public.membresias_clientes
for insert with check (public.usuario_rol() is not null);

create policy membresias_clientes_update on public.membresias_clientes
for update using (public.usuario_rol() in ('encargado', 'dueno'))
with check (public.usuario_rol() in ('encargado', 'dueno'));

create policy membresias_clientes_delete on public.membresias_clientes
for delete using (public.usuario_rol() = 'dueno');

-- tickets (sin DELETE excepto dueño — historial operativo)
alter table public.tickets enable row level security;

create policy tickets_select on public.tickets
for select using (public.usuario_rol() is not null);

create policy tickets_insert on public.tickets
for insert with check (public.usuario_rol() is not null and creado_por = auth.uid());

create policy tickets_update on public.tickets
for update using (public.usuario_rol() is not null) with check (public.usuario_rol() is not null);

create policy tickets_delete_dueno on public.tickets
for delete using (public.usuario_rol() = 'dueno');

-- pagos (cajero: solo insert, nunca edita/borra; encargado: edita solo si turno sigue abierto)
alter table public.pagos enable row level security;

create policy pagos_select on public.pagos
for select using (public.usuario_rol() is not null);

create policy pagos_insert on public.pagos
for insert with check (public.usuario_rol() is not null and usuario_id = auth.uid());

create policy pagos_update on public.pagos
for update using (
  public.usuario_rol() = 'dueno'
  or (
    public.usuario_rol() = 'encargado'
    and exists (select 1 from public.turnos t where t.id = turno_id and t.estado = 'abierto')
  )
) with check (
  public.usuario_rol() = 'dueno'
  or (
    public.usuario_rol() = 'encargado'
    and exists (select 1 from public.turnos t where t.id = turno_id and t.estado = 'abierto')
  )
);

create policy pagos_delete_dueno on public.pagos
for delete using (public.usuario_rol() = 'dueno');

-- inventario
alter table public.inventario enable row level security;

create policy inventario_select on public.inventario
for select using (public.usuario_rol() is not null);

create policy inventario_insert on public.inventario
for insert with check (public.usuario_rol() in ('encargado', 'dueno'));

create policy inventario_update on public.inventario
for update using (public.usuario_rol() in ('encargado', 'dueno'))
with check (public.usuario_rol() in ('encargado', 'dueno'));

create policy inventario_delete on public.inventario
for delete using (public.usuario_rol() in ('encargado', 'dueno'));

-- consumo_inventario
alter table public.consumo_inventario enable row level security;

create policy consumo_select on public.consumo_inventario
for select using (public.usuario_rol() is not null);

create policy consumo_insert_dueno on public.consumo_inventario
for insert with check (public.usuario_rol() = 'dueno');

create policy consumo_update_dueno on public.consumo_inventario
for update using (public.usuario_rol() = 'dueno') with check (public.usuario_rol() = 'dueno');

create policy consumo_delete_dueno on public.consumo_inventario
for delete using (public.usuario_rol() = 'dueno');
