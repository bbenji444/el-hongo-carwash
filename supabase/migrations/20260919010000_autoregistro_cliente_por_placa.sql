-- ============================================================================
-- El Hongo Car Wash — Fase 36: registro automático de cliente cuando un
-- ticket trae distintivo Y placa, aunque nadie escoja/cree un cliente a
-- mano desde el buscador. Se usa el distintivo como nombre provisional
-- (se puede corregir después desde Editar ticket) — así un registro rápido
-- de "solo carro y placa" ya no se pierde y sí aparece en Clientes /
-- acumula su lealtad. Si la placa ya estaba vinculada a un cliente
-- existente, se reutiliza ese cliente en vez de crear uno nuevo.
--
-- Esto es puramente de la app (crearTicket/actualizarTicket ahora lo hacen
-- solos) EXCEPTO por los tickets que ya se registraron antes de este
-- cambio: este backfill puntual los recorre una sola vez y les crea/vincula
-- su cliente, para que hoy mismo aparezcan reflejados en Clientes.
-- ============================================================================

do $$
declare
  r record;
  v_vehiculo_id uuid;
  v_cliente_id uuid;
  v_tipo_vehiculo text;
begin
  for r in
    select distinct on (upper(btrim(t.placa)))
      upper(btrim(t.placa)) as placa_norm,
      t.placa as placa_original,
      t.distintivo,
      t.tamano_vehiculo
    from public.tickets t
    where t.cliente_id is null
      and t.placa is not null and btrim(t.placa) <> ''
      and t.distintivo is not null and btrim(t.distintivo) <> ''
    order by upper(btrim(t.placa)), t.hora_entrada desc
  loop
    v_cliente_id := null;
    v_vehiculo_id := null;

    select v.id, v.cliente_id into v_vehiculo_id, v_cliente_id
    from public.vehiculos v
    where upper(btrim(v.placas)) = r.placa_norm
    limit 1;

    if v_cliente_id is null then
      v_tipo_vehiculo := case r.tamano_vehiculo
        when 'automovil' then 'Automóvil'
        when 'camioneta_chica' then 'Camioneta Chica'
        when 'camioneta_grande' then 'Camioneta Grande'
        when 'camioneta_extra_grande' then 'Camioneta Extra Grande'
        when 'moto_chica' then 'Moto Chica'
        when 'moto_grande' then 'Moto Grande'
        else r.tamano_vehiculo::text
      end;

      insert into public.clientes (nombre, telefono)
      values (r.distintivo, null)
      returning id into v_cliente_id;

      insert into public.vehiculos (cliente_id, placas, tipo_vehiculo)
      values (v_cliente_id, r.placa_original, v_tipo_vehiculo)
      returning id into v_vehiculo_id;
    end if;

    update public.tickets
    set cliente_id = v_cliente_id,
        vehiculo_id = coalesce(vehiculo_id, v_vehiculo_id)
    where cliente_id is null
      and upper(btrim(placa)) = r.placa_norm;
  end loop;
end $$;
