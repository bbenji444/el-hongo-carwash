import { createClient } from "@/lib/supabase/server";
import { inicioDeDiaMX, inicioDeDiaMXDesdeFecha, finDeDiaMXDesdeFecha } from "@/lib/fecha";

export type Periodo = "hoy" | "7d" | "30d" | "todo";

export const PERIODOS: { value: Periodo; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "todo", label: "Todo" },
];

export type ParamsReporte = { periodo?: string; desde?: string; hasta?: string };

export type RangoResuelto = {
  desdeIso: string | null;
  hastaIso: string | null;
  personalizado: boolean;
  periodo: Periodo;
  etiqueta: string;
  // Valores crudos "YYYY-MM-DD" del filtro personalizado, para repoblar el
  // formulario y para armar el query string que reciben los exportadores.
  desdeInput: string;
  hastaInput: string;
};

function fechaLegible(fechaStr: string): string {
  const [anio, mes, dia] = fechaStr.split("-").map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function resolverRango(params: ParamsReporte): RangoResuelto {
  const desdeInput = params.desde ?? "";
  const hastaInput = params.hasta ?? "";
  const personalizado = Boolean(desdeInput || hastaInput);

  if (personalizado) {
    const desdeIso = desdeInput ? inicioDeDiaMXDesdeFecha(desdeInput).toISOString() : null;
    const hastaIso = hastaInput ? finDeDiaMXDesdeFecha(hastaInput).toISOString() : null;
    const etiqueta = `${desdeInput ? fechaLegible(desdeInput) : "el inicio"} al ${
      hastaInput ? fechaLegible(hastaInput) : "hoy"
    }`;
    return { desdeIso, hastaIso, personalizado, periodo: "todo", etiqueta, desdeInput, hastaInput };
  }

  const periodo: Periodo = PERIODOS.some((p) => p.value === params.periodo)
    ? (params.periodo as Periodo)
    : "hoy";

  let desdeIso: string | null;
  if (periodo === "hoy") {
    desdeIso = inicioDeDiaMX(0).toISOString();
  } else if (periodo === "7d") {
    desdeIso = inicioDeDiaMX(6).toISOString();
  } else if (periodo === "30d") {
    desdeIso = inicioDeDiaMX(29).toISOString();
  } else {
    desdeIso = null;
  }

  return {
    desdeIso,
    hastaIso: null,
    personalizado: false,
    periodo,
    etiqueta: PERIODOS.find((p) => p.value === periodo)!.label,
    desdeInput: "",
    hastaInput: "",
  };
}

export function queryStringRango(rango: RangoResuelto): string {
  const qs = new URLSearchParams();
  if (rango.personalizado) {
    if (rango.desdeInput) qs.set("desde", rango.desdeInput);
    if (rango.hastaInput) qs.set("hasta", rango.hastaInput);
  } else {
    qs.set("periodo", rango.periodo);
  }
  return qs.toString();
}

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
    .select("ticket_id, monto, metodo, creado_en")
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
  const ventasPorMetodo: Record<string, number> = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  for (const pago of pagos ?? []) {
    montoPorTicket.set(pago.ticket_id, (montoPorTicket.get(pago.ticket_id) ?? 0) + pago.monto);
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
      autorizadoPor: t.descuento_autorizado_por ? nombrePorUsuario.get(t.descuento_autorizado_por) ?? "—" : "—",
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
