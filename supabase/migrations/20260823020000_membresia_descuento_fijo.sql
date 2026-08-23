-- ============================================================================
-- El Hongo Car Wash — Fase 4: descuento automático de membresías tipo
-- descuento_fijo, sin requerir re-autenticación de encargado/dueño.
--
-- El trigger original (tr_ticket_descuento_autorizado, Fase 1) solo permitía
-- descuento_monto > 0 cuando descuento_autorizado_por apuntaba a un
-- encargado/dueño activo. Eso dejaba sin cerrar el caso de membresías
-- descuento_fijo: el cajero podía escribir cualquier monto al cobrar sin que
-- el servidor verificara que correspondía al beneficio real del plan.
--
-- Se agrega un segundo camino de validación: el descuento se acepta sin
-- autorización humana si, y solo si, coincide exactamente con el
-- beneficio_valor de una membresía descuento_fijo activa y vigente que el
-- propio ticket tiene vinculada. El valor del beneficio lo define el dueño
-- en el catálogo de membresías (RLS: solo dueño puede escribir en
-- membresias), así que sigue sin haber forma de inflar el descuento desde
-- el cliente.
-- ============================================================================

create or replace function public.trg_fn_ticket_descuento_autorizado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_beneficio numeric(10, 2);
begin
  if new.descuento_monto > 0 then
    if new.descuento_autorizado_por is not null and public.es_autorizador(new.descuento_autorizado_por) then
      return new;
    end if;

    if new.membresia_cliente_id is not null then
      select m.beneficio_valor into v_beneficio
      from public.membresias_clientes mc
      join public.membresias m on m.id = mc.membresia_id
      where mc.id = new.membresia_cliente_id
        and mc.activa = true
        and mc.fecha_fin >= current_date
        and m.tipo = 'descuento_fijo'
        and m.activo = true;

      if v_beneficio is not null and new.descuento_monto = v_beneficio then
        return new;
      end if;
    end if;

    raise exception 'Un descuento manual requiere autorizacion de un encargado o dueno activo, o debe coincidir exactamente con el beneficio de una membresia descuento_fijo vigente.';
  end if;
  return new;
end;
$$;
