-- ============================================================================
-- El Hongo Car Wash — Fase 11: cronómetro por etapa del ticket.
--
-- Se agrega hora_cambio_estado, que el servidor actualiza solo (nunca a
-- partir de lo que mande el cliente) cada vez que el ticket entra a un
-- estado distinto. Con esto el tablero puede mostrar dos cronómetros: el
-- tiempo total desde que se levantó el ticket y el tiempo que lleva en la
-- etapa actual, sin depender de cálculos hechos en el navegador.
-- ============================================================================

alter table public.tickets add column if not exists hora_cambio_estado timestamptz not null default now();

create or replace function public.trg_fn_ticket_marca_cambio_estado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    new.hora_cambio_estado := now();
  end if;
  return new;
end;
$$;

drop trigger if exists tr_ticket_marca_cambio_estado on public.tickets;
create trigger tr_ticket_marca_cambio_estado
before update on public.tickets
for each row execute function public.trg_fn_ticket_marca_cambio_estado();
