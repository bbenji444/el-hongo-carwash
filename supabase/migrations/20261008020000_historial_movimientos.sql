-- ============================================================================
-- Histórico de movimientos ("logs") — registro de quién creó/editó/eliminó
-- qué y cuándo, para tickets, gastos, ingresos extra y cuentas de usuario.
-- Solo visible para quien tenga puede_ver_historial = true (por ahora,
-- únicamente Benjamin) — el RLS de abajo lo bloquea también a nivel de
-- base de datos, no nada más escondido en la pantalla.
-- ============================================================================

create table public.historial_movimientos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.usuarios (id),
  -- Copiado al momento del movimiento (mismo criterio que ticket_extras con
  -- el catálogo): si el usuario se renombra o se desactiva después, este
  -- renglón del histórico sigue diciendo quién fue en ese momento.
  usuario_nombre text not null,
  accion text not null,
  entidad text not null,
  entidad_id text,
  resumen text not null,
  creado_en timestamptz not null default now()
);

create index historial_movimientos_creado_en_idx on public.historial_movimientos (creado_en desc);

alter table public.historial_movimientos enable row level security;

create policy historial_movimientos_select on public.historial_movimientos
for select using (
  exists (select 1 from public.usuarios where id = auth.uid() and puede_ver_historial = true)
);

create policy historial_movimientos_insert on public.historial_movimientos
for insert with check (public.usuario_rol() is not null and usuario_id = auth.uid());
