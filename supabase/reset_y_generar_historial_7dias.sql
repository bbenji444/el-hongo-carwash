-- ============================================================================
-- El Hongo Car Wash — Reset de ventas + historial de prueba (últimos 7 días)
--
-- ADVERTENCIA: este script BORRA PERMANENTEMENTE todos los turnos, tickets
-- y pagos actuales (todo el historial de ventas real hasta hoy). No hay
-- forma de recuperarlo después de correrlo. Corre esto solo si de verdad
-- quieres dejar el sistema "como nuevo" para pruebas.
--
-- Qué hace, en orden:
--   1) Borra TODOS los pagos, tickets y turnos existentes.
--      (NO toca clientes, vehículos ni usuarios — esos se conservan.)
--   2) Borra del catálogo cualquier paquete que NO sea uno de los 4
--      paquetes reales (Básico, Plus, Hongo Premium, Hongo Max). Como ya no
--      quedan tickets que los referencien, el borrado ya no lo bloquea la
--      llave foránea que antes lo impedía.
--   3) Genera lavadas de prueba de los últimos 7 días para los clientes que
--      YA existen (no crea clientes nuevos), usando solo los 4 paquetes
--      reales y sus precios por tamaño de vehículo. Cada cliente recibe
--      entre 1 y 6 lavadas repartidas al azar en la semana. El programa de
--      lealtad (6ta lavada gratis) se calcula solo, insertando en orden
--      cronológico igual que en producción.
--
-- Requiere que ya haya corrido la migración
-- supabase/migrations/20260827010000_paquetes_por_tamano_vehiculo.sql.
-- ============================================================================

begin;

delete from public.pagos;
delete from public.tickets;
delete from public.turnos;

delete from public.servicios_catalogo
where nombre not in ('Básico', 'Plus', 'Hongo Premium', 'Hongo Max');

do $$
declare
  v_usuario_ids uuid[];
  v_servicio_ids uuid[];
  v_n_servicios int;
  v_n_usuarios int;
  v_tamanos_vehiculo text[4] := array['automovil', 'camioneta_chica', 'camioneta_grande', 'camioneta_extra_grande'];
  v_apertura_id uuid;

  v_cliente_id uuid;
  v_vehiculo_id uuid;
  v_turno_id uuid;
  v_ticket_id uuid;
  v_empleado_id uuid;
  v_servicio_id uuid;
  v_tamano_vehiculo tamano_vehiculo;
  v_precio numeric(10, 2);
  v_descuento numeric(10, 2);
  v_monto numeric(10, 2);
  v_metodo pago_metodo;
  v_metodos text[3] := array['efectivo', 'tarjeta', 'transferencia'];
  v_hora_entrada timestamptz;
  v_n int;
  v_dias_cliente int[];
  v_dia int;
begin
  alter table public.pagos disable trigger tr_pago_bloquea_turno_cerrado;

  select array_agg(id) into v_usuario_ids from public.usuarios where activo = true;
  select array_agg(id) into v_servicio_ids from public.servicios_catalogo where activo = true;

  if v_usuario_ids is null or array_length(v_usuario_ids, 1) = 0 then
    raise exception 'No hay usuarios activos para asignar como empleados.';
  end if;
  if v_servicio_ids is null or array_length(v_servicio_ids, 1) = 0 then
    raise exception 'No hay paquetes activos en el catalogo.';
  end if;
  v_n_servicios := array_length(v_servicio_ids, 1);
  v_n_usuarios := array_length(v_usuario_ids, 1);
  v_apertura_id := v_usuario_ids[1];

  create temp table if not exists tmp_turnos_dia (
    dia int primary key,
    turno_id uuid not null,
    total_efectivo numeric(10, 2) not null default 0
  ) on commit drop;

  -- Por cada cliente ya existente: entre 1 y 6 lavadas en días distintos al
  -- azar dentro de los últimos 7, procesadas en orden cronológico para que
  -- el ciclo de lealtad se calcule igual que en producción (una lavada real
  -- a la vez, en orden).
  for v_cliente_id in select id from public.clientes loop
    select v.id into v_vehiculo_id from public.vehiculos v where v.cliente_id = v_cliente_id limit 1;

    v_n := 1 + floor(random() * 6)::int;

    select array_agg(d order by d desc) into v_dias_cliente
    from (
      select d from generate_series(0, 6) as d order by random() limit v_n
    ) sub;

    for w in 1..v_n loop
      v_dia := v_dias_cliente[w];

      select turno_id into v_turno_id from tmp_turnos_dia where dia = v_dia;
      if v_turno_id is null then
        insert into public.turnos (
          usuario_apertura_id, usuario_cierre_id, efectivo_inicial, estado, hora_apertura, hora_cierre
        ) values (
          v_apertura_id, v_apertura_id, 500, 'cerrado',
          (current_date - v_dia) + time '09:00',
          (current_date - v_dia) + time '18:00'
        ) returning id into v_turno_id;

        insert into tmp_turnos_dia (dia, turno_id) values (v_dia, v_turno_id);
      end if;

      v_empleado_id := v_usuario_ids[1 + floor(random() * v_n_usuarios)::int];
      v_servicio_id := v_servicio_ids[1 + floor(random() * v_n_servicios)::int];
      v_tamano_vehiculo := (v_tamanos_vehiculo[1 + floor(random() * 4)::int])::tamano_vehiculo;
      select precio into v_precio
      from public.servicios_precios
      where servicio_id = v_servicio_id and tamano_vehiculo = v_tamano_vehiculo;

      v_hora_entrada := (current_date - v_dia) + time '09:00'
        + (floor(random() * 8)::int * interval '1 hour')
        + (floor(random() * 60)::int * interval '1 minute');

      -- No se fija descuento_monto a mano: el trigger de lealtad lo calcula y
      -- lo fuerza solo si esta es la 6ta lavada del ciclo del cliente.
      insert into public.tickets (
        vehiculo_id, cliente_id, servicio_id, tamano_vehiculo, empleado_id, turno_id,
        estado, hora_entrada, hora_salida, creado_por
      ) values (
        v_vehiculo_id, v_cliente_id, v_servicio_id, v_tamano_vehiculo, v_empleado_id, v_turno_id,
        'entregado', v_hora_entrada, v_hora_entrada + interval '35 minutes', v_empleado_id
      ) returning id, descuento_monto into v_ticket_id, v_descuento;

      v_monto := v_precio - v_descuento;

      if v_monto > 0 then
        v_metodo := (v_metodos[1 + floor(random() * 3)::int])::pago_metodo;

        insert into public.pagos (ticket_id, metodo, monto, turno_id, usuario_id, creado_en)
        values (v_ticket_id, v_metodo, v_monto, v_turno_id, v_empleado_id, v_hora_entrada + interval '35 minutes');

        if v_metodo = 'efectivo' then
          update tmp_turnos_dia set total_efectivo = total_efectivo + v_monto where dia = v_dia;
        end if;
      end if;
    end loop;
  end loop;

  -- Cierra los numeros de cada turno usado (sin diferencia, libros limpios).
  update public.turnos t
  set efectivo_esperado = t.efectivo_inicial + td.total_efectivo,
      efectivo_contado = t.efectivo_inicial + td.total_efectivo,
      diferencia = 0
  from tmp_turnos_dia td
  where td.turno_id = t.id;

  alter table public.pagos enable trigger tr_pago_bloquea_turno_cerrado;

  raise notice 'Listo: ventas reiniciadas y historial de prueba de 7 dias generado para los clientes existentes.';
end $$;

commit;
