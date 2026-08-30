import { createClient } from "@/lib/supabase/server";
import { PERIODOS, resolverRango, queryStringRango, type RangoResuelto } from "@/lib/rangoFechas";

// Se reexportan para no tener que tocar los imports existentes en page.tsx
// y en las rutas de exportar/ (pdf, excel), que siguen importando esto
// desde "./data" / "../../data".
export { PERIODOS, resolverRango, queryStringRango };
export type { Periodo, ParamsRango, RangoResuelto } from "@/lib/rangoFechas";

export type VentaPorServicio = { nombre: string; tickets: number; total: number };

export type DescuentoDetalle = {
  id: string;
  fecha: string;
  servicio: string;
  empleado: string;
  autorizadoPor: string;
  monto: number;
};

export type CierreTurno = {
  id: string;
  horaCierre: string | null;
  abrio: string;
  cerro: string;
  inicial: number;
  esperado: number | null;
  contado: number | null;
  diferencia: number | null;
  alertaDiferencia: boolean;
  // Ganancia real del turno: suma de todos los pagos (efectivo + tarjeta +
  // transferencia) de sus tickets. A propósito NO es lo mismo que
  // "esperado" (que sí incluye el efectivo inicial de caja, porque ese es
  // el monto que se debe contar físicamente al cerrar) — el efectivo
  // inicial nunca fue una venta, solo el fondo fijo para dar cambio.
  ganancia: number;
};

export type DatosReporte = {
  rango: RangoResuelto;
  ventasTotales: number;
  numTickets: number;
  ticketPromedio: number;
  totalDescuentos: number;
  diferenciaAcumulada: number;
  turnosConAlerta: number;
  ventasPorMetodo: Record<string, number>;
  ventasPorServicio: VentaPorServicio[];
  descuentos: DescuentoDetalle[];
  turnos: CierreTurno[];
  generadoEn: string;
};

export async function obtenerDatosReporte(rango: RangoResuelto): Promise<DatosReporte> {
  const supabase = await createClient();

  const turnosQuery = supabase
    .from("turnos")
    .select("*")
    .eq("estado", "cerrado")
    .order("hora_cierre", { ascending: false });
  if (rango.desdeIso) turnosQuery.gte("hora_cierre", rango.desdeIso);
  if (rango.hastaIso) turnosQuery.lte("hora_cierre", rango.hastaIso);

  const ticketsQuery = supabase
    .from("tickets")
    .select("id, servicio_id, empleado_id, creado_por, descuento_monto, descuento_autorizado_por, estado, hora_entrada")
    .eq("estado", "entregado")
    .order("hora_entrada", { ascending: false });
  if (rango.desdeIso) ticketsQuery.gte("hora_entrada", rango.desdeIso);
  if (rango.hastaIso) ticketsQuery.lte("hora_entrada", rango.hastaIso);

  const pagosQuery = supabase
    .from("pagos")
    .select("ticket_id, turno_id, monto, metodo, creado_en")
    .order("creado_en", { ascending: false });
  if (rango.desdeIso) pagosQuery.gte("creado_en", rango.desdeIso);
  if (rango.hastaIso) pagosQuery.lte("creado_en", rango.hastaIso);

  const [{ data: turnosRaw }, { data: tickets }, { data: pagos }, { data: servicios }, { data: usuarios }] =
    await Promise.all([
      turnosQuery,
      ticketsQuery,
      pagosQuery,
      supabase.from("servicios_catalogo").select("id, nombre"),
      supabase.from("usuarios").select("id, nombre"),
    ]);

  const nombrePorUsuario = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]));
  const nombrePorServicio = new Map((servicios ?? []).map((s) => [s.id, s.nombre]));

  const montoPorTicket = new Map<string, number>();
  const gananciaPorTurno = new Map<string, number>();
  const ventasPorMetodo: Record<string, number> = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  for (const pago of pagos ?? []) {
    montoPorTicket.set(pago.ticket_id, (montoPorTicket.get(pago.ticket_id) ?? 0) + pago.monto);
    gananciaPorTurno.set(pago.turno_id, (gananciaPorTurno.get(pago.turno_id) ?? 0) + pago.monto);
    ventasPorMetodo[pago.metodo] = (ventasPorMetodo[pago.metodo] ?? 0) + pago.monto;
  }

  const ventasTotales = (pagos ?? []).reduce((acc, p) => acc + p.monto, 0);
  const numTickets = (tickets ?? []).length;
  const ticketPromedio = numTickets > 0 ? ventasTotales / numTickets : 0;
  const totalDescuentos = (tickets ?? []).reduce((acc, t) => acc + t.descuento_monto, 0);
  const diferenciaAcumulada = (turnosRaw ?? []).reduce((acc, t) => acc + (t.diferencia ?? 0), 0);
  const turnosConAlerta = (turnosRaw ?? []).filter((t) => t.alerta_diferencia).length;

  const ventasPorServicioMap = new Map<string, VentaPorServicio>();
  for (const t of tickets ?? []) {
    const nombre = nombrePorServicio.get(t.servicio_id) ?? "—";
    const entry = ventasPorServicioMap.get(t.servicio_id) ?? { nombre, tickets: 0, total: 0 };
    entry.tickets += 1;
    entry.total += montoPorTicket.get(t.id) ?? 0;
    ventasPorServicioMap.set(t.servicio_id, entry);
  }
  const ventasPorServicio = Array.from(ventasPorServicioMap.values()).sort((a, b) => b.total - a.total);

  const descuentos: DescuentoDetalle[] = (tickets ?? [])
    .filter((t) => t.descuento_monto > 0)
    .map((t) => ({
      id: t.id,
      fecha: t.hora_entrada,
      servicio: nombrePorServicio.get(t.servicio_id) ?? "—",
      empleado: nombrePorUsuario.get(t.creado_por) ?? "—",
      autorizadoPor: t.descuento_autorizado_por ?? "—",
      monto: t.descuento_monto,
    }));

  const turnos: CierreTurno[] = (turnosRaw ?? []).map((t) => ({
    id: t.id,
    horaCierre: t.hora_cierre,
    abrio: nombrePorUsuario.get(t.usuario_apertura_id) ?? "—",
    cerro: t.usuario_cierre_id ? nombrePorUsuario.get(t.usuario_cierre_id) ?? "—" : "—",
    inicial: t.efectivo_inicial,
    esperado: t.efectivo_esperado,
    contado: t.efectivo_contado,
    diferencia: t.diferencia,
    alertaDiferencia: t.alerta_diferencia,
    ganancia: gananciaPorTurno.get(t.id) ?? 0,
  }));

  return {
    rango,
    ventasTotales,
    numTickets,
    ticketPromedio,
    totalDescuentos,
    diferenciaAcumulada,
    turnosConAlerta,
    ventasPorMetodo,
    ventasPorServicio,
    descuentos,
    turnos,
    generadoEn: new Date().toISOString(),
  };
}
