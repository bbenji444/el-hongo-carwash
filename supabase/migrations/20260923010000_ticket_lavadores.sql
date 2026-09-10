-- ============================================================================
-- El Hongo Car Wash — Fase 40: un ticket puede tener MÁS de un lavador
-- asignado (empiezan a lavar en pareja). Antes tickets.lavador_id era una
-- sola columna (un lavador por ticket) — ahora vive en su propia tabla
-- puente muchos-a-muchos. tickets.lavador_id se queda en la tabla como
-- red de seguridad/histórico, pero la app deja de escribirla: de aquí en
-- adelante ticket_lavadores es la única fuente de verdad.
-- ============================================================================

create table public.ticket_lavadores (
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  lavador_id uuid not null references public.lavadores (id),
  primary key (ticket_id, lavador_id)
);

create index idx_ticket_lavadores_lavador on public.ticket_lavadores (lavador_id);

alter table public.ticket_lavadores enable row level security;

-- Mismo nivel de confianza que tickets: cualquier autenticado puede leer y
-- escribir aquí (el control fino de quién puede editar qué ticket ya lo
-- hace la app, no RLS, igual que con tickets/ticket_extras).
create policy ticket_lavadores_select on public.ticket_lavadores
for select using (public.usuario_rol() is not null);

create policy ticket_lavadores_insert on public.ticket_lavadores
for insert with check (public.usuario_rol() is not null);

create policy ticket_lavadores_update on public.ticket_lavadores
for update using (public.usuario_rol() is not null) with check (public.usuario_rol() is not null);

create policy ticket_lavadores_delete on public.ticket_lavadores
for delete using (public.usuario_rol() is not null);

-- Backfill: cada ticket que ya tenía lavador_id se vuelve un renglón aquí,
-- para que el historial siga contando igual con las consultas nuevas.
insert into public.ticket_lavadores (ticket_id, lavador_id)
select id, lavador_id from public.tickets where lavador_id is not null
on conflict do nothing;
