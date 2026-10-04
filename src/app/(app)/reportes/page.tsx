import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PERIODOS, resolverRango, queryStringRango, obtenerDatosReporte, type FiltrosReporte } from "./data";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { buscarTicketsDetalle } from "@/lib/ticketsDetalle";
import { TicketsDetalleSeccion } from "@/components/TicketsDetalleSeccion";
import { TAMANOS_VEHICULO } from "@/lib/servicios";
import { ReportesClient } from "./ReportesClient";
import type { TamanoVehiculo, PagoMetodo } from "@/types/database.types";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  membresia: "Membresía",
};

function construirHref(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `/reportes?${s}` : "/reportes";
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{
    periodo?: string;
    desde?: string;
    hasta?: string;
    servicio?: string;
    tamano?: string;
    metodo?: string;
    lavador?: string;
    q?: string;
    // "Buscar vehículo" tiene su propio rango de fechas, independiente del
    // período del resto del Reportes — así se puede ver el historial
    // completo de un carro sin tener que cambiar "Hoy" por "Todo" arriba
    // (lo que de paso cambiaría los números del resto de la página).
    vperiodo?: string;
    vdesde?: string;
    vhasta?: string;
  }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  if (!usuario) {
    redirect("/login");
  }

  if (usuario.rol === "cajero") {
    redirect("/");
  }

  const rango = resolverRango(params);
  const rangoVehiculo = resolverRango({
    periodo: params.vperiodo,
    desde: params.vdesde,
    hasta: params.vhasta,
  });

  const filtroServicio = params.servicio ?? "";
  const filtroTamano = (params.tamano ?? "") as TamanoVehiculo | "";
  const filtroMetodo = (params.metodo ?? "") as PagoMetodo | "";
  const filtroLavador = params.lavador ?? "";
  const filtroQ = params.q ?? "";

  // Filtro maestro — paquete, tamaño, método de pago, lavador y texto libre
  // acotan tanto las tarjetas/gráficas de ventas de arriba como "Buscar
  // tickets" de abajo: mismos nombres de parámetro, una sola fuente de
  // verdad.
  const filtrosReporte: FiltrosReporte = {
    servicio: filtroServicio,
    tamano: filtroTamano,
    metodo: filtroMetodo,
    lavador: filtroLavador,
    q: filtroQ,
  };

  // Para los links de período, el botón "Quitar filtros" y para que las
  // gráficas (clic para filtrar) sepan qué conservar al navegar — incluye
  // también vperiodo/vdesde/vhasta para no perder el rango independiente de
  // "Buscar vehículo" al tocar cualquier otro filtro de arriba.
  const paramsFiltroActuales = {
    periodo: rango.personalizado ? undefined : rango.periodo,
    desde: rango.personalizado ? rango.desdeInput || undefined : undefined,
    hasta: rango.personalizado ? rango.hastaInput || undefined : undefined,
    servicio: filtroServicio || undefined,
    tamano: filtroTamano || undefined,
    metodo: filtroMetodo || undefined,
    lavador: filtroLavador || undefined,
    q: filtroQ || undefined,
    vperiodo: params.vperiodo,
    vdesde: params.vdesde,
    vhasta: params.vhasta,
  };
  const hayFiltroMaestro = Boolean(
    rango.personalizado || filtroServicio || filtroTamano || filtroMetodo || filtroLavador || filtroQ
  );

  // Las tres consultas no dependen entre sí — se piden juntas en vez de una
  // tras otra para no sumar sus tiempos de espera.
  const [datosReporte, datosTicketsDetalle, { data: servicios }, { data: lavadores }] = await Promise.all([
    obtenerDatosReporte(rango, filtrosReporte),
    buscarTicketsDetalle(rangoVehiculo, filtrosReporte),
    supabase.from("servicios_catalogo").select("id, nombre").order("nombre"),
    supabase.from("lavadores").select("id, nombre").order("nombre"),
  ]);

  const {
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
  } = datosReporte;

  const {
    filas: ticketsDetalle,
    totalCoincidencias: totalTicketsDetalle,
    lavadoresPresentes,
    serviciosPresentes: serviciosPresentesDetalle,
  } = datosTicketsDetalle;

  const ventasPorMetodoChart = Object.entries(ventasPorMetodo)
    .filter(([, total]) => total > 0)
    .map(([metodo, total]) => ({ metodo, nombre: METODO_LABEL[metodo] ?? metodo, total }))
    .sort((a, b) => b.total - a.total);

  const qs = queryStringRango(rango);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
          <p className="text-sm text-muted">Ventas, descuentos y diferencias de caja para control del negocio.</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/reportes/exportar/pdf?${qs}`}
            className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary/20"
          >
            Descargar PDF
          </a>
          <a
            href={`/reportes/exportar/excel?${qs}`}
            className="rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-sm font-medium text-success transition hover:bg-success/20"
          >
            Descargar Excel
          </a>
        </div>
      </div>

      <div className="flex gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p.value}
            href={construirHref({ ...paramsFiltroActuales, periodo: p.value, desde: undefined, hasta: undefined })}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              !rango.personalizado && p.value === rango.periodo
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <form className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-medium text-muted">
          Filtro maestro — combina lo que quieras: fechas, paquete, tamaño, método de pago, lavador, texto.
        </p>
        {params.vperiodo && <input type="hidden" name="vperiodo" value={params.vperiodo} />}
        {params.vdesde && <input type="hidden" name="vdesde" value={params.vdesde} />}
        {params.vhasta && <input type="hidden" name="vhasta" value={params.vhasta} />}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="desde" className="text-[11px] text-muted">
              Desde
            </label>
            <input
              id="desde"
              type="date"
              name="desde"
              defaultValue={rango.desdeInput}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="hasta" className="text-[11px] text-muted">
              Hasta
            </label>
            <input
              id="hasta"
              type="date"
              name="hasta"
              defaultValue={rango.hastaInput}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="servicio" className="text-[11px] text-muted">
              Paquete
            </label>
            <select
              id="servicio"
              name="servicio"
              defaultValue={filtroServicio}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="">Todos</option>
              {(servicios ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="tamano" className="text-[11px] text-muted">
              Tamaño
            </label>
            <select
              id="tamano"
              name="tamano"
              defaultValue={filtroTamano}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="">Todos</option>
              {TAMANOS_VEHICULO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="metodo" className="text-[11px] text-muted">
              Método de pago
            </label>
            <select
              id="metodo"
              name="metodo"
              defaultValue={filtroMetodo}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="">Todos</option>
              {Object.entries(METODO_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="lavador" className="text-[11px] text-muted">
              Lavador
            </label>
            <select
              id="lavador"
              name="lavador"
              defaultValue={filtroLavador}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="">Todos</option>
              {(lavadores ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1" style={{ minWidth: 160 }}>
            <label htmlFor="q" className="text-[11px] text-muted">
              Buscar carro o placa
            </label>
            <input
              id="q"
              name="q"
              defaultValue={filtroQ}
              placeholder="Ej. Jetta o ABC-123"
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              hayFiltroMaestro
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            Filtrar
          </button>
          {hayFiltroMaestro && (
            <Link
              href={construirHref({ vperiodo: params.vperiodo, vdesde: params.vdesde, vhasta: params.vhasta })}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
            >
              Quitar filtros
            </Link>
          )}
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="hover-lift animate-in rounded-xl border border-border bg-surface p-5" style={{ animationDelay: "0ms" }}>
          <p className="text-xs uppercase tracking-wide text-muted">Ventas totales</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            <AnimatedNumber value={ventasTotales} format="dinero" />
          </p>
          <p className="mt-1 text-xs text-muted">{numTickets} tickets entregados</p>
        </div>
        <div className="hover-lift animate-in rounded-xl border border-border bg-surface p-5" style={{ animationDelay: "60ms" }}>
          <p className="text-xs uppercase tracking-wide text-muted">Ticket promedio</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            <AnimatedNumber value={ticketPromedio} format="dinero" />
          </p>
        </div>
        <div className="hover-lift animate-in rounded-xl border border-border bg-surface p-5" style={{ animationDelay: "120ms" }}>
          <p className="text-xs uppercase tracking-wide text-muted">Descuentos otorgados</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            <AnimatedNumber value={totalDescuentos} format="dinero" />
          </p>
          <p className="mt-1 text-xs text-muted">{descuentos.length} tickets con descuento</p>
        </div>
        <div
          className={`hover-lift animate-in rounded-xl border p-5 ${
            diferenciaAcumulada !== 0 ? "border-primary/40 bg-primary/5" : "border-border bg-surface"
          }`}
          style={{ animationDelay: "180ms" }}
        >
          <p className="text-xs uppercase tracking-wide text-muted">Diferencia acumulada de caja</p>
          <p className={`mt-1 text-2xl font-bold ${diferenciaAcumulada !== 0 ? "text-primary" : "text-foreground"}`}>
            <AnimatedNumber value={diferenciaAcumulada} format="dinero" />
          </p>
          <p className="mt-1 text-xs text-muted">{turnosConAlerta} turnos con diferencia</p>
        </div>
        <div className="hover-lift animate-in rounded-xl border border-border bg-surface p-5" style={{ animationDelay: "240ms" }}>
          <p className="text-xs uppercase tracking-wide text-muted">Gastos</p>
          <p className="mt-1 text-2xl font-bold text-primary">
            <AnimatedNumber value={totalGastos} format="dinero" />
          </p>
          <p className="mt-1 text-xs text-muted">{gastos.length} gastos registrados</p>
        </div>
        <div className="hover-lift animate-in rounded-xl border border-success/40 bg-success/5 p-5" style={{ animationDelay: "270ms" }}>
          <p className="text-xs uppercase tracking-wide text-muted">Ingresos extra</p>
          <p className="mt-1 text-2xl font-bold text-success">
            <AnimatedNumber value={totalIngresosExtra} format="dinero" />
          </p>
          <p className="mt-1 text-xs text-muted">{ingresos.length} ingresos registrados</p>
        </div>
        <div className="hover-lift animate-in rounded-xl border border-success/40 bg-success/5 p-5" style={{ animationDelay: "300ms" }}>
          <p className="text-xs uppercase tracking-wide text-muted">Ganancia neta</p>
          <p className="mt-1 text-2xl font-bold text-success">
            <AnimatedNumber value={gananciaNeta} format="dinero" />
          </p>
          <p className="mt-1 text-xs text-muted">
            {hayFiltroMaestro ? "Negocio completo del período — no cambia con el filtro de arriba." : "Ventas + ingresos extra menos gastos"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold text-foreground">Cómo van las ventas</h2>
        <ReportesClient
          ventasPorServicio={ventasPorServicio}
          ventasPorTamano={ventasPorTamano}
          ventasPorMetodo={ventasPorMetodoChart}
          ventasPorMes={ventasPorMes}
          filtroServicio={filtroServicio}
          filtroTamano={filtroTamano}
          filtroMetodo={filtroMetodo}
          currentParams={paramsFiltroActuales}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold text-foreground">Descuentos otorgados</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Servicio</th>
                <th className="hidden px-4 py-3 sm:table-cell">Cajero</th>
                <th className="hidden px-4 py-3 sm:table-cell">Autorizado por</th>
                <th className="px-4 py-3">Monto</th>
              </tr>
            </thead>
            <tbody>
              {descuentos.map((d) => (
                <tr key={d.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-3 text-muted">{new Date(d.fecha).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</td>
                  <td className="px-4 py-3 text-foreground">{d.servicio}</td>
                  <td className="hidden px-4 py-3 text-foreground sm:table-cell">{d.empleado}</td>
                  <td className="hidden px-4 py-3 text-foreground sm:table-cell">{d.autorizadoPor}</td>
                  <td className="px-4 py-3 text-primary">{money(d.monto)}</td>
                </tr>
              ))}
              {descuentos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
                    Sin descuentos en este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Gastos</h2>
          <Link href="/gastos" className="text-xs text-accent hover:underline">
            Administrar gastos →
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Concepto</th>
                <th className="hidden px-4 py-3 sm:table-cell">Notas</th>
                <th className="px-4 py-3">Monto</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => (
                <tr key={g.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-3 text-muted">{new Date(g.fecha).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })}</td>
                  <td className="px-4 py-3 text-foreground">{g.concepto}</td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">{g.notas ?? "—"}</td>
                  <td className="px-4 py-3 text-primary">{money(g.monto)}</td>
                </tr>
              ))}
              {gastos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted">
                    Sin gastos en este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Ingresos extra</h2>
          <Link href="/ingresos" className="text-xs text-accent hover:underline">
            Administrar ingresos extra →
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Concepto</th>
                <th className="hidden px-4 py-3 sm:table-cell">Notas</th>
                <th className="px-4 py-3">Monto</th>
              </tr>
            </thead>
            <tbody>
              {ingresos.map((i) => (
                <tr key={i.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-3 text-muted">{new Date(i.fecha).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })}</td>
                  <td className="px-4 py-3 text-foreground">{i.concepto}</td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">{i.notas ?? "—"}</td>
                  <td className="px-4 py-3 text-success">{money(i.monto)}</td>
                </tr>
              ))}
              {ingresos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted">
                    Sin ingresos extra en este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TicketsDetalleSeccion
        basePath="/reportes"
        rango={rangoVehiculo}
        filtros={filtrosReporte}
        filas={ticketsDetalle}
        totalCoincidencias={totalTicketsDetalle}
        lavadoresPresentes={lavadoresPresentes}
        serviciosPresentes={serviciosPresentesDetalle}
        incluirPeriodo={true}
        nombresParamsPeriodo={{ periodo: "vperiodo", desde: "vdesde", hasta: "vhasta" }}
        paramsExtra={{ periodo: params.periodo, desde: params.desde, hasta: params.hasta }}
      />

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold text-foreground">Historial de cierres de turno</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Cierre</th>
                <th className="hidden px-4 py-3 sm:table-cell">Abrió</th>
                <th className="hidden px-4 py-3 sm:table-cell">Cerró</th>
                <th className="hidden px-4 py-3 md:table-cell">Inicial</th>
                <th className="hidden px-4 py-3 md:table-cell">Efectivo esperado</th>
                <th className="hidden px-4 py-3 md:table-cell">Efectivo contado</th>
                <th className="px-4 py-3">Diferencia</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Ganancia</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => (
                <tr key={t.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <Link href={`/reportes/turnos/${t.id}`} className="text-muted hover:text-accent hover:underline">
                      {t.horaCierre ? new Date(t.horaCierre).toLocaleString("es-MX", { timeZone: "America/Mexico_City" }) : "—"}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-foreground sm:table-cell">{t.abrio}</td>
                  <td className="hidden px-4 py-3 text-foreground sm:table-cell">{t.cerro}</td>
                  <td className="hidden px-4 py-3 text-muted md:table-cell">{money(t.inicial)}</td>
                  <td className="hidden px-4 py-3 text-muted md:table-cell">{t.esperado != null ? money(t.esperado) : "—"}</td>
                  <td className="hidden px-4 py-3 text-muted md:table-cell">{t.contado != null ? money(t.contado) : "—"}</td>
                  <td className={`px-4 py-3 font-medium ${t.alertaDiferencia ? "text-primary" : "text-foreground"}`}>
                    {t.diferencia != null ? money(t.diferencia) : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{money(t.total)}</td>
                  <td className="px-4 py-3 font-semibold text-success">{money(t.ganancia)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/reportes/turnos/${t.id}`} className="text-xs text-accent hover:underline">
                      Ver desglose →
                    </Link>
                  </td>
                </tr>
              ))}
              {turnos.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-muted">
                    Sin turnos cerrados en este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
