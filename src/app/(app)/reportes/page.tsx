import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PERIODOS, resolverRango, queryStringRango, obtenerDatosReporte } from "./data";
import { AnimatedNumber } from "@/components/AnimatedNumber";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }>;
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
  const {
    ventasTotales,
    numTickets,
    ticketPromedio,
    totalDescuentos,
    diferenciaAcumulada,
    turnosConAlerta,
    ventasPorServicio,
    descuentos,
    turnos,
    gastos,
    totalGastos,
    gananciaNeta,
  } = await obtenerDatosReporte(rango);

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

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {PERIODOS.map((p) => (
            <Link
              key={p.value}
              href={`/reportes?periodo=${p.value}`}
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

        <form className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface px-3 py-2">
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
          <button
            type="submit"
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              rango.personalizado
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            Filtrar
          </button>
          {rango.personalizado && (
            <Link
              href="/reportes"
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
            >
              Quitar filtro
            </Link>
          )}
        </form>
      </div>

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
        <div className="hover-lift animate-in rounded-xl border border-success/40 bg-success/5 p-5" style={{ animationDelay: "300ms" }}>
          <p className="text-xs uppercase tracking-wide text-muted">Ganancia neta</p>
          <p className="mt-1 text-2xl font-bold text-success">
            <AnimatedNumber value={gananciaNeta} format="dinero" />
          </p>
          <p className="mt-1 text-xs text-muted">Ventas menos gastos</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold text-foreground">Ventas por servicio</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Servicio</th>
                <th className="px-4 py-3">Tickets</th>
                <th className="px-4 py-3">Ventas</th>
              </tr>
            </thead>
            <tbody>
              {ventasPorServicio.map((v) => (
                <tr key={v.nombre} className="border-t border-border transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-3 text-foreground">{v.nombre}</td>
                  <td className="px-4 py-3 text-muted">{v.tickets}</td>
                  <td className="px-4 py-3 text-foreground">{money(v.total)}</td>
                </tr>
              ))}
              {ventasPorServicio.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted">
                    Sin ventas en este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold text-foreground">Descuentos otorgados</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Servicio</th>
                <th className="px-4 py-3">Cajero</th>
                <th className="px-4 py-3">Autorizado por</th>
                <th className="px-4 py-3">Monto</th>
              </tr>
            </thead>
            <tbody>
              {descuentos.map((d) => (
                <tr key={d.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-3 text-muted">{new Date(d.fecha).toLocaleString("es-MX")}</td>
                  <td className="px-4 py-3 text-foreground">{d.servicio}</td>
                  <td className="px-4 py-3 text-foreground">{d.empleado}</td>
                  <td className="px-4 py-3 text-foreground">{d.autorizadoPor}</td>
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
                <th className="px-4 py-3">Notas</th>
                <th className="px-4 py-3">Monto</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => (
                <tr key={g.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-3 text-muted">{new Date(g.fecha).toLocaleDateString("es-MX")}</td>
                  <td className="px-4 py-3 text-foreground">{g.concepto}</td>
                  <td className="px-4 py-3 text-muted">{g.notas ?? "—"}</td>
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
        <h2 className="font-semibold text-foreground">Historial de cierres de turno</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Cierre</th>
                <th className="px-4 py-3">Abrió</th>
                <th className="px-4 py-3">Cerró</th>
                <th className="px-4 py-3">Inicial</th>
                <th className="px-4 py-3">Efectivo esperado</th>
                <th className="px-4 py-3">Efectivo contado</th>
                <th className="px-4 py-3">Diferencia</th>
                <th className="px-4 py-3">Ganancia</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => (
                <tr key={t.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <Link href={`/reportes/turnos/${t.id}`} className="text-muted hover:text-accent hover:underline">
                      {t.horaCierre ? new Date(t.horaCierre).toLocaleString("es-MX") : "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{t.abrio}</td>
                  <td className="px-4 py-3 text-foreground">{t.cerro}</td>
                  <td className="px-4 py-3 text-muted">{money(t.inicial)}</td>
                  <td className="px-4 py-3 text-muted">{t.esperado != null ? money(t.esperado) : "—"}</td>
                  <td className="px-4 py-3 text-muted">{t.contado != null ? money(t.contado) : "—"}</td>
                  <td className={`px-4 py-3 font-medium ${t.alertaDiferencia ? "text-primary" : "text-foreground"}`}>
                    {t.diferencia != null ? money(t.diferencia) : "—"}
                  </td>
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
                  <td colSpan={9} className="px-4 py-6 text-center text-muted">
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
