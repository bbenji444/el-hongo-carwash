-- ============================================================================
-- El Hongo Car Wash — Fase 10: registra cuánto paga el cliente en efectivo y
-- cuánto cambio se le devuelve, para que quede constancia en cada pago y no
-- haya dudas ni problemas al momento de dar el cambio.
-- ============================================================================

alter table public.pagos add column if not exists monto_recibido numeric(10, 2);

alter table public.pagos add column if not exists cambio_entregado numeric(10, 2)
  generated always as (
    case when monto_recibido is not null then monto_recibido - monto else null end
  ) stored;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pagos_monto_recibido_check'
  ) then
    alter table public.pagos add constraint pagos_monto_recibido_check
      check (monto_recibido is null or monto_recibido >= monto);
  end if;
end $$;
