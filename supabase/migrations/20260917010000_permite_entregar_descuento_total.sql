-- ============================================================================
-- El Hongo Car Wash — Fase 34: permite entregar un ticket con descuento
-- MANUAL que lo deja en $0, no solo la lavada gratis automática de lealtad.
--
-- Bug: tr_ticket_requiere_pago solo dejaba pasar la entrega sin fila en
-- pagos cuando lavada_gratis = true (la 6ta lavada automática). Un ticket
-- con un descuento manual ("Precio especial") que también termina en $0
-- (p. ej. una patrulla a la que se le da la lavada gratis a mano) tampoco
-- genera fila en pagos —la tabla pagos exige monto > 0, igual que con la
-- lavada gratis— pero como lavada_gratis se queda en false, el trigger lo
-- bloqueaba igual que si nadie hubiera cobrado nada.
--
-- Fix: además de lavada_gratis = true, también se deja pasar cuando el
-- total real del ticket (precio del paquete + extras - descuento) ya es
-- $0 — el mismo cálculo que ya usa el cobro en la app.
-- ============================================================================

create or replace function public.trg_fn_ticket_requiere_pago()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_precio numeric(10, 2);
  v_extras numeric(10, 2);
  v_total numeric(10, 2);
begin
  if new.estado = 'entregado' and old.estado is distinct from 'entregado' then
    if new.lavada_gratis is not true and not exists (select 1 from public.pagos where ticket_id = new.id) then
      if new.tamano_vehiculo = 'moto_chica' then
        v_precio := 70;
      elsif new.tamano_vehiculo = 'moto_grande' then
        v_precio := 100;
      else
        select coalesce(precio, 0) into v_precio
        from public.servicios_precios
        where servicio_id = new.servicio_id and tamano_vehiculo = new.tamano_vehiculo;
      end if;

      select coalesce(sum(precio), 0) into v_extras
      from public.ticket_extras
      where ticket_id = new.id;

      v_total := greatest(coalesce(v_precio, 0) + v_extras - coalesce(new.descuento_monto, 0), 0);

      if v_total > 0 then
        raise exception 'No se puede marcar el ticket % como entregado sin un pago registrado.', new.id;
      end if;
    end if;
  end if;
  return new;
end;
$$;
