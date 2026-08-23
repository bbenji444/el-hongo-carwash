-- ============================================================================
-- El Hongo Car Wash — Fase 5: descuento automático de inventario al entregar
-- un ticket, según la receta (consumo_inventario) del servicio realizado.
--
-- Nadie escribe stock_actual a mano al cerrar un servicio: se descuenta solo,
-- server-side, en el mismo momento en que el ticket pasa a 'entregado' (que ya
-- requiere pago registrado por tr_ticket_requiere_pago). Si el stock no
-- alcanza, la constraint stock_actual >= 0 (Fase 1) rechaza la entrega hasta
-- que se corrija el inventario — evita que el sistema reporte consumo de
-- insumos que no existen en el anaquel.
-- ============================================================================

create or replace function public.trg_fn_consumo_inventario_en_entrega()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'entregado' and old.estado is distinct from 'entregado' then
    update public.inventario inv
    set stock_actual = inv.stock_actual - ci.cantidad_estimada
    from public.consumo_inventario ci
    where ci.insumo_id = inv.id
      and ci.servicio_id = new.servicio_id;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_ticket_consumo_inventario on public.tickets;

create trigger tr_ticket_consumo_inventario
after update on public.tickets
for each row execute function public.trg_fn_consumo_inventario_en_entrega();
