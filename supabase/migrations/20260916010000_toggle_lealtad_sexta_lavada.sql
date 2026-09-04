-- ============================================================================
-- El Hongo Car Wash — Fase 33: interruptor para poder pausar la promo de la
-- 6ta lavada gratis sin tocar código. El dueño reportó un caso (una
-- patrulla) donde el sistema la marcó como su 6ta lavada cuando ahorita ni
-- siquiera está aplicando esa promo — antes no había forma de apagarla,
-- así que el trigger de lealtad la seguía calculando siempre.
-- ============================================================================

alter table public.configuracion_app
  add column if not exists lealtad_sexta_lavada_activa boolean not null default true;

-- Se apaga en el renglón actual porque el dueño indicó que ahorita no la
-- está aplicando — se puede volver a prender desde Ajustes cuando quiera.
update public.configuracion_app set lealtad_sexta_lavada_activa = false where id = true;

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
  v_promo_activa boolean := true;
begin
  select lealtad_sexta_lavada_activa into v_promo_activa from public.configuracion_app where id = true;

  if v_promo_activa and new.cliente_id is not null then
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
