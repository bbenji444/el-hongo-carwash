-- ============================================================================
-- El Hongo Car Wash — Fase 8: corrige el ciclo del programa de lealtad.
--
-- Bug: el trigger contaba solo las lavadas NO gratis del cliente para saber
-- en qué punto del ciclo va ("previas % 6 = 5"). Como las lavadas gratis
-- quedaban excluidas de ese conteo, el contador se quedaba pegado en 5 para
-- siempre después de la primera 6ta lavada gratis, y TODAS las lavadas
-- siguientes también salían gratis.
--
-- Fix: contar TODAS las lavadas entregadas del cliente (gratis o no). Cada
-- ciclo completo son 6 lavadas exactas (5 pagadas + 1 gratis), así que el
-- residuo módulo 6 del conteo total ya vuelve a 0 justo después de la lavada
-- gratis, sin necesidad de excluir nada.
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
