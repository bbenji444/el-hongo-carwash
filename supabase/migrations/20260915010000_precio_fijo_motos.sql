-- ============================================================================
-- El Hongo Car Wash — Fase 32: las motos (chica/grande) pasan a tener un
-- precio fijo sin importar el paquete que se elija ($70 y $100 respectivamente,
-- ver PRECIOS_MOTO_FIJOS en src/lib/servicios.ts) — antes se cobraban según
-- servicios_precios como cualquier otro tamaño.
--
-- Esto es puramente de la app (precioPorTamano ahora sobreescribe el precio
-- para esos dos tamaños) EXCEPTO por un lugar: el trigger de la 6ta lavada
-- gratis (trg_fn_ticket_descuento_autorizado) calcula el monto del descuento
-- leyendo directo servicios_precios en SQL — si no se corrige aquí también,
-- una moto que le toque su lavada gratis se quedaría con descuento $0 (no
-- hay renglón de precio guardado para motos) en vez de $70/$100.
-- ============================================================================

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
    if new.tamano_vehiculo = 'moto_chica' then
      v_precio := 70;
    elsif new.tamano_vehiculo = 'moto_grande' then
      v_precio := 100;
    else
      select precio into v_precio
      from public.servicios_precios
      where servicio_id = new.servicio_id and tamano_vehiculo = new.tamano_vehiculo;
    end if;

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
