import { createClient } from "@/lib/supabase/server";
import type { TamanoVehiculo, LavadorTipo } from "@/types/database.types";
import type { RangoResuelto } from "@/lib/rangoFechas";
import { fetchPaginado, fetchEnLotes } from "@/lib/supabaseBatch";

export type ConteoPorTamano = Record<TamanoVehiculo, number>;

function conteoVacio(): ConteoPorTamano {
  return {
    automovil: 0,
    camioneta_chica: 0,
    camioneta_grande: 0,
    camioneta_extra_grande: 0,
    moto_chica: 0,
    moto_grande: 0,
    taxi: 0,
    van: 0,
  };
}

export type LavadorStat = {
  id: string;
  nombre: string;
  activo: boolean;
  tipo: LavadorTipo;
  autosLavados: number;
  ventasGeneradas: number;
  porTamano: ConteoPorTamano;
  // Comisión acumulada en el período: suma de ticket_lavadores.comision
  // (35% del precio de lista del paquete, guardado al registrar cada
  // ticket). Tickets de antes del cambio a comisión no tienen comisión
  // guardada y no suman aquí.
  comision: number;
};

export type DatosLavadores = {
  rango: RangoResuelto;
  lavadores: LavadorStat[];
  generadoEn: string;
};

// Tickets entregados en el rango (por llegada, hora_entrada — mismo criterio
// que ya usaba esta sección) con su monto pagado y lo que le tocó a cada
// lavador asignado.
async function ticketsLavadosEnRango(rango: RangoResuelto) {
  const supabase = await createClient();

  const ticketsRaw = await fetchPaginado((desde, hasta) => {
    let q = supabase
      .from("tickets")
      .select("id, tamano_vehiculo")
      .eq("estado", "entregado")
      .order("id")
      .range(desde, hasta);
    if (rango.desdeIso) q = q.gte("hora_entrada", rango.desdeIso);
    if (rango.hastaIso) q = q.lte("hora_entrada", rango.hastaIso);
    return q;
  });

  const ticketIds = ticketsRaw.map((t) => t.id);
  const [pagos, asignaciones] = await Promise.all([
    fetchEnLotes(ticketIds, (lote) => supabase.from("pagos").select("ticket_id, monto").in("ticket_id", lote)),
    fetchEnLotes(ticketIds, (lote) =>
      supabase.from("ticket_lavadores").select("ticket_id, lavador_id, comision").in("ticket_id", lote)
    ),
  ]);

  const montoPorTicket = new Map<string, number>();
  for (const p of pagos) {
    montoPorTicket.set(p.ticket_id, (montoPorTicket.get(p.ticket_id) ?? 0) + p.monto);
  }

  const asignacionesPorTicket = new Map<string, { lavadorId: string; comision: number }[]>();
  for (const a of asignaciones) {
    const lista = asignacionesPorTicket.get(a.ticket_id) ?? [];
    lista.push({ lavadorId: a.lavador_id, comision: a.comision ?? 0 });
    asignacionesPorTicket.set(a.ticket_id, lista);
  }

  return ticketsRaw
    .map((t) => ({
      id: t.id,
      tamanoVehiculo: t.tamano_vehiculo,
      monto: montoPorTicket.get(t.id) ?? 0,
      asignaciones: asignacionesPorTicket.get(t.id) ?? [],
    }))
    .filter((t) => t.asignaciones.length > 0);
}

export async function obtenerDatosLavadores(rango: RangoResuelto): Promise<DatosLavadores> {
  const supabase = await createClient();

  const [{ data: lavadoresRaw }, tickets] = await Promise.all([
    supabase.from("lavadores").select("*").order("nombre"),
    ticketsLavadosEnRango(rango),
  ]);

  const statsPorLavador = new Map<
    string,
    { autos: number; ventas: number; porTamano: ConteoPorTamano; comision: number }
  >();
  for (const t of tickets) {
    for (const a of t.asignaciones) {
      const entry =
        statsPorLavador.get(a.lavadorId) ?? { autos: 0, ventas: 0, porTamano: conteoVacio(), comision: 0 };
      entry.autos += 1;
      entry.ventas += t.monto;
      entry.porTamano[t.tamanoVehiculo] += 1;
      entry.comision += a.comision;
      statsPorLavador.set(a.lavadorId, entry);
    }
  }

  const lavadores: LavadorStat[] = (lavadoresRaw ?? []).map((l) => {
    const stat = statsPorLavador.get(l.id);
    return {
      id: l.id,
      nombre: l.nombre,
      activo: l.activo,
      tipo: l.tipo,
      autosLavados: stat?.autos ?? 0,
      ventasGeneradas: stat?.ventas ?? 0,
      porTamano: stat?.porTamano ?? conteoVacio(),
      comision: Math.round((stat?.comision ?? 0) * 100) / 100,
    };
  });

  return { rango, lavadores, generadoEn: new Date().toISOString() };
}
