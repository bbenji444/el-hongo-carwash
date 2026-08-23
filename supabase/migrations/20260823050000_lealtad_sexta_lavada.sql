-- ============================================================================
-- El Hongo Car Wash — Fase 7: elimina el sistema de membresías y lo reemplaza
-- por un programa de lealtad único: cada 6ta lavada del cliente es gratis
-- (aplica a todos los clientes, sin necesidad de membresía).
--
-- 1) Limpieza de datos de prueba: se vacían tickets y pagos (catálogos de
--    servicios, usuarios, clientes e inventario quedan intactos).
-- 2) Se elimina por completo membresias / membresias_clientes y las columnas
--    que dependían de ellas (tickets.membresia_cliente_id, pagos.membresia_usada).
-- 3) tickets gana una columna lavada_gratis, calculada y validada siempre en
--    el servidor (nunca por el cliente): el trigger cuenta las lavadas
--    entregadas previas del cliente (excluyendo lavadas ya marcadas gratis)
--    y solo permite descuento_monto > 0 sin autorización humana si coincide
--    exactamente con el precio del servicio Y el cliente va en su 6ta lavada
--    del ciclo. El mismo patrón anti-robo que ya se usaba para membresías:
--    el servidor recalcula todo desde cero, nunca confía en un flag enviado
--    por el cliente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Limpieza de datos de prueba (solo tickets y pagos)
-- ----------------------------------------------------------------------------
delete from public.pagos;
delete from public.tickets;

-- ----------------------------------------------------------------------------
-- 2) Elimina el trigger/función de prioridad automática por membresía
--    (la prioridad de fila ya no tiene fuente de datos una vez fuera
--    membresias_clientes; queda como columna manual, default false).
-- ----------------------------------------------------------------------------
drop trigger if exists tr_ticket_prioridad on public.tickets;
drop function if exists public.trg_fn_ticket_prioridad();

-- ----------------------------------------------------------------------------
-- 3) Elimina el trigger/función de saldo de paquete prepagado.
-- ----------------------------------------------------------------------------
drop trigger if exists tr_pago_membresia_saldo on public.pagos;
drop function if exists public.trg_fn_pago_membresia_saldo();

-- ----------------------------------------------------------------------------
-- 4) Columnas dependientes de membresías
-- ----------------------------------------------------------------------------
alter table public.tickets drop column if exists membresia_cliente_id;
alter table public.pagos drop column if exists membresia_usada;

alter table public.tickets add column lavada_gratis boolean not null default false;

create index if not exists idx_tickets_cliente on public.tickets (cliente_id);

-- ----------------------------------------------------------------------------
-- 5) Elimina tablas y tipo de membresías (cascada limpia sus policies e índices)
-- ----------------------------------------------------------------------------
drop table if exists public.membresias_clientes cascade;
drop table if exists public.membresias cascade;
drop type if exists membresia_tipo;

-- ----------------------------------------------------------------------------
-- 6) Reescribe el trigger de autorización de descuentos: el servidor cuenta
--    siempre desde cero las lavadas entregadas previas del cliente (nunca
--    confía en nada que mande el cliente) y, si esta es su 6ta lavada del
--    ciclo, fuerza el descuento al 100% del precio del servicio y marca
--    lavada_gratis = true automáticamente — el cajero no tiene que aplicar
--    nada a mano ni puede evitarlo u omitirlo. Si no es su 6ta lavada, el
--    descuento manual sigue requiriendo autorización humana como antes.
-- ----------------------------------------------------------------------------
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
      and lavada_gratis = false
      and id <> new.id;

    v_elegible := (v_previas % 6 = 5);
  end if;

  if v_elegible then
    select precio into v_precio from public.servicios_catalogo where id = new.servicio_id;
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
