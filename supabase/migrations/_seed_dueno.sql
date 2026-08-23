-- Vincula el primer usuario (creado en Auth) como dueño en public.usuarios.
-- Este es un paso manual único: RLS bloquea el auto-registro porque aún no existe ningún dueño.
insert into public.usuarios (id, nombre, rol, activo)
values ('5b5c8903-d8fb-492f-be78-0aeaff716355', 'El Hongo Admin', 'dueno', true);

-- Verificación
select id, nombre, rol, activo, creado_en
from public.usuarios
where id = '5b5c8903-d8fb-492f-be78-0aeaff716355';
