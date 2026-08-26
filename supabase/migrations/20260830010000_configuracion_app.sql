-- ============================================================================
-- El Hongo Car Wash — Fase 15: panel de configuración editable por el dueño.
--
-- Tabla singleton (un solo renglón, forzado por id boolean + check) con todo
-- lo que el dueño puede personalizar sin tocar código: nombres del menú
-- lateral, emojis, colores de marca y los umbrales del semáforo de espera
-- de Tickets. Cualquier usuario autenticado puede leerla (la necesita para
-- pintar el sidebar); solo el dueño puede escribirla.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'configuracion_app'
  ) then
    create table public.configuracion_app (
      id boolean primary key default true,
      constraint configuracion_app_singleton check (id),

      nav_dashboard text not null default 'Dashboard',
      nav_tickets text not null default 'Tickets',
      nav_servicios text not null default 'Servicios',
      nav_lavadores text not null default 'Lavadores',
      nav_turnos text not null default 'Caja y turnos',
      nav_clientes text not null default 'Clientes',
      nav_inventario text not null default 'Inventario',
      nav_reportes text not null default 'Reportes',

      emoji_saludo text not null default '👋🏻',
      emoji_lavador text not null default '🧑🏻‍🔧',
      emoji_automovil text not null default '🚗',
      emoji_camioneta_chica text not null default '🚙',
      emoji_camioneta_grande text not null default '🚐',
      emoji_camioneta_extra_grande text not null default '🚚',

      color_primario text not null default '#e31e24',
      color_accent text not null default '#0077cc',
      color_success text not null default '#16a34a',
      color_warning text not null default '#b45309',

      semaforo_alerta_min integer not null default 25 check (semaforo_alerta_min > 0),
      semaforo_critico_min integer not null default 35 check (semaforo_critico_min > semaforo_alerta_min)
    );

    insert into public.configuracion_app (id) values (true);
  end if;
end $$;

alter table public.configuracion_app enable row level security;

drop policy if exists configuracion_app_select on public.configuracion_app;
create policy configuracion_app_select on public.configuracion_app
for select using (public.usuario_rol() is not null);

drop policy if exists configuracion_app_update on public.configuracion_app;
create policy configuracion_app_update on public.configuracion_app
for update using (public.usuario_rol() = 'dueno') with check (public.usuario_rol() = 'dueno');
