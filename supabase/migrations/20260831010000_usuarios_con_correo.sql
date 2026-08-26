-- ============================================================================
-- El Hongo Car Wash — Fase 16: panel de administración de usuarios.
--
-- public.usuarios no guarda el correo (vive en auth.users, que no es
-- consultable directo desde el cliente). Se agrega una vista que junta
-- ambos, protegida en el propio WHERE con usuario_rol() = 'dueno' — así
-- cualquier otro rol simplemente no ve renglones, sin necesitar RLS aparte
-- sobre la vista (las vistas heredan los privilegios de quien las creó
-- para leer auth.users, que un usuario normal no tiene).
-- ============================================================================

create or replace view public.usuarios_con_correo as
select
  u.id,
  u.nombre,
  u.rol,
  u.activo,
  u.creado_en,
  au.email
from public.usuarios u
join auth.users au on au.id = u.id
where public.usuario_rol() = 'dueno';

grant select on public.usuarios_con_correo to authenticated;
