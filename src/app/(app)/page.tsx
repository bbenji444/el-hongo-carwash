import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { diaMX, inicioDeDiaMX } from "@/lib/fecha";
import { VentasPorServicioChart, TendenciaVentasChart } from "./DashboardCharts";

const SECCIONES = [
  { href: "/tickets", label: "Tickets", desc: "Tablero de tickets del turno en curso." },
  { href: "/servicios", label: "Servicios", desc: "Catálogo de servicios." },
  { href: "/turnos", label: "Caja y turnos", desc: "Cierre de turno y conciliación de efectivo." },
  { href: "/clientes", label: "Clientes", desc: "Directorio de clientes, vehículos y membresías." },
  { href: "/membresias", label: "Membresías", desc: "Catálogo de planes de membresía." },
  { href: "/inventario", label: "Inventario", desc: "Insumos y recetas de consumo por servicio." },
  { href: "/reportes", label: "Reportes", desc: "Ventas, descuentos y diferencias de caja.", soloSupervisor: true },
];

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export default async function DashboardPage() {
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

  const esCajero = usuario.rol === "cajero";
  const hoy = inicioDeDiaMX(0);
  const hace7dias = inicioDeDiaMX(6);
  const fechaHoy = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

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
  const secciones = esCajero ? SECCIONES.filter((s) => !s.soloSupervisor) : SECCIONES;

  if (esCajero) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hola, {usuario.nombre} 👋</h1>
          <p className="text-sm capitalize text-muted">{fechaHoy}</p>
        </div>

        {turnoAbierto ? (
          <div className="rounded-xl border border-success/40 bg-success/5 p-5">
            <p className="text-xs uppercase tracking-wide text-muted">Turno</p>
            <p className="mt-1 font-semibold text-foreground">Abierto</p>
            <p className="mt-1 text-sm text-muted">
              Desde las {new Date(turnoAbierto.hora_apertura).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
            No hay un turno abierto. Ábrelo desde la sección de Tickets.
          </p>
        )}

        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Tickets pendientes hoy</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{pendientesHoy}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {secciones.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-xl border border-primary/40 bg-primary/5 p-5 transition hover:bg-primary/10"
            >
              <p className="font-semibold text-foreground">{s.label}</p>
              <p className="mt-2 text-sm text-muted">{s.desc}</p>
            </Link>
          ))}
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

  const ventasPorServicioMap = new Map<string, number>();
  for (const t of ticketsEntregadosHoy) {
    const nombre = nombrePorServicio.get(t.servicio_id) ?? "Otro";
    ventasPorServicioMap.set(nombre, (ventasPorServicioMap.get(nombre) ?? 0) + (montoPorTicket.get(t.id) ?? 0));
  }
  const ventasPorServicio = Array.from(ventasPorServicioMap, ([nombre, total]) => ({ nombre, total })).sort(
    (a, b) => b.total - a.total
  );

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
    etiqueta: new Date(`${dia}T12:00:00`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric" }),
    total,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Hola, {usuario.nombre} 👋</h1>
        <p className="text-sm capitalize text-muted">{fechaHoy}</p>
      </div>

      {!turnoAbierto && (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
          No hay un turno abierto en este momento.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Ventas de hoy</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{money(ventasHoy)}</p>
          <p className="mt-1 text-xs text-muted">{numEntregadosHoy} tickets entregados</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Ticket promedio</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{money(ticketPromedioHoy)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Descuentos hoy</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{money(descuentosHoy)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Pendientes hoy</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{pendientesHoy}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold text-foreground">Ventas por servicio (hoy)</h2>
          <div className="mt-3">
            <VentasPorServicioChart data={ventasPorServicio} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold text-foreground">Tendencia de ventas (últimos 7 días)</h2>
          <div className="mt-3">
            <TendenciaVentasChart data={tendenciaVentas} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {secciones.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-xl border border-primary/40 bg-primary/5 p-5 transition hover:bg-primary/10"
          >
            <p className="font-semibold text-foreground">{s.label}</p>
            <p className="mt-2 text-sm text-muted">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
