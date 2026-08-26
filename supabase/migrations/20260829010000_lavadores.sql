-- ============================================================================
-- El Hongo Car Wash — Fase 14: registro de lavadores.
--
-- Los lavadores son el personal que físicamente lava los autos — distintos
-- de los usuarios del sistema (dueño/encargado/cajero, que son quienes
-- inician sesión). No necesitan cuenta ni login, solo un registro con
-- nombre para poder asignarlos a cada ticket y llevar el conteo de autos
-- lavados (y las ventas que generaron) por persona.
--
-- tickets.lavador_id es NULLABLE a propósito: no rompe tickets históricos
-- ya creados antes de esta fase, y permite crear un ticket sin lavador
-- asignado todavía si hiciera falta.
-- ============================================================================

do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'lavadores') then
    create table public.lavadores (
      id uuid primary key default gen_random_uuid(),
      nombre text not null,
      activo boolean not null default true,
      creado_en timestamptz not null default now()
    );
  end if;
end $$;

alter table public.lavadores enable row level security;

drop policy if exists lavadores_select on public.lavadores;
create policy lavadores_select on public.lavadores
for select using (public.usuario_rol() is not null);

drop policy if exists lavadores_insert on public.lavadores;
create policy lavadores_insert on public.lavadores
for insert with check (public.usuario_rol() in ('encargado', 'dueno'));

drop policy if exists lavadores_update on public.lavadores;
create policy lavadores_update on public.lavadores
for update using (public.usuario_rol() in ('encargado', 'dueno'))
with check (public.usuario_rol() in ('encargado', 'dueno'));

drop policy if exists lavadores_delete on public.lavadores;
create policy lavadores_delete on public.lavadores
for delete using (public.usuario_rol() in ('encargado', 'dueno'));

alter table public.tickets add column if not exists lavador_id uuid references public.lavadores (id);

create index if not exists idx_tickets_lavador on public.tickets (lavador_id);
