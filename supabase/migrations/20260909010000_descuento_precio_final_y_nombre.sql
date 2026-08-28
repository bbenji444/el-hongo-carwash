-- ============================================================================
-- El Hongo Car Wash — Fase 25: simplifica el flujo de descuento manual.
--
-- Cambios pedidos por el dueño:
--   1) En vez de capturar el MONTO de descuento (obligaba a restar a mano),
--      ahora se captura el PRECIO FINAL del paquete — la app calcula sola
--      la diferencia. Esto es puramente de la app (actions.ts ahora calcula
--      descuento_monto = precio base - precio final), no requiere cambios
--      de esquema.
--   2) En vez de pedir correo + contraseña reales de un encargado/dueño
--      para autorizar, ahora solo se captura el NOMBRE de quien autoriza,
--      como texto libre. Esto SÍ requiere cambiar el esquema:
--        - tickets.descuento_autorizado_por pasa de uuid (referencia a
--          usuarios) a texto libre.
--        - El trigger tr_ticket_descuento_autorizado ya no valida contra
--          es_autorizador() (que esperaba un uuid de un encargado/dueño
--          real) — ahora solo exige que el campo no venga vacío.
--
-- ADVERTENCIA (que quede documentada aquí): esto quita el control de que
-- solo un encargado/dueño con su contraseña real pudiera autorizar un
-- precio especial — ahora basta con escribir cualquier nombre. Fue una
-- decisión explícita del dueño para simplificar el flujo de caja.
-- ============================================================================

alter table public.tickets
  drop constraint if exists tickets_descuento_autorizado_por_fkey;

alter table public.tickets
  alter column descuento_autorizado_por type text using descuento_autorizado_por::text;

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

  if new.descuento_monto > 0 and (new.descuento_autorizado_por is null or btrim(new.descuento_autorizado_por) = '') then
    raise exception 'Un descuento manual requiere el nombre de quien lo autoriza.';
  end if;

  return new;
end;
$$;
