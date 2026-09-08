import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { diaMX, inicioDeDiaMX, inicioDeDiaMXDesdeFecha } from "@/lib/fecha";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { resolverRango, PERIODOS, type RangoResuelto } from "@/lib/rangoFechas";
import { obtenerDatosLavadores, obtenerTiemposPorPaquete } from "./lavadores/data";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { VentasPorServicioChart, TendenciaVentasChart, AutosPorLavadorChart, RelacionLavadoresChart } from "./DashboardCharts";
import { TiemposPorPaqueteGrid } from "./TiemposPorPaqueteGrid";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tperiodo?: string; tdesde?: string; thasta?: string }>;
}) {
  const paramsTiempos = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombre, rol")
    .eq("id", user.id)
    .maybeSingle();

  if (!usuario) {
    redirect("/login");
  }

  const config = await obtenerConfiguracion();
  const esCajero = usuario.rol === "cajero";
  const hoy = inicioDeDiaMX(0);
  const hace7dias = inicioDeDiaMX(6);
  const fechaHoy = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Mexico_City",
  });

  const [{ data: turnoAbierto }, { data: ticketsHoy }, { data: pagosSemana }, { data: servicios }] =
    await Promise.all([
      supabase.from("turnos").select("*").eq("estado", "abierto").maybeSingle(),
      supabase
        .from("tickets")
        .select("id, servicio_id, estado, hora_entrada, descuento_monto")
        .gte("hora_entrada", hoy.toISOString()),
      supabase.from("pagos").select("ticket_id, monto, creado_en").gte("creado_en", hace7dias.toISOString()),
      supabase.from("servicios_catalogo").select("id, nombre"),
    ]);

  const pendientesHoy = (ticketsHoy ?? []).filter((t) => t.estado !== "entregado").length;

  if (esCajero) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-gradient-brand text-2xl font-bold sm:text-3xl">
          Hola, {usuario.nombre} {config.emoji_saludo}
        </h1>
          <p className="text-sm capitalize text-muted">{fechaHoy}</p>
        </div>

        {turnoAbierto ? (
          <div className="hover-lift animate-in rounded-xl border border-success/40 bg-success/5 p-5">
            <p className="text-xs uppercase tracking-wide text-muted">Turno</p>
            <p className="mt-1 flex items-center gap-2 font-semibold text-foreground">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
              Abierto
            </p>
            <p className="mt-1 text-sm text-muted">
              Desde las{" "}
              {new Date(turnoAbierto.hora_apertura).toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Mexico_City",
              })}
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
            No hay un turno abierto. Ábrelo desde la sección de Tickets.
          </p>
        )}

        <div className="hover-lift animate-in rounded-xl border border-border bg-surface p-5" style={{ animationDelay: "60ms" }}>
          <p className="text-xs uppercase tracking-wide text-muted">Tickets pendientes hoy</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            <AnimatedNumber value={pendientesHoy} />
          </p>
        </div>
      </div>
    );
  }

  const nombrePorServicio = new Map((servicios ?? []).map((s) => [s.id, s.nombre]));

  const pagosHoy = (pagosSemana ?? []).filter((p) => p.creado_en >= hoy.toISOString());
  const montoPorTicket = new Map<string, number>();
  for (const p of pagosHoy) {
    montoPorTicket.set(p.ticket_id, (montoPorTicket.get(p.ticket_id) ?? 0) + p.monto);
  }

  const ventasHoy = pagosHoy.reduce((acc, p) => acc + p.monto, 0);
  const ticketsEntregadosHoy = (ticketsHoy ?? []).filter((t) => t.estado === "entregado");
  const numEntregadosHoy = ticketsEntregadosHoy.length;
  const ticketPromedioHoy = numEntregadosHoy > 0 ? ventasHoy / numEntregadosHoy : 0;
  const descuentosHoy = (ticketsHoy ?? []).reduce((acc, t) => acc + t.descuento_monto, 0);

  const ventasPorServicioMap = new Map<string, { total: number; tickets: number }>();
  for (const t of ticketsEntregadosHoy) {
    const nombre = nombrePorServicio.get(t.servicio_id) ?? "Otro";
    const entry = ventasPorServicioMap.get(nombre) ?? { total: 0, tickets: 0 };
    entry.total += montoPorTicket.get(t.id) ?? 0;
    entry.tickets += 1;
    ventasPorServicioMap.set(nombre, entry);
  }
  const ventasPorServicio = Array.from(ventasPorServicioMap, ([nombre, v]) => ({
    nombre,
    total: v.total,
    tickets: v.tickets,
  })).sort((a, b) => b.total - a.total);

  const totalesPorDia = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    totalesPorDia.set(diaMX(inicioDeDiaMX(i).toISOString()), 0);
  }
  for (const p of pagosSemana ?? []) {
    const dia = diaMX(p.creado_en);
    if (totalesPorDia.has(dia)) {
      totalesPorDia.set(dia, (totalesPorDia.get(dia) ?? 0) + p.monto);
    }
  }
  const tendenciaVentas = Array.from(totalesPorDia, ([dia, total]) => ({
    etiqueta: new Date(`${dia}T12:00:00`).toLocaleDateString("es-MX", {
      weekday: "short",
      day: "numeric",
      timeZone: "America/Mexico_City",
    }),
    total,
  }));

  // Autos lavados por lavador (últimos 7 días): igual que siempre, ventana
  // móvil de 7 días.
  const { lavadores: lavadoresStats } = await obtenerDatosLavadores(resolverRango({ periodo: "7d" }));
  const lavadoresActivos = lavadoresStats.filter((l) => l.activo);
  const autosPorLavador = [...lavadoresActivos]
    .sort((a, b) => b.autosLavados - a.autosLavados)
    .map((l) => ({ nombre: l.nombre, autos: l.autosLavados }));

  // Eficiencia/volumen ajustado/satisfacción: métricas nuevas (fase 38) —
  // se cuentan desde esta fecha fija en vez de los últimos 7 días, para no
  // mezclar datos de antes de que existiera el ajuste por dificultad ni la
  // calificación del cliente.
  const INICIO_METRICA_RENDIMIENTO = "2026-09-06";
  const rangoRendimiento: RangoResuelto = {
    desdeIso: inicioDeDiaMXDesdeFecha(INICIO_METRICA_RENDIMIENTO).toISOString(),
    hastaIso: null,
    personalizado: true,
    periodo: "todo",
    etiqueta: `desde el ${INICIO_METRICA_RENDIMIENTO}`,
    desdeInput: INICIO_METRICA_RENDIMIENTO,
    hastaInput: "",
  };
  const { lavadores: lavadoresRendimiento } = await obtenerDatosLavadores(rangoRendimiento);
  const lavadoresRendimientoActivos = lavadoresRendimiento.filter((l) => l.activo);

  // Esta tarjeta sí tiene su propio filtro de período (independiente del
  // resto de las métricas de rendimiento, que se cuentan desde el 6 sep
  // fijo) — el dueño quiere poder ver "hoy" o un rango específico solo
  // para los tiempos por paquete.
  const rangoTiempos = resolverRango({
    periodo: paramsTiempos.tperiodo,
    desde: paramsTiempos.tdesde,
    hasta: paramsTiempos.thasta,
  });
  const tiemposPorPaquete = await obtenerTiemposPorPaquete(rangoTiempos);

  const relacionLavadores = lavadoresRendimientoActivos
    .filter((l) => l.eficiencia !== null && l.volumenAjustadoMin !== null)
    .map((l) => ({
      nombre: l.nombre,
      eficiencia: l.eficiencia!,
      volumenAjustadoMin: l.volumenAjustadoMin!,
      satisfaccionProm: l.satisfaccionProm,
      calificaciones: l.calificaciones,
    }));
  const rankingLavadores = [...lavadoresRendimientoActivos]
    .filter((l) => l.puntaje !== null)
    .sort((a, b) => (b.puntaje ?? 0) - (a.puntaje ?? 0));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-gradient-brand text-2xl font-bold sm:text-3xl">
          Hola, {usuario.nombre} {config.emoji_saludo}
        </h1>
        <p className="text-sm capitalize text-muted">{fechaHoy}</p>
      </div>

      {!turnoAbierto && (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
          No hay un turno abierto en este momento.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className="hover-lift animate-in rounded-xl border border-border bg-surface p-5"
          style={{ animationDelay: "0ms" }}
        >
          <p className="text-xs uppercase tracking-wide text-muted">Ventas de hoy</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            <AnimatedNumber value={ventasHoy} format="dinero" />
          </p>
          <p className="mt-1 text-xs text-muted">{numEntregadosHoy} tickets entregados</p>
        </div>
        <div
          className="hover-lift animate-in rounded-xl border border-border bg-surface p-5"
          style={{ animationDelay: "60ms" }}
        >
          <p className="text-xs uppercase tracking-wide text-muted">Ticket promedio</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            <AnimatedNumber value={ticketPromedioHoy} format="dinero" />
          </p>
        </div>
        <div
          className="hover-lift animate-in rounded-xl border border-border bg-surface p-5"
          style={{ animationDelay: "120ms" }}
        >
          <p className="text-xs uppercase tracking-wide text-muted">Descuentos hoy</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            <AnimatedNumber value={descuentosHoy} format="dinero" />
          </p>
        </div>
        <div
          className="hover-lift animate-in rounded-xl border border-border bg-surface p-5"
          style={{ animationDelay: "180ms" }}
        >
          <p className="text-xs uppercase tracking-wide text-muted">Pendientes hoy</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            <AnimatedNumber value={pendientesHoy} />
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div
          className="hover-lift animate-in rounded-xl border border-border bg-surface p-5"
          style={{ animationDelay: "240ms" }}
        >
          <h2 className="font-semibold text-foreground">Ventas por servicio (hoy)</h2>
          <div className="mt-3">
            <VentasPorServicioChart data={ventasPorServicio} />
          </div>
        </div>
        <div
          className="hover-lift animate-in rounded-xl border border-border bg-surface p-5"
          style={{ animationDelay: "300ms" }}
        >
          <h2 className="font-semibold text-foreground">Tendencia de ventas (últimos 7 días)</h2>
          <div className="mt-3">
            <TendenciaVentasChart data={tendenciaVentas} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div
          className="hover-lift animate-in rounded-xl border border-border bg-surface p-5"
          style={{ animationDelay: "360ms" }}
        >
          <h2 className="font-semibold text-foreground">Autos lavados por lavador (últimos 7 días)</h2>
          <div className="mt-3">
            <AutosPorLavadorChart data={autosPorLavador} />
          </div>
        </div>
        <div
          className="hover-lift animate-in rounded-xl border border-border bg-surface p-5"
          style={{ animationDelay: "420ms" }}
        >
          <h2 className="font-semibold text-foreground">Rendimiento: eficiencia vs volumen (desde el 6 sep 2026)</h2>
          <p className="text-xs text-muted">
            Arriba-izquierda es lo mejor: más rápido que sus compañeros en trabajos de dificultad equivalente, con
            más volumen ajustado. El color de la burbuja es la satisfacción del cliente; el tamaño, cuántas
            calificaciones tiene.
          </p>
          <div className="mt-3">
            <RelacionLavadoresChart data={relacionLavadores} />
          </div>
        </div>
      </div>

      <div className="hover-lift animate-in rounded-xl border border-border bg-surface p-5" style={{ animationDelay: "450ms" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">
              Tiempo promedio por paquete y tamaño ({rangoTiempos.etiqueta})
            </h2>
            <p className="text-xs text-muted">
              Igual que el rótulo de precios, pero con el tiempo real que se está tardando cada combinación — verde
              es más rápido, rojo es más lento (comparado entre sí, no contra un número fijo).
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {PERIODOS.map((p) => (
              <Link
                key={p.value}
                href={hrefTiempos({ tperiodo: p.value })}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  !rangoTiempos.personalizado && p.value === rangoTiempos.periodo
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>

          <form className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="tdesde" className="text-[11px] text-muted">
                Desde
              </label>
              <input
                id="tdesde"
                type="date"
                name="tdesde"
                defaultValue={rangoTiempos.desdeInput}
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="thasta" className="text-[11px] text-muted">
                Hasta
              </label>
              <input
                id="thasta"
                type="date"
                name="thasta"
                defaultValue={rangoTiempos.hastaInput}
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>
            <button
              type="submit"
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                rangoTiempos.personalizado
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              Filtrar
            </button>
            {rangoTiempos.personalizado && (
              <Link
                href="/"
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
              >
                Quitar filtro
              </Link>
            )}
          </form>
        </div>

        <div className="mt-3">
          <TiemposPorPaqueteGrid
            servicios={tiemposPorPaquete.servicios}
            tamanos={tiemposPorPaquete.tamanos}
            celdas={tiemposPorPaquete.celdas}
            config={config}
          />
        </div>
      </div>

      {rankingLavadores.length > 0 && (
        <div className="hover-lift animate-in rounded-xl border border-border bg-surface p-5" style={{ animationDelay: "480ms" }}>
          <h2 className="font-semibold text-foreground">Ranking de lavadores (desde el 6 sep 2026)</h2>
          <p className="text-xs text-muted">
            Puntaje combinado (eficiencia + volumen ajustado + satisfacción). Con pocas calificaciones, la
            satisfacción pesa menos en el puntaje hasta acumular más datos.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Lavador</th>
                  <th className="px-3 py-2 text-right">Autos</th>
                  <th className="px-3 py-2 text-right">Volumen ajustado</th>
                  <th className="px-3 py-2 text-right">Eficiencia</th>
                  <th className="px-3 py-2 text-right">Satisfacción</th>
                  <th className="px-3 py-2 text-right">Puntaje</th>
                </tr>
              </thead>
              <tbody>
                {rankingLavadores.map((l, i) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-foreground">
                      {i === 0 ? "🏆 " : ""}
                      {l.nombre}
                    </td>
                    <td className="px-3 py-2 text-right text-muted">{l.autosLavados}</td>
                    <td className="px-3 py-2 text-right text-muted">
                      {l.volumenAjustadoMin !== null ? `${Math.round(l.volumenAjustadoMin)} min` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-muted">
                      {l.eficiencia !== null ? l.eficiencia.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-muted">
                      {l.satisfaccionProm !== null ? `${l.satisfaccionProm.toFixed(1)} (n=${l.calificaciones})` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-lg font-bold text-primary">{l.puntaje}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function hrefTiempos(params: { tperiodo?: string; tdesde?: string; thasta?: string }) {
  const qs = new URLSearchParams();
  if (params.tperiodo) qs.set("tperiodo", params.tperiodo);
  if (params.tdesde) qs.set("tdesde", params.tdesde);
  if (params.thasta) qs.set("thasta", params.thasta);
  const s = qs.toString();
  return s ? `/?${s}` : "/";
}
