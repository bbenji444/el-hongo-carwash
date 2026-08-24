-- ============================================================================
-- El Hongo Car Wash — Datos de demostración
--
-- Crea 7 clientes falsos (con un vehículo cada uno) y 50 lavadas históricas,
-- repartidas de forma ALEATORIA en los últimos 30 días, con sus pagos
-- correspondientes, para que el dashboard, tickets, clientes y reportes ya
-- muestren actividad como si el sistema se hubiera usado un poco.
--
-- Requiere haber corrido antes la migración
-- supabase/migrations/20260824010000_fix_ciclo_lealtad.sql (corrige el ciclo
-- de lealtad; sin ese fix, este script generaría lavadas gratis de más).
--
-- El trigger de lealtad (6ta lavada gratis) se aplica exactamente igual que
-- en producción: no se fuerza a mano ningún descuento, el propio trigger lo
-- calcula al insertar cada ticket, en el mismo orden cronológico en que se
-- insertan las lavadas de cada cliente.
--
-- Reparto de las 50 lavadas entre los 7 clientes (elegido a propósito para
-- cubrir distintos puntos del ciclo de lealtad):
--   - Laura Méndez:    5 lavadas  -> ya lleva 5 de 6, su próxima es GRATIS.
--   - Roberto Ibarra: 11 lavadas -> 1 gratis ya cobrada + ahora en 5 de 6,
--                                    su próxima TAMBIÉN es gratis.
--   - Karla Sánchez:   6 lavadas  -> completó un ciclo (1 gratis), reinicia en 0.
--   - Diego Torres:    9 lavadas  -> 1 gratis ya cobrada, va en 3 de 6.
--   - Fernanda Ruiz:   3 lavadas  -> apenas arrancando su ciclo.
--   - Adrián Castillo: 8 lavadas  -> 1 gratis ya cobrada, va en 2 de 6.
--   - Paola Jiménez:   8 lavadas  -> 1 gratis ya cobrada, va en 2 de 6.
--
-- Solo se desactiva momentáneamente el trigger anti-robo que bloquea pagos
-- sobre turnos ya cerrados (tr_pago_bloquea_turno_cerrado), porque aquí se
-- insertan turnos ya históricamente cerrados de una vez; se reactiva al
-- final del script pase lo que pase (si algo falla, todo el bloque se
-- revierte, incluyendo esa desactivación).
--
-- Corre esto UNA sola vez. Si se ejecuta de nuevo, se duplicarán los 7
-- clientes falsos y sus 50 lavadas.
-- ============================================================================

do $$
declare
  v_usuario_ids uuid[];
  v_servicio_ids uuid[];
  v_n_servicios int;
  v_n_usuarios int;

  v_nombres text[7] := array[
    'Laura Méndez', 'Roberto Ibarra', 'Karla Sánchez', 'Diego Torres',
    'Fernanda Ruiz', 'Adrián Castillo', 'Paola Jiménez'
  ];
  v_telefonos text[7] := array[
    '5512345678', '5523456789', '5534567890', '5545678901',
    '5556789012', '5567890123', '5578901234'
  ];
  v_placas text[7] := array[
    'ABC-123-A', 'XYZ-987-B', 'JKL-456-C', 'MNO-789-D',
    'QRS-321-E', 'TUV-654-F', 'GHI-098-G'
  ];
  v_tipos_vehiculo text[7] := array['Sedán', 'SUV', 'Pickup', 'Hatchback', 'Sedán', 'SUV', 'Hatchback'];
  -- Suma exacta: 5+11+6+9+3+8+8 = 50.
  v_totales int[7] := array[5, 11, 6, 9, 3, 8, 8];
  v_cliente_ids uuid[7];

  v_cliente_id_tmp uuid;
  v_vehiculo_id uuid;
  v_turno_id uuid;
  v_ticket_id uuid;
  v_apertura_id uuid;
  v_empleado_id uuid;
  v_servicio_id uuid;
  v_precio numeric(10, 2);
  v_descuento numeric(10, 2);
  v_monto numeric(10, 2);
  v_metodo pago_metodo;
  v_metodos text[3] := array['efectivo', 'tarjeta', 'transferencia'];
  v_hora_entrada timestamptz;
  v_dias_cliente int[];
  v_dia int;
  v_n int;
begin
  alter table public.pagos disable trigger tr_pago_bloquea_turno_cerrado;

  select array_agg(id) into v_usuario_ids from public.usuarios where activo = true;
  select array_agg(id) into v_servicio_ids from public.servicios_catalogo where activo = true;

  if v_usuario_ids is null or array_length(v_usuario_ids, 1) = 0 then
    raise exception 'No hay usuarios activos para asignar como empleados.';
  end if;
  if v_servicio_ids is null or array_length(v_servicio_ids, 1) = 0 then
    raise exception 'No hay servicios activos en el catalogo.';
  end if;
  v_n_servicios := array_length(v_servicio_ids, 1);
  v_n_usuarios := array_length(v_usuario_ids, 1);
  v_apertura_id := v_usuario_ids[1];

  create temp table if not exists tmp_turnos_dia (
    dia int primary key,
    turno_id uuid not null,
    total_efectivo numeric(10, 2) not null default 0
  ) on commit drop;

  -- 7 clientes falsos, cada uno con un vehículo.
  for i in 1..7 loop
    insert into public.clientes (nombre, telefono)
    values (v_nombres[i], v_telefonos[i])
    returning id into v_cliente_id_tmp;

    v_cliente_ids[i] := v_cliente_id_tmp;

    insert into public.vehiculos (cliente_id, placas, tipo_vehiculo)
    values (v_cliente_id_tmp, v_placas[i], v_tipos_vehiculo[i]);
  end loop;

  -- Por cada cliente: N días distintos al azar dentro de los últimos 30,
  -- procesados en orden cronológico para que el ciclo de lealtad se calcule
  -- igual que en producción (una lavada real a la vez, en orden).
  for c in 1..7 loop
    v_n := v_totales[c];

    select array_agg(d order by d) into v_dias_cliente
    from (
      select d from generate_series(0, 29) as d order by random() limit v_n
    ) sub;

    select v.id into v_vehiculo_id from public.vehiculos v where v.cliente_id = v_cliente_ids[c] limit 1;

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
      select precio into v_precio from public.servicios_catalogo where id = v_servicio_id;

      v_hora_entrada := (current_date - v_dia) + time '09:00'
        + (floor(random() * 8)::int * interval '1 hour')
        + (floor(random() * 60)::int * interval '1 minute');

      -- No se fija descuento_monto a mano: el trigger de lealtad lo calcula y
      -- lo fuerza solo si esta es la 6ta lavada del ciclo del cliente.
      insert into public.tickets (
        vehiculo_id, cliente_id, servicio_id, empleado_id, turno_id,
        estado, hora_entrada, hora_salida, creado_por
      ) values (
        v_vehiculo_id, v_cliente_ids[c], v_servicio_id, v_empleado_id, v_turno_id,
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

  raise notice 'Listo: 7 clientes falsos y 50 lavadas historicas creadas en los ultimos 30 dias.';
end $$;
