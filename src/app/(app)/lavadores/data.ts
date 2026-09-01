import { createClient } from "@/lib/supabase/server";
import type { TamanoVehiculo } from "@/types/database.types";
import type { RangoResuelto } from "@/lib/rangoFechas";

export type ConteoPorTamano = Record<TamanoVehiculo, number>;

function conteoVacio(): ConteoPorTamano {
  return {
    automovil: 0,
    camioneta_chica: 0,
    camioneta_grande: 0,
    camioneta_extra_grande: 0,
    moto_chica: 0,
    moto_grande: 0,
  };
}

export type LavadorStat = {
  id: string;
  nombre: string;
  activo: boolean;
  autosLavados: number;
  ventasGeneradas: number;
  porTamano: ConteoPorTamano;
  // Promedio de "Iniciar" a "Terminado" (minutos). null si ninguno de sus
  // tickets en el rango tiene ambas marcas de tiempo capturadas.
  tiempoPromedioLavadoMin: number | null;
};

export type DatosLavadores = {
  rango: RangoResuelto;
  lavadores: LavadorStat[];
  generadoEn: string;
};

async function ticketsLavadosEnRango(rango: RangoResuelto) {
  const supabase = await createClient();

  const ticketsQuery = supabase
    .from("tickets")
    .select("id, lavador_id, tamano_vehiculo, hora_entrada, hora_inicio_lavado, hora_fin_lavado")
    .eq("estado", "entregado")
    .not("lavador_id", "is", null);
  if (rango.desdeIso) ticketsQuery.gte("hora_entrada", rango.desdeIso);
  if (rango.hastaIso) ticketsQuery.lte("hora_entrada", rango.hastaIso);

  const { data: tickets } = await ticketsQuery;
  const ticketIds = (tickets ?? []).map((t) => t.id);

  const { data: pagos } = ticketIds.length
    ? await supabase.from("pagos").select("ticket_id, monto").in("ticket_id", ticketIds)
    : { data: [] };

  const montoPorTicket = new Map<string, number>();
  for (const p of pagos ?? []) {
    montoPorTicket.set(p.ticket_id, (montoPorTicket.get(p.ticket_id) ?? 0) + p.monto);
  }

  return (tickets ?? []).map((t) => ({
    id: t.id,
    lavadorId: t.lavador_id as string,
    tamanoVehiculo: t.tamano_vehiculo,
    monto: montoPorTicket.get(t.id) ?? 0,
    tiempoLavadoMin:
      t.hora_inicio_lavado && t.hora_fin_lavado
        ? (new Date(t.hora_fin_lavado).getTime() - new Date(t.hora_inicio_lavado).getTime()) / 60000
        : null,
  }));
}

export async function obtenerDatosLavadores(rango: RangoResuelto): Promise<DatosLavadores> {
  const supabase = await createClient();

  const [{ data: lavadoresRaw }, tickets] = await Promise.all([
    supabase.from("lavadores").select("*").order("nombre"),
    ticketsLavadosEnRango(rango),
  ]);

  const statsPorLavador = new Map<
    string,
    { autos: number; ventas: number; porTamano: ConteoPorTamano; sumaTiempoMin: number; conTiempo: number }
  >();
  for (const t of tickets) {
    const entry =
      statsPorLavador.get(t.lavadorId) ?? { autos: 0, ventas: 0, porTamano: conteoVacio(), sumaTiempoMin: 0, conTiempo: 0 };
    entry.autos += 1;
    entry.ventas += t.monto;
    entry.porTamano[t.tamanoVehiculo] += 1;
    if (t.tiempoLavadoMin !== null) {
      entry.sumaTiempoMin += t.tiempoLavadoMin;
      entry.conTiempo += 1;
    }
    statsPorLavador.set(t.lavadorId, entry);
  }

  const lavadores: LavadorStat[] = (lavadoresRaw ?? []).map((l) => {
    const stat =
      statsPorLavador.get(l.id) ?? { autos: 0, ventas: 0, porTamano: conteoVacio(), sumaTiempoMin: 0, conTiempo: 0 };
    return {
      id: l.id,
      nombre: l.nombre,
      activo: l.activo,
      autosLavados: stat.autos,
      ventasGeneradas: stat.ventas,
      porTamano: stat.porTamano,
      tiempoPromedioLavadoMin: stat.conTiempo > 0 ? stat.sumaTiempoMin / stat.conTiempo : null,
    };
  });

  return { rango, lavadores, generadoEn: new Date().toISOString() };
}
