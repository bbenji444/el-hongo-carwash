import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inicioDeDiaMX } from "@/lib/fecha";

type Periodo = "hoy" | "7d" | "30d" | "todo";

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "todo", label: "Todo" },
];

function desdeFecha(periodo: Periodo): string | null {
  if (periodo === "hoy") {
    return inicioDeDiaMX(0).toISOString();
  }
  const ahora = new Date();
  if (periodo === "7d") {
    ahora.setDate(ahora.getDate() - 7);
    return ahora.toISOString();
  }
  if (periodo === "30d") {
    ahora.setDate(ahora.getDate() - 30);
    return ahora.toISOString();
  }
  return null;
}

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo: periodoParam } = await searchParams;
  const periodo: Periodo = PERIODOS.some((p) => p.value === periodoParam)
    ? (periodoParam as Periodo)
    : "hoy";

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

  const desde = desdeFecha(periodo);

  const turnosQuery = supabase
    .from("turnos")
    .select("*")
    .eq("estado", "cerrado")
    .order("hora_cierre", { ascending: false });
  if (desde) turnosQuery.gte("hora_cierre", desde);

  const ticketsQuery = supabase
    .from("tickets")
    .select("id, servicio_id, empleado_id, creado_por, descuento_monto, descuento_autorizado_por, estado, hora_entrada")
    .eq("estado", "entregado")
    .order("hora_entrada", { ascending: false });
  if (desde) ticketsQuery.gte("hora_entrada", desde);

  const pagosQuery = supabase
    .from("pagos")
    .select("ticket_id, monto, metodo, creado_en")
    .order("creado_en", { ascending: false });
  if (desde) pagosQuery.gte("creado_en", desde);

  const [{ data: turnos }, { data: tickets }, { data: pagos }, { data: servicios }, { data: usuarios }] =
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
  for (const pago of pagos ?? []) {
    montoPorTicket.set(pago.ticket_id, (montoPorTicket.get(pago.ticket_id) ?? 0) + pago.monto);
  }

  const ventasTotales = (pagos ?? []).reduce((acc, p) => acc + p.monto, 0);
  const numTickets = (tickets ?? []).length;
  const ticketPromedio = numTickets > 0 ? ventasTotales / numTickets : 0;
  const totalDescuentos = (tickets ?? []).reduce((acc, t) => acc + t.descuento_monto, 0);
  const diferenciaAcumulada = (turnos ?? []).reduce((acc, t) => acc + (t.diferencia ?? 0), 0);
  const turnosConAlerta = (turnos ?? []).filter((t) => t.alerta_diferencia).length;

  const ventasPorServicioMap = new Map<string, { nombre: string; tickets: number; total: number }>();
  for (const t of tickets ?? []) {
    const nombre = nombrePorServicio.get(t.servicio_id) ?? "—";
    const entry = ventasPorServicioMap.get(t.servicio_id) ?? { nombre, tickets: 0, total: 0 };
    entry.tickets += 1;
    entry.total += montoPorTicket.get(t.id) ?? 0;
    ventasPorServicioMap.set(t.servicio_id, entry);
  }
  const ventasPorServicio = Array.from(ventasPorServicioMap.values()).sort((a, b) => b.total - a.total);

  const descuentos = (tickets ?? [])
    .filter((t) => t.descuento_monto > 0)
    .map((t) => ({
      id: t.id,
      fecha: t.hora_entrada,
      servicio: nombrePorServicio.get(t.servicio_id) ?? "—",
      empleado: nombrePorUsuario.get(t.creado_por) ?? "—",
      autorizadoPor: t.descuento_autorizado_por ? nombrePorUsuario.get(t.descuento_autorizado_por) ?? "—" : "—",
      monto: t.descuento_monto,
    }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
        <p className="text-sm text-muted">Ventas, descuentos y diferencias de caja para control del negocio.</p>
      </div>

      <div className="flex gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p.value}
            href={`/reportes?periodo=${p.value}`}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              p.value === periodo
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Ventas totales</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{money(ventasTotales)}</p>
          <p className="mt-1 text-xs text-muted">{numTickets} tickets entregados</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Ticket promedio</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{money(ticketPromedio)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Descuentos otorgados</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{money(totalDescuentos)}</p>
          <p className="mt-1 text-xs text-muted">{descuentos.length} tickets con descuento</p>
        </div>
        <div
          className={`rounded-xl border p-5 ${
            diferenciaAcumulada !== 0 ? "border-primary/40 bg-primary/5" : "border-border bg-surface"
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-muted">Diferencia acumulada de caja</p>
          <p className={`mt-1 text-2xl font-bold ${diferenciaAcumulada !== 0 ? "text-primary" : "text-foreground"}`}>
            {money(diferenciaAcumulada)}
          </p>
          <p className="mt-1 text-xs text-muted">{turnosConAlerta} turnos con diferencia</p>
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
                <tr key={v.nombre} className="border-t border-border">
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
                <tr key={d.id} className="border-t border-border">
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
        <h2 className="font-semibold text-foreground">Historial de cierres de turno</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Cierre</th>
                <th className="px-4 py-3">Abrió</th>
                <th className="px-4 py-3">Cerró</th>
                <th className="px-4 py-3">Inicial</th>
                <th className="px-4 py-3">Esperado</th>
                <th className="px-4 py-3">Contado</th>
                <th className="px-4 py-3">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {(turnos ?? []).map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-3 text-muted">
                    {t.hora_cierre ? new Date(t.hora_cierre).toLocaleString("es-MX") : "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground">{nombrePorUsuario.get(t.usuario_apertura_id) ?? "—"}</td>
                  <td className="px-4 py-3 text-foreground">
                    {t.usuario_cierre_id ? nombrePorUsuario.get(t.usuario_cierre_id) ?? "—" : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">{money(t.efectivo_inicial)}</td>
                  <td className="px-4 py-3 text-muted">{t.efectivo_esperado != null ? money(t.efectivo_esperado) : "—"}</td>
                  <td className="px-4 py-3 text-muted">{t.efectivo_contado != null ? money(t.efectivo_contado) : "—"}</td>
                  <td className={`px-4 py-3 font-medium ${t.alerta_diferencia ? "text-primary" : "text-foreground"}`}>
                    {t.diferencia != null ? money(t.diferencia) : "—"}
                  </td>
                </tr>
              ))}
              {(turnos ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted">
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
