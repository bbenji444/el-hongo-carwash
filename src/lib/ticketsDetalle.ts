import { createClient } from "@/lib/supabase/server";
import type { RangoResuelto } from "@/lib/rangoFechas";
import type { TamanoVehiculo, PagoMetodo } from "@/types/database.types";

export type FiltrosTicketsDetalle = {
  servicio?: string;
  tamano?: TamanoVehiculo | "";
  metodo?: PagoMetodo | "";
  lavador?: string;
  q?: string;
};

export type TicketDetalleFila = {
  id: string;
  turnoId: string | null;
  horaEntrada: string;
  cliente: string;
  distintivoPlaca: string;
  servicio: string;
  tamanoVehiculo: TamanoVehiculo;
  lavador: string;
  estado: string;
  metodo: string;
  monto: number;
};

// Techo de seguridad para la consulta cruda antes de filtrar en JS (método
// de pago y texto de búsqueda no se pueden filtrar limpio del lado de la
// base de datos aquí sin arriesgar inyección en el DSL de filtros de
// PostgREST) — en la práctica casi siempre se combina con al menos un
// filtro (lavador, rango de fechas corto, etc.) que ya acota bastante.
const TECHO_CONSULTA = 3000;
const LIMITE_MOSTRADO = 300;

export async function buscarTicketsDetalle(rango: RangoResuelto, filtros: FiltrosTicketsDetalle) {
  const supabase = await createClient();

  let query = supabase
    .from("tickets")
    .select(
      "id, turno_id, cliente_id, distintivo, placa, servicio_id, tamano_vehiculo, estado, hora_entrada, lavada_gratis"
    )
    .order("hora_entrada", { ascending: false })
    .limit(TECHO_CONSULTA);

  if (rango.desdeIso) query = query.gte("hora_entrada", rango.desdeIso);
  if (rango.hastaIso) query = query.lte("hora_entrada", rango.hastaIso);
  if (filtros.servicio) query = query.eq("servicio_id", filtros.servicio);
  if (filtros.tamano) query = query.eq("tamano_vehiculo", filtros.tamano);

  const { data: ticketsRaw } = await query;
  const todosLosTickets = ticketsRaw ?? [];

  const servicioIds = [...new Set(todosLosTickets.map((t) => t.servicio_id))];
  const clienteIds = [...new Set(todosLosTickets.map((t) => t.cliente_id).filter(Boolean))] as string[];
  const ticketIdsTodos = todosLosTickets.map((t) => t.id);

  const [{ data: servicios }, { data: clientes }, { data: lavadores }, { data: pagos }, { data: asignaciones }] =
    await Promise.all([
      servicioIds.length
        ? supabase.from("servicios_catalogo").select("id, nombre").in("id", servicioIds)
        : Promise.resolve({ data: [] }),
      clienteIds.length
        ? supabase.from("clientes").select("id, nombre").in("id", clienteIds)
        : Promise.resolve({ data: [] }),
      supabase.from("lavadores").select("id, nombre"),
      ticketIdsTodos.length
        ? supabase.from("pagos").select("ticket_id, monto, metodo").in("ticket_id", ticketIdsTodos)
        : Promise.resolve({ data: [] }),
      ticketIdsTodos.length
        ? supabase.from("ticket_lavadores").select("ticket_id, lavador_id").in("ticket_id", ticketIdsTodos)
        : Promise.resolve({ data: [] }),
    ]);

  const nombrePorServicio = new Map((servicios ?? []).map((s) => [s.id, s.nombre]));
  const nombrePorCliente = new Map((clientes ?? []).map((c) => [c.id, c.nombre]));
  const nombrePorLavador = new Map((lavadores ?? []).map((l) => [l.id, l.nombre]));

  // Uno o más lavadores por ticket (empiezan a lavar en pareja a veces).
  const lavadorIdsPorTicket = new Map<string, string[]>();
  for (const a of asignaciones ?? []) {
    const lista = lavadorIdsPorTicket.get(a.ticket_id) ?? [];
    lista.push(a.lavador_id);
    lavadorIdsPorTicket.set(a.ticket_id, lista);
  }

  const tickets = filtros.lavador
    ? todosLosTickets.filter((t) => (lavadorIdsPorTicket.get(t.id) ?? []).includes(filtros.lavador!))
    : todosLosTickets;

  const pagosPorTicket = new Map<string, { monto: number; metodo: PagoMetodo }[]>();
  for (const p of pagos ?? []) {
    const lista = pagosPorTicket.get(p.ticket_id) ?? [];
    lista.push({ monto: p.monto, metodo: p.metodo });
    pagosPorTicket.set(p.ticket_id, lista);
  }

  const qNorm = (filtros.q ?? "").trim().toLowerCase();

  const filas: TicketDetalleFila[] = [];
  for (const t of tickets) {
    if (qNorm) {
      const candidatos = [t.distintivo, t.placa].filter((v): v is string => Boolean(v)).map((v) => v.toLowerCase());
      if (!candidatos.some((c) => c.includes(qNorm))) continue;
    }

    const pagosTicket = pagosPorTicket.get(t.id) ?? [];
    if (filtros.metodo && !pagosTicket.some((p) => p.metodo === filtros.metodo)) continue;

    filas.push({
      id: t.id,
      turnoId: t.turno_id,
      horaEntrada: t.hora_entrada,
      cliente: t.cliente_id ? nombrePorCliente.get(t.cliente_id) ?? "—" : (t.distintivo ?? "Mostrador"),
      distintivoPlaca: [t.distintivo, t.placa].filter(Boolean).join(" · ") || "—",
      servicio: nombrePorServicio.get(t.servicio_id) ?? "—",
      tamanoVehiculo: t.tamano_vehiculo,
      lavador:
        (lavadorIdsPorTicket.get(t.id) ?? [])
          .map((id) => nombrePorLavador.get(id) ?? "—")
          .join(", ") || "—",
      estado: t.estado,
      metodo: t.lavada_gratis ? "Gratis" : pagosTicket.map((p) => p.metodo).join(", ") || "—",
      monto: pagosTicket.reduce((acc, p) => acc + p.monto, 0),
    });
  }

  const lavadorIdsPresentes = new Set<string>();
  for (const ids of lavadorIdsPorTicket.values()) {
    for (const id of ids) lavadorIdsPresentes.add(id);
  }

  return {
    filas: filas.slice(0, LIMITE_MOSTRADO),
    totalCoincidencias: filas.length,
    lavadoresPresentes: [...lavadorIdsPresentes]
      .map((id) => [id, nombrePorLavador.get(id) ?? "—"] as [string, string])
      .sort((a, b) => a[1].localeCompare(b[1])),
    serviciosPresentes: [...nombrePorServicio.entries()].sort((a, b) => a[1].localeCompare(b[1])) as [string, string][],
  };
}
