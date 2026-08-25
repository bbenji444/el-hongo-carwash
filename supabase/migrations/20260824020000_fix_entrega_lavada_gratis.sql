-- ============================================================================
-- El Hongo Car Wash — Fase 9: permite entregar tickets de lavada gratis.
--
-- Bug: el trigger anti-robo tr_ticket_requiere_pago bloquea marcar un ticket
-- como "entregado" si no existe una fila en pagos para ese ticket. Un ticket
-- de la 6ta lavada (gratis) nunca tiene fila en pagos -a proposito, porque la
-- tabla pagos exige monto > 0-, asi que el trigger lo bloqueaba igual que si
-- alguien intentara entregar sin cobrar.
--
-- Fix: el trigger ahora deja pasar la entrega sin pago solo cuando el propio
-- ticket ya viene marcado como lavada_gratis = true (ese valor lo calcula y
-- fuerza el trigger de lealtad, tr_ticket_descuento_autorizado, nunca el
-- cliente ni el cajero), manteniendo el candado para cualquier otro ticket.
-- ============================================================================

create or replace function public.trg_fn_ticket_requiere_pago()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'entregado' and old.estado is distinct from 'entregado' then
    if new.lavada_gratis is not true and not exists (select 1 from public.pagos where ticket_id = new.id) then
      raise exception 'No se puede marcar el ticket % como entregado sin un pago registrado.', new.id;
    end if;
  end if;
  return new;
end;
$$;
