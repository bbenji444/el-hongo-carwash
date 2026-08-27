-- ============================================================================
-- El Hongo Car Wash — Fase 17: permiso delegable para editar/eliminar tickets.
--
-- Antes solo el dueño podía borrar un ticket (a nivel RLS) y no había forma
-- de editar uno ya creado (paquete/tamaño/lavador) desde ningún lado. Se
-- agrega:
--   1) usuarios.puede_editar_tickets: bandera que el dueño puede activar
--      por usuario al crearlo o editarlo (independiente del rol), para
--      delegar esta capacidad a un encargado o cajero de confianza.
--   2) La función puede_editar_tickets() (mismo patrón que usuario_rol() /
--      es_autorizador()) para usarla en RLS: true si es dueño O si tiene la
--      bandera activa.
--   3) La política de DELETE de tickets pasa de "solo dueño" a "quien
--      puede_editar_tickets()".
--   4) La vista usuarios_con_correo expone la bandera para el panel de
--      Usuarios.
-- ============================================================================

alter table public.usuarios
  add column if not exists puede_editar_tickets boolean not null default false;

create or replace function public.puede_editar_tickets()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select rol = 'dueno' or puede_editar_tickets
      from public.usuarios
      where id = auth.uid() and activo = true
    ),
    false
  );
$$;

drop policy if exists tickets_delete_dueno on public.tickets;
drop policy if exists tickets_delete_autorizado on public.tickets;
create policy tickets_delete_autorizado on public.tickets
for delete using (public.puede_editar_tickets());

-- CREATE OR REPLACE VIEW no deja reordenar/insertar columnas en medio de
-- una vista existente (solo agregar al final) — como puede_editar_tickets
-- va antes de email en este SELECT, hay que tirar la vista y recrearla en
-- vez de reemplazarla.
drop view if exists public.usuarios_con_correo;

create view public.usuarios_con_correo as
select
  u.id,
  u.nombre,
  u.rol,
  u.activo,
  u.creado_en,
  u.puede_editar_tickets,
  au.email
from public.usuarios u
join auth.users au on au.id = u.id
where public.usuario_rol() = 'dueno';

grant select on public.usuarios_con_correo to authenticated;
