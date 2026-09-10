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
  // Promedio de "Iniciar" a "Terminado" (minutos), sin ajustar. null si
  // ninguno de sus tickets en el rango tiene ambas marcas de tiempo.
  tiempoPromedioLavadoMin: number | null;
  // Índice de eficiencia: promedio de (su tiempo real ÷ tiempo esperado
  // para ese paquete+tamaño, calculado del promedio real de TODOS los
  // lavadores) — ~1.0 = rinde como el promedio en trabajos de dificultad
  // equivalente, <1 más rápido que sus compañeros, >1 más lento. null si no
  // hay suficientes datos para calcularlo.
  eficiencia: number | null;
  // Volumen ajustado: suma del "tiempo esperado" de cada uno de sus
  // tickets (no el conteo crudo) — un ticket de un paquete/tamaño más
  // difícil pesa más que uno rápido, en vez de contar los dos igual.
  volumenAjustadoMin: number | null;
  // Calificación del cliente (1-10) al entregar — KPI de satisfacción,
  // nuevo y opcional (rollout gradual), por eso también se guarda cuántas
  // calificaciones tiene (para poder distinguir un promedio confiable de
  // uno con muy pocos datos).
  satisfaccionProm: number | null;
  calificaciones: number;
  // Puntaje combinado 0-100 (eficiencia + volumen ajustado + satisfacción,
  // normalizados entre todos los lavadores del período) — null si el
  // lavador no tuvo ningún ticket entregado en el rango.
  puntaje: number | null;
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
    .select("id, servicio_id, tamano_vehiculo, hora_entrada, hora_inicio_lavado, hora_fin_lavado, calificacion")
    .eq("estado", "entregado");
  if (rango.desdeIso) ticketsQuery.gte("hora_entrada", rango.desdeIso);
  if (rango.hastaIso) ticketsQuery.lte("hora_entrada", rango.hastaIso);

  const { data: ticketsRaw } = await ticketsQuery;
  const ticketIds = (ticketsRaw ?? []).map((t) => t.id);

  const [{ data: pagos }, { data: asignaciones }] = await Promise.all([
    ticketIds.length
      ? supabase.from("pagos").select("ticket_id, monto").in("ticket_id", ticketIds)
      : Promise.resolve({ data: [] }),
    ticketIds.length
      ? supabase.from("ticket_lavadores").select("ticket_id, lavador_id").in("ticket_id", ticketIds)
      : Promise.resolve({ data: [] }),
  ]);

  const montoPorTicket = new Map<string, number>();
  for (const p of pagos ?? []) {
    montoPorTicket.set(p.ticket_id, (montoPorTicket.get(p.ticket_id) ?? 0) + p.monto);
  }

  // Uno o más lavadores por ticket (empiezan a lavar en pareja a veces).
  const lavadorIdsPorTicket = new Map<string, string[]>();
  for (const a of asignaciones ?? []) {
    const lista = lavadorIdsPorTicket.get(a.ticket_id) ?? [];
    lista.push(a.lavador_id);
    lavadorIdsPorTicket.set(a.ticket_id, lista);
  }

  return (ticketsRaw ?? [])
    .map((t) => ({
      id: t.id,
      lavadorIds: lavadorIdsPorTicket.get(t.id) ?? [],
      servicioId: t.servicio_id,
      tamanoVehiculo: t.tamano_vehiculo,
      monto: montoPorTicket.get(t.id) ?? 0,
      calificacion: t.calificacion,
      tiempoLavadoMin:
        t.hora_inicio_lavado && t.hora_fin_lavado
          ? (new Date(t.hora_fin_lavado).getTime() - new Date(t.hora_inicio_lavado).getTime()) / 60000
          : null,
    }))
    .filter((t) => t.lavadorIds.length > 0);
}

// Mínimo de tickets con tiempo cronometrado que debe tener una combinación
// (paquete, tamaño) en el período para confiar en su promedio como el
// "tiempo esperado" — con menos, se usa el estimado configurado en
// Servicios (o el promedio general) como respaldo.
const MIN_MUESTRAS_COMBINACION = 3;

// A partir de cuántas calificaciones se confía por completo en el promedio
// de satisfacción de un lavador — con menos, pesa proporcionalmente menos
// en el puntaje combinado (para no juzgar de más con 1 sola calificación).
const CALIFICACIONES_PARA_CONFIANZA_TOTAL = 5;

const PESO_EFICIENCIA = 0.4;
const PESO_VOLUMEN = 0.35;
const PESO_SATISFACCION = 0.25;

function normalizar(valor: number, min: number, max: number, invertir: boolean) {
  if (max === min) return 100;
  const proporcion = (valor - min) / (max - min);
  return (invertir ? 1 - proporcion : proporcion) * 100;
}

export async function obtenerDatosLavadores(rango: RangoResuelto): Promise<DatosLavadores> {
  const supabase = await createClient();

  const [{ data: lavadoresRaw }, { data: serviciosRaw }, tickets] = await Promise.all([
    supabase.from("lavadores").select("*").order("nombre"),
    supabase.from("servicios_catalogo").select("id, tiempo_estimado_min"),
    ticketsLavadosEnRango(rango),
  ]);

  const tiempoEstimadoPorServicio = new Map((serviciosRaw ?? []).map((s) => [s.id, s.tiempo_estimado_min]));

  // Tiempo esperado por combinación real (paquete + tamaño): promedio real
  // de TODOS los lavadores para esa combinación en el período — así el
  // "esperado" se autocalibra solo con los datos reales del negocio, sin
  // tener que mantener una tabla de tiempos a mano.
  const combos = new Map<string, { suma: number; n: number; servicioId: string }>();
  let sumaGeneral = 0;
  let nGeneral = 0;
  for (const t of tickets) {
    if (t.tiempoLavadoMin === null) continue;
    const clave = `${t.servicioId}::${t.tamanoVehiculo}`;
    const entry = combos.get(clave) ?? { suma: 0, n: 0, servicioId: t.servicioId };
    entry.suma += t.tiempoLavadoMin;
    entry.n += 1;
    combos.set(clave, entry);
    sumaGeneral += t.tiempoLavadoMin;
    nGeneral += 1;
  }
  const promedioGeneral = nGeneral > 0 ? sumaGeneral / nGeneral : null;

  function tiempoEsperado(servicioId: string, tamanoVehiculo: string): number | null {
    const clave = `${servicioId}::${tamanoVehiculo}`;
    const combo = combos.get(clave);
    if (combo && combo.n >= MIN_MUESTRAS_COMBINACION) return combo.suma / combo.n;
    const estimadoConfigurado = tiempoEstimadoPorServicio.get(servicioId);
    if (estimadoConfigurado) return estimadoConfigurado;
    if (combo) return combo.suma / combo.n; // pocas muestras, pero es lo único que hay
    return promedioGeneral;
  }

  const statsPorLavador = new Map<
    string,
    {
      autos: number;
      ventas: number;
      porTamano: ConteoPorTamano;
      sumaTiempoMin: number;
      conTiempo: number;
      sumaRatioEficiencia: number;
      conEficiencia: number;
      volumenAjustadoMin: number;
      sumaCalificacion: number;
      conCalificacion: number;
    }
  >();
  for (const t of tickets) {
    // El tiempo esperado depende solo del combo servicio+tamaño del ticket,
    // no de cuántos lavadores lo hicieron — se calcula una vez por ticket.
    const esperado = tiempoEsperado(t.servicioId, t.tamanoVehiculo);
    // Cada lavador asignado recibe el crédito COMPLETO del ticket (autos,
    // tiempo, ventas, calificación) — no se reparte entre quienes lavaron
    // en pareja.
    for (const lavadorId of t.lavadorIds) {
      const entry =
        statsPorLavador.get(lavadorId) ?? {
          autos: 0,
          ventas: 0,
          porTamano: conteoVacio(),
          sumaTiempoMin: 0,
          conTiempo: 0,
          sumaRatioEficiencia: 0,
          conEficiencia: 0,
          volumenAjustadoMin: 0,
          sumaCalificacion: 0,
          conCalificacion: 0,
        };
      entry.autos += 1;
      entry.ventas += t.monto;
      entry.porTamano[t.tamanoVehiculo] += 1;

      if (esperado !== null && esperado > 0) {
        entry.volumenAjustadoMin += esperado;
        if (t.tiempoLavadoMin !== null) {
          entry.sumaRatioEficiencia += t.tiempoLavadoMin / esperado;
          entry.conEficiencia += 1;
        }
      }
      if (t.tiempoLavadoMin !== null) {
        entry.sumaTiempoMin += t.tiempoLavadoMin;
        entry.conTiempo += 1;
      }
      if (t.calificacion !== null) {
        entry.sumaCalificacion += t.calificacion;
        entry.conCalificacion += 1;
      }
      statsPorLavador.set(lavadorId, entry);
    }
  }

  const previos = Array.from(statsPorLavador.entries()).map(([id, s]) => ({
    id,
    eficiencia: s.conEficiencia > 0 ? s.sumaRatioEficiencia / s.conEficiencia : null,
    volumenAjustadoMin: s.volumenAjustadoMin > 0 ? s.volumenAjustadoMin : null,
    satisfaccionProm: s.conCalificacion > 0 ? s.sumaCalificacion / s.conCalificacion : null,
    calificaciones: s.conCalificacion,
  }));

  const eficiencias = previos.map((p) => p.eficiencia).filter((v): v is number => v !== null);
  const volumenes = previos.map((p) => p.volumenAjustadoMin).filter((v): v is number => v !== null);
  const minEficiencia = eficiencias.length ? Math.min(...eficiencias) : 0;
  const maxEficiencia = eficiencias.length ? Math.max(...eficiencias) : 0;
  const minVolumen = volumenes.length ? Math.min(...volumenes) : 0;
  const maxVolumen = volumenes.length ? Math.max(...volumenes) : 0;

  const puntajePorLavador = new Map<string, number | null>();
  for (const p of previos) {
    if (p.eficiencia === null && p.volumenAjustadoMin === null) {
      puntajePorLavador.set(p.id, null);
      continue;
    }
    const scoreEficiencia = p.eficiencia !== null ? normalizar(p.eficiencia, minEficiencia, maxEficiencia, true) : 50;
    const scoreVolumen =
      p.volumenAjustadoMin !== null ? normalizar(p.volumenAjustadoMin, minVolumen, maxVolumen, false) : 50;
    const scoreSatisfaccion = p.satisfaccionProm !== null ? ((p.satisfaccionProm - 1) / 9) * 100 : 50;

    const confianzaSatisfaccion =
      p.calificaciones > 0 ? Math.min(1, p.calificaciones / CALIFICACIONES_PARA_CONFIANZA_TOTAL) : 0;
    const pesoSatisfaccionEfectivo = PESO_SATISFACCION * confianzaSatisfaccion;
    const pesoSobrante = PESO_SATISFACCION - pesoSatisfaccionEfectivo;
    const pesoBase = PESO_EFICIENCIA + PESO_VOLUMEN;
    const pesoEficienciaEfectivo = PESO_EFICIENCIA + pesoSobrante * (PESO_EFICIENCIA / pesoBase);
    const pesoVolumenEfectivo = PESO_VOLUMEN + pesoSobrante * (PESO_VOLUMEN / pesoBase);

    const puntaje =
      pesoEficienciaEfectivo * scoreEficiencia +
      pesoVolumenEfectivo * scoreVolumen +
      pesoSatisfaccionEfectivo * scoreSatisfaccion;
    puntajePorLavador.set(p.id, Math.round(puntaje));
  }

  const lavadores: LavadorStat[] = (lavadoresRaw ?? []).map((l) => {
    const stat = statsPorLavador.get(l.id);
    const previo = previos.find((p) => p.id === l.id);
    return {
      id: l.id,
      nombre: l.nombre,
      activo: l.activo,
      autosLavados: stat?.autos ?? 0,
      ventasGeneradas: stat?.ventas ?? 0,
      porTamano: stat?.porTamano ?? conteoVacio(),
      tiempoPromedioLavadoMin: stat && stat.conTiempo > 0 ? stat.sumaTiempoMin / stat.conTiempo : null,
      eficiencia: previo?.eficiencia ?? null,
      volumenAjustadoMin: previo?.volumenAjustadoMin ?? null,
      satisfaccionProm: previo?.satisfaccionProm ?? null,
      calificaciones: previo?.calificaciones ?? 0,
      puntaje: puntajePorLavador.get(l.id) ?? null,
    };
  });

  return { rango, lavadores, generadoEn: new Date().toISOString() };
}

export type TiempoPorPaqueteCelda = {
  servicioId: string;
  tamano: TamanoVehiculo;
  promedioMin: number | null;
  minMin: number | null;
  minLavador: string | null;
  maxMin: number | null;
  maxLavador: string | null;
  n: number;
};

// Tamaños que van en el rótulo físico de paquetes (Básico/Plus/Premium/Max)
// — las motos tienen precio y tabla aparte, no viven en esa tabla.
const TAMANOS_TABLA_PAQUETES: TamanoVehiculo[] = [
  "automovil",
  "camioneta_chica",
  "camioneta_grande",
  "camioneta_extra_grande",
];

export async function obtenerTiemposPorPaquete(rango: RangoResuelto): Promise<{
  servicios: { id: string; nombre: string }[];
  tamanos: TamanoVehiculo[];
  celdas: TiempoPorPaqueteCelda[];
}> {
  const supabase = await createClient();

  const [{ data: serviciosRaw }, { data: lavadoresRaw }, tickets] = await Promise.all([
    supabase.from("servicios_catalogo").select("id, nombre").eq("activo", true).order("orden").order("nombre"),
    supabase.from("lavadores").select("id, nombre"),
    ticketsLavadosEnRango(rango),
  ]);

  const nombrePorLavador = new Map((lavadoresRaw ?? []).map((l) => [l.id, l.nombre]));

  const grupos = new Map<string, { tiempoLavadoMin: number; lavadorId: string }[]>();
  for (const t of tickets) {
    if (t.tiempoLavadoMin === null) continue;
    if (!TAMANOS_TABLA_PAQUETES.includes(t.tamanoVehiculo)) continue;
    const clave = `${t.servicioId}::${t.tamanoVehiculo}`;
    const lista = grupos.get(clave) ?? [];
    // Cada lavador asignado cuenta ese tiempo como propio (crédito
    // completo, no repartido) — así "más rápida/lenta y quién" sigue
    // funcionando bien con parejas.
    for (const lavadorId of t.lavadorIds) {
      lista.push({ tiempoLavadoMin: t.tiempoLavadoMin, lavadorId });
    }
    grupos.set(clave, lista);
  }

  const servicios = serviciosRaw ?? [];
  const celdas: TiempoPorPaqueteCelda[] = [];
  for (const s of servicios) {
    for (const tamano of TAMANOS_TABLA_PAQUETES) {
      const lista = grupos.get(`${s.id}::${tamano}`) ?? [];
      const masRapida = lista.length > 0 ? lista.reduce((a, b) => (b.tiempoLavadoMin < a.tiempoLavadoMin ? b : a)) : null;
      const masLenta = lista.length > 0 ? lista.reduce((a, b) => (b.tiempoLavadoMin > a.tiempoLavadoMin ? b : a)) : null;
      celdas.push({
        servicioId: s.id,
        tamano,
        promedioMin:
          lista.length > 0 ? lista.reduce((a, b) => a + b.tiempoLavadoMin, 0) / lista.length : null,
        minMin: masRapida?.tiempoLavadoMin ?? null,
        minLavador: masRapida ? (nombrePorLavador.get(masRapida.lavadorId) ?? null) : null,
        maxMin: masLenta?.tiempoLavadoMin ?? null,
        maxLavador: masLenta ? (nombrePorLavador.get(masLenta.lavadorId) ?? null) : null,
        n: lista.length,
      });
    }
  }

  return { servicios, tamanos: TAMANOS_TABLA_PAQUETES, celdas };
}
