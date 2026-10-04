import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PERIODOS, resolverRango, queryStringRango, type RangoResuelto } from "@/lib/rangoFechas";
import { inicioDeMesMX, mesMX } from "@/lib/fecha";
import { TAMANOS_VEHICULO } from "@/lib/servicios";
import { fetchPaginado, fetchEnLotes } from "@/lib/supabaseBatch";
import type { Database, TamanoVehiculo, PagoMetodo } from "@/types/database.types";

// Se reexportan para no tener que tocar los imports existentes en page.tsx
// y en las rutas de exportar/ (pdf, excel), que siguen importando esto
// desde "./data" / "../../data".
export { PERIODOS, resolverRango, queryStringRango };
export type { Periodo, ParamsRango, RangoResuelto } from "@/lib/rangoFechas";

const MESES_TENDENCIA = 12;

// El "filtro maestro" de Reportes (paquete, tamaño, método de pago, lavador,
// texto) — los mismos campos que ya usaba "Buscar tickets", ahora también
// acotan las tarjetas y gráficas de ventas de arriba.
export type FiltrosReporte = {
  servicio?: string;
  tamano?: TamanoVehiculo | "";
  metodo?: PagoMetodo | "";
  lavador?: string;
  q?: string;
};

export type VentaPorServicio = { servicioId: string; nombre: string; tickets: number; total: number };
export type VentaPorTamano = { tamano: TamanoVehiculo; nombre: string; tickets: number; total: number };
export type VentaPorMes = { mes: string; etiqueta: string; total: number };

export type DescuentoDetalle = {
  id: string;
  fecha: string;
  servicio: string;
  empleado: string;
  autorizadoPor: string;
  monto: number;
};

export type GastoDetalle = {
  id: string;
  fecha: string;
  concepto: string;
  notas: string | null;
  monto: number;
};

export type IngresoDetalle = {
  id: string;
  fecha: string;
  concepto: string;
  notas: string | null;
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
  // Ganancia real del turno: efectivo CONTADO (no lo esperado según los
  // pagos registrados — si faltó dinero en el corte, se descuenta aquí en
  // vez de aparecer como si todo se hubiera cobrado bien) + tarjeta +
  // transferencia, menos el efectivo inicial de caja (nunca fue una venta,
  // solo el fondo fijo para dar cambio).
  ganancia: number;
  // Total = efectivo contado + tarjeta + transferencia (todo el dinero real
  // del turno junto, incluido el fondo fijo). Total - efectivo inicial =
  // Ganancia, siempre.
  total: number;
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
  ventasPorTamano: VentaPorTamano[];
  ventasPorMes: VentaPorMes[];
  descuentos: DescuentoDetalle[];
  turnos: CierreTurno[];
  gastos: GastoDetalle[];
  totalGastos: number;
  ingresos: IngresoDetalle[];
  totalIngresosExtra: number;
  gananciaNeta: number;
  generadoEn: string;
};

// Trae tickets entregados en un rango de fechas + sus pagos, aplicando el
// filtro maestro (paquete/tamaño van directo a la base de datos; lavador,
// texto y método dependen de tablas relacionadas, así que se aplican aquí
// en JS) — se usa tanto para las tarjetas del período elegido como para la
// tendencia mensual (últimos 12 meses), que ignora el período pero sí
// respeta el resto del filtro.
async function obtenerVentasFiltradas(
  supabase: SupabaseClient<Database>,
  desdeIso: string | null,
  hastaIso: string | null,
  filtros: FiltrosReporte
) {
  // Paginado explícito: PostgREST trae máximo 1000 renglones por consulta
  // si no se pide así — con suficiente volumen (un período amplio como
  // "30d" o "todo" en un negocio activo) los tickets de más allá del
  // renglón 1000 desaparecían en silencio, sin ningún error.
  const ticketsRaw = await fetchPaginado((desde, hasta) => {
    let query = supabase
      .from("tickets")
      .select(
        "id, servicio_id, tamano_vehiculo, distintivo, placa, descuento_monto, descuento_autorizado_por, creado_por, hora_entrada"
      )
      .eq("estado", "entregado")
      .order("hora_entrada", { ascending: false })
      .range(desde, hasta);
    if (desdeIso) query = query.gte("hora_entrada", desdeIso);
    if (hastaIso) query = query.lte("hora_entrada", hastaIso);
    if (filtros.servicio) query = query.eq("servicio_id", filtros.servicio);
    if (filtros.tamano) query = query.eq("tamano_vehiculo", filtros.tamano as TamanoVehiculo);
    return query;
  });
  const ticketIds = ticketsRaw.map((t) => t.id);

  // .in("ticket_id", ids) en lotes chicos — con cientos/miles de ids una
  // sola llamada arma una URL tan larga que PostgREST la rechaza, y el
  // código nunca revisaba ese error (se veía idéntico a "sin pagos").
  const [pagosRaw, asignacionesRaw] = await Promise.all([
    fetchEnLotes(ticketIds, (lote) => supabase.from("pagos").select("ticket_id, monto, metodo").in("ticket_id", lote)),
    fetchEnLotes(ticketIds, (lote) =>
      supabase.from("ticket_lavadores").select("ticket_id, lavador_id").in("ticket_id", lote)
    ),
  ]);

  const lavadorIdsPorTicket = new Map<string, string[]>();
  for (const a of asignacionesRaw) {
    const lista = lavadorIdsPorTicket.get(a.ticket_id) ?? [];
    lista.push(a.lavador_id);
    lavadorIdsPorTicket.set(a.ticket_id, lista);
  }

  const pagosPorTicket = new Map<string, { monto: number; metodo: PagoMetodo }[]>();
  for (const p of pagosRaw) {
    const lista = pagosPorTicket.get(p.ticket_id) ?? [];
    lista.push({ monto: p.monto, metodo: p.metodo });
    pagosPorTicket.set(p.ticket_id, lista);
  }

  const qNorm = (filtros.q ?? "").trim().toLowerCase();
  const metodoFiltro = (filtros.metodo || null) as PagoMetodo | null;

  const tickets = ticketsRaw.filter((t) => {
    if (filtros.lavador && !(lavadorIdsPorTicket.get(t.id) ?? []).includes(filtros.lavador)) return false;
    if (qNorm) {
      const candidatos = [t.distintivo, t.placa].filter((v): v is string => Boolean(v)).map((v) => v.toLowerCase());
      if (!candidatos.some((c) => c.includes(qNorm))) return false;
    }
    if (metodoFiltro && !(pagosPorTicket.get(t.id) ?? []).some((p) => p.metodo === metodoFiltro)) return false;
    return true;
  });

  return { tickets, pagosPorTicket };
}

export async function obtenerDatosReporte(rango: RangoResuelto, filtros: FiltrosReporte = {}): Promise<DatosReporte> {
  const supabase = await createClient();

  // Todas paginadas explícito (ver supabaseBatch.ts) — sin esto, PostgREST
  // trae máximo 1000 renglones y, con suficiente volumen, "ganancia neta"
  // y los totales de turno salían mal sin ningún error visible.
  const turnosPromise = fetchPaginado((desde, hasta) => {
    let q = supabase.from("turnos").select("*").eq("estado", "cerrado").order("hora_cierre", { ascending: false }).range(desde, hasta);
    if (rango.desdeIso) q = q.gte("hora_cierre", rango.desdeIso);
    if (rango.hastaIso) q = q.lte("hora_cierre", rango.hastaIso);
    return q;
  });

  // Todos los pagos del período (sin el filtro maestro) — solo para los
  // totales de caja por turno (tarjeta/transferencia), que deben quedarse
  // como el negocio real sin importar si se está mirando nada más, por
  // ejemplo, los lavados "chicos".
  const pagosTurnoPromise = fetchPaginado((desde, hasta) => {
    let q = supabase
      .from("pagos")
      .select("ticket_id, turno_id, monto, metodo, creado_en")
      .order("creado_en", { ascending: false })
      .range(desde, hasta);
    if (rango.desdeIso) q = q.gte("creado_en", rango.desdeIso);
    if (rango.hastaIso) q = q.lte("creado_en", rango.hastaIso);
    return q;
  });

  const gastosPromise = fetchPaginado((desde, hasta) => {
    let q = supabase.from("gastos").select("*").order("fecha", { ascending: false }).range(desde, hasta);
    if (rango.desdeIso) q = q.gte("fecha", rango.desdeIso);
    if (rango.hastaIso) q = q.lte("fecha", rango.hastaIso);
    return q;
  });

  const ingresosPromise = fetchPaginado((desde, hasta) => {
    let q = supabase.from("ingresos_extra").select("*").order("fecha", { ascending: false }).range(desde, hasta);
    if (rango.desdeIso) q = q.gte("fecha", rango.desdeIso);
    if (rango.hastaIso) q = q.lte("fecha", rango.hastaIso);
    return q;
  });

  // Tendencia mensual: siempre los últimos 12 meses completos (sin importar
  // el período de arriba), pero sí respeta el resto del filtro maestro —
  // así "¿cómo van mis ventas de SUV mes a mes?" se contesta solo filtrando
  // tamaño y viendo esta gráfica.
  const desdeTendencia = inicioDeMesMX(MESES_TENDENCIA - 1);

  const [turnosRaw, pagosTurno, { data: servicios }, { data: usuarios }, gastosRaw, ingresosRaw, ventasPeriodo, ventasTendencia] =
    await Promise.all([
      turnosPromise,
      pagosTurnoPromise,
      supabase.from("servicios_catalogo").select("id, nombre"),
      supabase.from("usuarios").select("id, nombre"),
      gastosPromise,
      ingresosPromise,
      obtenerVentasFiltradas(supabase, rango.desdeIso, rango.hastaIso, filtros),
      obtenerVentasFiltradas(supabase, desdeTendencia.toISOString(), null, filtros),
    ]);

  const nombrePorUsuario = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]));
  const nombrePorServicio = new Map((servicios ?? []).map((s) => [s.id, s.nombre]));

  const tarjetaPorTurno = new Map<string, number>();
  const transferenciaPorTurno = new Map<string, number>();
  let ventasTotalesPeriodo = 0;
  for (const pago of pagosTurno) {
    ventasTotalesPeriodo += pago.monto;
    if (pago.metodo === "tarjeta") {
      tarjetaPorTurno.set(pago.turno_id, (tarjetaPorTurno.get(pago.turno_id) ?? 0) + pago.monto);
    }
    if (pago.metodo === "transferencia") {
      transferenciaPorTurno.set(pago.turno_id, (transferenciaPorTurno.get(pago.turno_id) ?? 0) + pago.monto);
    }
  }

  // Tickets + pagos ya filtrados por el filtro maestro (paquete, tamaño,
  // método, lavador, texto) — de aquí salen las tarjetas de ventas y las
  // gráficas, para que respondan de verdad a lo que se esté buscando.
  const { tickets: ticketsVentasFiltrados, pagosPorTicket } = ventasPeriodo;

  const ventasPorMetodo: Record<string, number> = { efectivo: 0, tarjeta: 0, transferencia: 0, membresia: 0 };
  let ventasTotales = 0;
  for (const t of ticketsVentasFiltrados) {
    for (const p of pagosPorTicket.get(t.id) ?? []) {
      ventasPorMetodo[p.metodo] = (ventasPorMetodo[p.metodo] ?? 0) + p.monto;
      ventasTotales += p.monto;
    }
  }

  const numTickets = ticketsVentasFiltrados.length;
  const ticketPromedio = numTickets > 0 ? ventasTotales / numTickets : 0;
  const totalDescuentos = ticketsVentasFiltrados.reduce((acc, t) => acc + t.descuento_monto, 0);
  const diferenciaAcumulada = turnosRaw.reduce((acc, t) => acc + (t.diferencia ?? 0), 0);
  const turnosConAlerta = turnosRaw.filter((t) => t.alerta_diferencia).length;

  function montoTicket(ticketId: string) {
    return (pagosPorTicket.get(ticketId) ?? []).reduce((acc, p) => acc + p.monto, 0);
  }

  const ventasPorServicioMap = new Map<string, VentaPorServicio>();
  for (const t of ticketsVentasFiltrados) {
    const nombre = nombrePorServicio.get(t.servicio_id) ?? "—";
    const entry = ventasPorServicioMap.get(t.servicio_id) ?? { servicioId: t.servicio_id, nombre, tickets: 0, total: 0 };
    entry.tickets += 1;
    entry.total += montoTicket(t.id);
    ventasPorServicioMap.set(t.servicio_id, entry);
  }
  const ventasPorServicio = Array.from(ventasPorServicioMap.values()).sort((a, b) => b.total - a.total);

  const ventasPorTamanoMap = new Map<TamanoVehiculo, { tickets: number; total: number }>();
  for (const t of ticketsVentasFiltrados) {
    const entry = ventasPorTamanoMap.get(t.tamano_vehiculo) ?? { tickets: 0, total: 0 };
    entry.tickets += 1;
    entry.total += montoTicket(t.id);
    ventasPorTamanoMap.set(t.tamano_vehiculo, entry);
  }
  const ventasPorTamano = TAMANOS_VEHICULO.map((tam) => ({
    tamano: tam.value,
    nombre: tam.label,
    tickets: ventasPorTamanoMap.get(tam.value)?.tickets ?? 0,
    total: ventasPorTamanoMap.get(tam.value)?.total ?? 0,
  }))
    .filter((v) => v.total > 0)
    .sort((a, b) => b.total - a.total);

  // Tendencia mensual — usa sus propios tickets/pagos (otro rango de
  // fechas que el período principal), nunca montoTicket()/pagosPorTicket
  // de arriba.
  const totalPorMesMap = new Map<string, number>();
  for (let i = MESES_TENDENCIA - 1; i >= 0; i--) {
    totalPorMesMap.set(mesMX(inicioDeMesMX(i).toISOString()), 0);
  }
  for (const t of ventasTendencia.tickets) {
    const mes = mesMX(t.hora_entrada);
    if (!totalPorMesMap.has(mes)) continue;
    const montoT = (ventasTendencia.pagosPorTicket.get(t.id) ?? []).reduce((acc, p) => acc + p.monto, 0);
    totalPorMesMap.set(mes, (totalPorMesMap.get(mes) ?? 0) + montoT);
  }
  const ventasPorMes: VentaPorMes[] = Array.from(totalPorMesMap, ([mes, total]) => ({
    mes,
    etiqueta: new Date(`${mes}-01T12:00:00`).toLocaleDateString("es-MX", {
      month: "short",
      year: "2-digit",
      timeZone: "America/Mexico_City",
    }),
    total,
  }));

  const descuentos: DescuentoDetalle[] = ticketsVentasFiltrados
    .filter((t) => t.descuento_monto > 0)
    .map((t) => ({
      id: t.id,
      fecha: t.hora_entrada,
      servicio: nombrePorServicio.get(t.servicio_id) ?? "—",
      empleado: nombrePorUsuario.get(t.creado_por) ?? "—",
      autorizadoPor: t.descuento_autorizado_por ?? "—",
      monto: t.descuento_monto,
    }));

  const gastos: GastoDetalle[] = gastosRaw.map((g) => ({
    id: g.id,
    fecha: g.fecha,
    concepto: g.concepto,
    notas: g.notas,
    monto: g.monto,
  }));
  const totalGastos = gastos.reduce((acc, g) => acc + g.monto, 0);

  const ingresos: IngresoDetalle[] = ingresosRaw.map((i) => ({
    id: i.id,
    fecha: i.fecha,
    concepto: i.concepto,
    notas: i.notas,
    monto: i.monto,
  }));
  const totalIngresosExtra = ingresos.reduce((acc, i) => acc + i.monto, 0);

  // La ganancia neta usa el total de ventas REAL del período (todos los
  // métodos, sin el filtro maestro) — si se está mirando solo, por ejemplo,
  // los lavados chicos, esta tarjeta sigue mostrando el negocio completo en
  // vez de una mezcla rara de "ventas de un filtro" menos "gastos de todo".
  const gananciaNeta = ventasTotalesPeriodo + totalIngresosExtra - totalGastos;

  // efectivo_contado nunca es null aquí: el trigger de cierre exige
  // capturarlo antes de dejar pasar un turno a "cerrado" (y esta consulta
  // solo trae turnos cerrados).
  const turnos: CierreTurno[] = turnosRaw.map((t) => {
    const tarjetaYTransferencia = (tarjetaPorTurno.get(t.id) ?? 0) + (transferenciaPorTurno.get(t.id) ?? 0);
    const total = (t.efectivo_contado ?? 0) + tarjetaYTransferencia;
    return {
      id: t.id,
      horaCierre: t.hora_cierre,
      abrio: nombrePorUsuario.get(t.usuario_apertura_id) ?? "—",
      cerro: t.usuario_cierre_id ? nombrePorUsuario.get(t.usuario_cierre_id) ?? "—" : "—",
      inicial: t.efectivo_inicial,
      esperado: t.efectivo_esperado,
      contado: t.efectivo_contado,
      diferencia: t.diferencia,
      alertaDiferencia: t.alerta_diferencia,
      ganancia: total - t.efectivo_inicial,
      total,
    };
  });

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
    ventasPorTamano,
    ventasPorMes,
    descuentos,
    turnos,
    gastos,
    totalGastos,
    ingresos,
    totalIngresosExtra,
    gananciaNeta,
    generadoEn: new Date().toISOString(),
  };
}
