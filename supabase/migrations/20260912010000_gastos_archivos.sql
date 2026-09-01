-- ============================================================================
-- El Hongo Car Wash — Fase 28: adjuntar un archivo (foto o PDF del ticket de
-- compra) a un gasto, para poder ver el detalle completo después sin tener
-- que capturar cada renglón del ticket a mano.
--
-- Se usa Supabase Storage: un bucket PRIVADO "gastos" (no público — solo
-- accesible con URL firmada y de corta duración, generada bajo demanda) con
-- el mismo nivel de acceso que ya tiene la tabla gastos (dueño/encargado).
-- ============================================================================

alter table public.gastos
  add column if not exists archivo_path text,
  add column if not exists archivo_nombre text;

insert into storage.buckets (id, name, public)
values ('gastos', 'gastos', false)
on conflict (id) do nothing;

drop policy if exists gastos_storage_select on storage.objects;
create policy gastos_storage_select on storage.objects
for select using (bucket_id = 'gastos' and public.usuario_rol() in ('dueno', 'encargado'));

drop policy if exists gastos_storage_insert on storage.objects;
create policy gastos_storage_insert on storage.objects
for insert with check (bucket_id = 'gastos' and public.usuario_rol() in ('dueno', 'encargado'));

drop policy if exists gastos_storage_update on storage.objects;
create policy gastos_storage_update on storage.objects
for update using (bucket_id = 'gastos' and public.usuario_rol() in ('dueno', 'encargado'));

drop policy if exists gastos_storage_delete on storage.objects;
create policy gastos_storage_delete on storage.objects
for delete using (bucket_id = 'gastos' and public.usuario_rol() in ('dueno', 'encargado'));
