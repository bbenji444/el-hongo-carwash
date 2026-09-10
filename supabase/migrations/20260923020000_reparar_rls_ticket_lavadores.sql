-- ============================================================================
-- Reparación: las políticas RLS de ticket_lavadores no quedaron activas
-- después de la migración anterior (el insert desde la app fallaba con
-- "new row violates row-level security policy"). Este script es seguro de
-- volver a correr las veces que haga falta — solo reemplaza las políticas,
-- no toca los datos.
-- ============================================================================

alter table public.ticket_lavadores enable row level security;

drop policy if exists ticket_lavadores_select on public.ticket_lavadores;
create policy ticket_lavadores_select on public.ticket_lavadores
for select using (public.usuario_rol() is not null);

drop policy if exists ticket_lavadores_insert on public.ticket_lavadores;
create policy ticket_lavadores_insert on public.ticket_lavadores
for insert with check (public.usuario_rol() is not null);

drop policy if exists ticket_lavadores_update on public.ticket_lavadores;
create policy ticket_lavadores_update on public.ticket_lavadores
for update using (public.usuario_rol() is not null) with check (public.usuario_rol() is not null);

drop policy if exists ticket_lavadores_delete on public.ticket_lavadores;
create policy ticket_lavadores_delete on public.ticket_lavadores
for delete using (public.usuario_rol() is not null);

-- Verificación: debe regresar 4 renglones (select/insert/update/delete).
select policyname, cmd from pg_policies where tablename = 'ticket_lavadores';
