import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { diaMX, inicioDeDiaMX } from "@/lib/fecha";
import { esTurnoDeOtroDia, nombreDiaTurno } from "@/lib/turnoDia";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { resolverRango, PERIODOS } from "@/lib/rangoFechas";
import { obtenerDatosLavadores } from "./lavadores/data";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { VentasPorServicioChart, TendenciaVentasChart, AutosPorLavadorChart } from "./DashboardCharts";
import { AiAssistantCard } from "./AiAssistantCard";
import { HistorialMovimientos } from "./HistorialMovimientos";

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
    .select("nombre, rol, puede_ver_historial")
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

  // "Pendientes hoy" se mide por LLEGADA (hora_entrada) — autos que están
  // hoy en el flujo de trabajo. "Entregados/ventas hoy" se mide por ENTREGA
  // (hora_salida), igual que en Tickets (ver el mismo comentario ahí) —
  // antes este dashboard contaba por llegada y Tickets por entrega, y un
  // auto que llegó ayer pero se entregó hoy (o viceversa) salía contado
  // distinto en cada pantalla.
  const [{ data: ticketsLlegadaHoy }, { data: turnoAbierto }, { data: ticketsEntregadosHoyRaw }, { data: pagosSemana }, { data: servicios }] =
    await Promise.all([
      supabase.from("tickets").select("id, estado").gte("hora_entrada", hoy.toISOString()),
      supabase.from("turnos").select("*").eq("estado", "abierto").maybeSingle(),
      supabase
        .from("tickets")
        .select("id, servicio_id, descuento_monto")
        .eq("estado", "entregado")
        .gte("hora_salida", hoy.toISOString()),
      supabase.from("pagos").select("ticket_id, monto, creado_en").gte("creado_en", hace7dias.toISOString()),
      supabase.from("servicios_catalogo").select("id, nombre"),
    ]);

  const pendientesHoy = (ticketsLlegadaHoy ?? []).filter((t) => t.estado !== "entregado").length;
  const ticketsEntregadosHoy = ticketsEntregadosHoyRaw ?? [];
  const idsEntregadosHoy = new Set(ticketsEntregadosHoy.map((t) => t.id));

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
              {esTurnoDeOtroDia(turnoAbierto.hora_apertura) && (
                <span className="capitalize">Turno de {nombreDiaTurno(turnoAbierto.hora_apertura)} · </span>
              )}
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
            No hay un turno abierto. Ábrelo desde Tickets o desde Caja y turnos.
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

  // Los pagos "de hoy" son los que pertenecen a un ticket entregado hoy —
  // no los que se registraron hoy (pago.creado_en), para que este número
  // cuadre exactamente con numEntregadosHoy de abajo (mismo conjunto de
  // tickets en los dos casos).
  const pagosHoy = (pagosSemana ?? []).filter((p) => idsEntregadosHoy.has(p.ticket_id));
  const montoPorTicket = new Map<string, number>();
  for (const p of pagosHoy) {
    montoPorTicket.set(p.ticket_id, (montoPorTicket.get(p.ticket_id) ?? 0) + p.monto);
  }

  const ventasHoy = pagosHoy.reduce((acc, p) => acc + p.monto, 0);
  const numEntregadosHoy = ticketsEntregadosHoy.length;
  const ticketPromedioHoy = numEntregadosHoy > 0 ? ventasHoy / numEntregadosHoy : 0;
  const descuentosHoy = ticketsEntregadosHoy.reduce((acc, t) => acc + t.descuento_monto, 0);

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

  // Comisiones de lavadores (35% del paquete): con su propio filtro de
  // período (por default "Hoy", porque se les paga por día).
  const rangoComisiones = resolverRango({
    periodo: paramsTiempos.tperiodo,
    desde: paramsTiempos.tdesde,
    hasta: paramsTiempos.thasta,
  });

  // Independientes entre sí — se piden juntas.
  const [{ lavadores: lavadoresStats }, { lavadores: lavadoresComision }] = await Promise.all([
    obtenerDatosLavadores(resolverRango({ periodo: "7d" })),
    obtenerDatosLavadores(rangoComisiones),
  ]);

  // Autos lavados por lavador (últimos 7 días). Solo tipo "lavador" — un
  // encargado (ej. Fani) no lava autos.
  const lavadoresActivos = lavadoresStats.filter((l) => l.activo && l.tipo === "lavador");
  const autosPorLavador = [...lavadoresActivos]
    .sort((a, b) => b.autosLavados - a.autosLavados)
    .map((l) => ({ nombre: l.nombre, autos: l.autosLavados }));

  const comisionesLavadores = lavadoresComision
    .filter((l) => l.tipo === "lavador" && (l.activo || l.autosLavados > 0))
    .sort((a, b) => b.comision - a.comision || b.autosLavados - a.autosLavados);
  const totalComisiones = comisionesLavadores.reduce((acc, l) => acc + l.comision, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-gradient-brand text-2xl font-bold sm:text-3xl">
          Hola, {usuario.nombre} {config.emoji_saludo}
        </h1>
        <p className="text-sm capitalize text-muted">{fechaHoy}</p>
      </div>

      <AiAssistantCard nombreUsuario={usuario.nombre} />

      {usuario.puede_ver_historial && <HistorialMovimientos />}

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

      <div
        className="hover-lift animate-in rounded-xl border border-border bg-surface p-5"
        style={{ animationDelay: "360ms" }}
      >
        <h2 className="font-semibold text-foreground">Autos lavados por lavador (últimos 7 días)</h2>
        <div className="mt-3">
          <AutosPorLavadorChart data={autosPorLavador} />
        </div>
      </div>

      <div className="hover-lift animate-in rounded-xl border border-border bg-surface p-5" style={{ animationDelay: "420ms" }}>
        <h2 className="font-semibold text-foreground">Comisiones de lavadores ({rangoComisiones.etiqueta})</h2>
        <p className="text-xs text-muted">
          35% del precio de lista del paquete de cada auto que lavaron (sin extras). Solo cuentan los autos
          registrados desde el cambio a pago por comisión.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {PERIODOS.map((p) => (
              <Link
                key={p.value}
                href={hrefTiempos({ tperiodo: p.value })}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  !rangoComisiones.personalizado && p.value === rangoComisiones.periodo
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
                defaultValue={rangoComisiones.desdeInput}
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
                defaultValue={rangoComisiones.hastaInput}
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>
            <button
              type="submit"
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                rangoComisiones.personalizado
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              Filtrar
            </button>
            {rangoComisiones.personalizado && (
              <Link
                href="/"
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
              >
                Quitar filtro
              </Link>
            )}
          </form>
        </div>


        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Lavador</th>
                <th className="px-3 py-2 text-right">Autos</th>
                <th className="px-3 py-2 text-right">Ventas</th>
                <th className="px-3 py-2 text-right">Comisión</th>
              </tr>
            </thead>
            <tbody>
              {comisionesLavadores.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-foreground">{l.nombre}</td>
                  <td className="px-3 py-2 text-right text-muted">{l.autosLavados}</td>
                  <td className="px-3 py-2 text-right text-muted">${l.ventasGeneradas.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-bold text-success">${l.comision.toFixed(2)}</td>
                </tr>
              ))}
              {comisionesLavadores.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted">
                    Sin autos lavados en este período.
                  </td>
                </tr>
              )}
            </tbody>
            {comisionesLavadores.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td className="px-3 py-2 font-semibold text-foreground" colSpan={3}>
                    Total a pagar
                  </td>
                  <td className="px-3 py-2 text-right text-lg font-bold text-success">${totalComisiones.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
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
