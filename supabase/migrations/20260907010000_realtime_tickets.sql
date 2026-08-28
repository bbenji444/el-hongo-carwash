-- ============================================================================
-- El Hongo Car Wash — Fase 23: activa Supabase Realtime en las tablas que
-- necesitan sincronizarse solas entre sesiones abiertas al mismo tiempo
-- (por ejemplo, dos celulares en el mostrador viendo /tickets o /turnos),
-- sin tener que recargar la página a mano.
--
-- Se agregan a la publicación supabase_realtime de forma idempotente (con
-- un chequeo antes de cada ADD TABLE) porque ALTER PUBLICATION ... ADD
-- TABLE no acepta "IF NOT EXISTS" y truena si la tabla ya estaba agregada
-- (por ejemplo, si alguien ya la había activado a mano desde el dashboard
-- de Supabase).
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tickets'
  ) then
    alter publication supabase_realtime add table public.tickets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pagos'
  ) then
    alter publication supabase_realtime add table public.pagos;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'turnos'
  ) then
    alter publication supabase_realtime add table public.turnos;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ticket_extras'
  ) then
    alter publication supabase_realtime add table public.ticket_extras;
  end if;
end $$;
