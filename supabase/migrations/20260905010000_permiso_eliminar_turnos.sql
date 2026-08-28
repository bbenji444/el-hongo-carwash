-- ============================================================================
-- El Hongo Car Wash — Fase 21: permiso delegable para eliminar turnos por
-- completo (junto con sus tickets y pagos) — para corregir un turno abierto
-- o cerrado por error, no para editar cifras: eso ya lo cubre
-- puede_editar_turnos de la Fase 20.
--
-- Mismo patrón que puede_editar_turnos:
--   1) usuarios.puede_eliminar_turnos: bandera delegable por el dueño.
--   2) función puede_eliminar_turnos() para usarla en RLS.
--   3) Nueva política turnos_delete — antes NO existía ninguna política de
--      DELETE en turnos, así que nadie podía borrar uno, ni siquiera el
--      dueño.
--   4) Las políticas de DELETE de pagos y tickets se amplían para aceptar
--      también puede_eliminar_turnos(): si no, borrar un turno con
--      historial fallaría por llave foránea al no poder borrar primero sus
--      pagos/tickets asociados (el orden de borrado — pagos, luego
--      tickets, luego el turno — lo maneja la acción del servidor).
--   5) usuarios_con_correo expone la bandera nueva.
-- ============================================================================

alter table public.usuarios
  add column if not exists puede_eliminar_turnos boolean not null default false;

create or replace function public.puede_eliminar_turnos()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select rol = 'dueno' or puede_eliminar_turnos
      from public.usuarios
      where id = auth.uid() and activo = true
    ),
    false
  );
$$;

drop policy if exists turnos_delete on public.turnos;
create policy turnos_delete on public.turnos
for delete using (public.puede_eliminar_turnos());

drop policy if exists pagos_delete_dueno on public.pagos;
drop policy if exists pagos_delete_autorizado on public.pagos;
create policy pagos_delete_autorizado on public.pagos
for delete using (public.usuario_rol() = 'dueno' or public.puede_eliminar_turnos());

drop policy if exists tickets_delete_dueno on public.tickets;
drop policy if exists tickets_delete_autorizado on public.tickets;
create policy tickets_delete_autorizado on public.tickets
for delete using (public.puede_editar_tickets() or public.puede_eliminar_turnos());

create or replace view public.usuarios_con_correo as
select
  u.id,
  u.nombre,
  u.rol,
  u.activo,
  u.creado_en,
  u.puede_editar_tickets,
  au.email,
  u.puede_editar_turnos,
  u.puede_eliminar_turnos
from public.usuarios u
join auth.users au on au.id = u.id
where public.usuario_rol() = 'dueno';

grant select on public.usuarios_con_correo to authenticated;
