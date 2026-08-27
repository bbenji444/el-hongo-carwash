-- ============================================================================
-- El Hongo Car Wash — Fase 19: extras opcionales para tickets (ej. Encerado
-- premium), configurables por el dueño desde Ajustes.
--
-- A diferencia de los paquetes, un extra tiene un solo precio fijo (no varía
-- por tamaño de vehículo). Cuando se agrega un extra a un ticket se guarda
-- una copia de su nombre y precio en ese momento (ticket_extras), para que
-- si después el dueño le cambia el nombre o el precio al extra en el
-- catálogo, los tickets ya cobrados con la versión anterior no cambien.
-- ============================================================================

create table public.extras_catalogo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio numeric(10, 2) not null check (precio >= 0),
  orden integer not null default 0,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

insert into public.extras_catalogo (nombre, precio, orden) values
  ('Encerado premium', 150, 0);

create table public.ticket_extras (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  extra_id uuid not null references public.extras_catalogo (id),
  nombre text not null,
  precio numeric(10, 2) not null,
  creado_en timestamptz not null default now(),
  unique (ticket_id, extra_id)
);

alter table public.extras_catalogo enable row level security;

drop policy if exists extras_catalogo_select on public.extras_catalogo;
create policy extras_catalogo_select on public.extras_catalogo
for select using (public.usuario_rol() is not null);

drop policy if exists extras_catalogo_insert_dueno on public.extras_catalogo;
create policy extras_catalogo_insert_dueno on public.extras_catalogo
for insert with check (public.usuario_rol() = 'dueno');

drop policy if exists extras_catalogo_update_dueno on public.extras_catalogo;
create policy extras_catalogo_update_dueno on public.extras_catalogo
for update using (public.usuario_rol() = 'dueno') with check (public.usuario_rol() = 'dueno');

drop policy if exists extras_catalogo_delete_dueno on public.extras_catalogo;
create policy extras_catalogo_delete_dueno on public.extras_catalogo
for delete using (public.usuario_rol() = 'dueno');

alter table public.ticket_extras enable row level security;

drop policy if exists ticket_extras_select on public.ticket_extras;
create policy ticket_extras_select on public.ticket_extras
for select using (public.usuario_rol() is not null);

drop policy if exists ticket_extras_insert on public.ticket_extras;
create policy ticket_extras_insert on public.ticket_extras
for insert with check (public.usuario_rol() is not null);

drop policy if exists ticket_extras_delete on public.ticket_extras;
create policy ticket_extras_delete on public.ticket_extras
for delete using (public.usuario_rol() is not null);
