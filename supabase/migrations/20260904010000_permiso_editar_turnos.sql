-- ============================================================================
-- El Hongo Car Wash — Fase 20: permiso delegable para editar turnos ya
-- cerrados (corregir efectivo inicial o efectivo contado si hubo un error
-- de captura al cerrar la caja).
--
-- Mismo patrón que puede_editar_tickets (Fase 17):
--   1) usuarios.puede_editar_turnos: bandera delegable por el dueño.
--   2) función puede_editar_turnos() para usarla en RLS.
--   3) turnos_update ahora también permite tocar un turno YA cerrado si
--      quien lo hace tiene el permiso (antes solo el dueño podía tocar
--      cualquier turno; encargado/cajero solo mientras seguía abierto).
--   4) El trigger de cierre solo recalculaba efectivo_esperado/diferencia
--      en la transición abierto→cerrado; ahora también recalcula cuando se
--      edita efectivo_inicial o efectivo_contado de un turno que ya está
--      cerrado, para que la diferencia mostrada siempre quede consistente
--      con la corrección.
--   5) usuarios_con_correo expone la bandera nueva (se agrega al final del
--      SELECT porque CREATE OR REPLACE VIEW no permite insertar columnas
--      en medio de una vista existente).
-- ============================================================================

alter table public.usuarios
  add column if not exists puede_editar_turnos boolean not null default false;

create or replace function public.puede_editar_turnos()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select rol = 'dueno' or puede_editar_turnos
      from public.usuarios
      where id = auth.uid() and activo = true
    ),
    false
  );
$$;

create or replace function public.trg_fn_turno_cierre_calcula()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_efectivo numeric(10, 2);
begin
  if new.estado = 'cerrado' and (
    old.estado is distinct from 'cerrado'
    or new.efectivo_contado is distinct from old.efectivo_contado
    or new.efectivo_inicial is distinct from old.efectivo_inicial
  ) then
    select coalesce(sum(monto), 0) into v_total_efectivo
    from public.pagos
    where turno_id = new.id and metodo = 'efectivo';

    new.efectivo_esperado := new.efectivo_inicial + v_total_efectivo;

    if new.efectivo_contado is null then
      raise exception 'Debes capturar el efectivo contado antes de cerrar el turno.';
    end if;

    new.diferencia := new.efectivo_contado - new.efectivo_esperado;
    new.hora_cierre := coalesce(new.hora_cierre, now());
    new.usuario_cierre_id := coalesce(new.usuario_cierre_id, auth.uid());
  end if;
  return new;
end;
$$;

drop policy if exists turnos_update on public.turnos;
create policy turnos_update on public.turnos
for update using (
  public.usuario_rol() = 'dueno'
  or (public.usuario_rol() in ('encargado', 'cajero') and estado = 'abierto')
  or (estado = 'cerrado' and public.puede_editar_turnos())
)
with check (
  public.usuario_rol() = 'dueno'
  or public.usuario_rol() in ('encargado', 'cajero')
  or public.puede_editar_turnos()
);

create or replace view public.usuarios_con_correo as
select
  u.id,
  u.nombre,
  u.rol,
  u.activo,
  u.creado_en,
  u.puede_editar_tickets,
  au.email,
  u.puede_editar_turnos
from public.usuarios u
join auth.users au on au.id = u.id
where public.usuario_rol() = 'dueno';

grant select on public.usuarios_con_correo to authenticated;
