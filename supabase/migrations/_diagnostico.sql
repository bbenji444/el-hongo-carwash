-- Diagnóstico de precisión: lista nombres únicos para confirmar que no hay duplicados reales.
-- Pega las 3 tablas de resultado (o dime cuántas filas trae cada SELECT).

-- 1) Triggers únicos por nombre de objeto (debería dar 6 filas)
select tgname as trigger_nombre, relname as tabla
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal
order by relname, tgname;

-- 2) Funciones únicas por nombre (debería dar 8 filas: usuario_rol, es_autorizador + 6 trg_fn_*)
select routine_name
from information_schema.routines
where routine_schema = 'public' and routine_type = 'FUNCTION'
group by routine_name
order by routine_name;

-- 3) Tablas SIN ninguna policy (debería dar 0 filas — si aparece alguna, esa tabla quedó sin RLS real aunque rls_ok diga true)
select c.relname as tabla_sin_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = true
  and not exists (
    select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
  );
