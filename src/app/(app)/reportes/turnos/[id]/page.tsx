import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TAMANOS_VEHICULO, nombreTamano } from "@/lib/servicios";
import type { TamanoVehiculo, PagoMetodo } from "@/types/database.types";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

const METODO_LABEL: Record<PagoMetodo, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  membresia: "Membresía",
};

const ESTADO_LABEL: Record<string, string> = {
  en_espera: "En espera",
  en_proceso: "En proceso",
  terminado: "Terminado",
  entregado: "Entregado",
};

export default async function DesgloseTurnoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ servicio?: string; tamano?: string; metodo?: string }>;
}) {
  const { id } = await params;
  const filtros = await searchParams;

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

  const { data: turno } = await supabase.from("turnos").select("*").eq("id", id).maybeSingle();

  if (!turno) {
    notFound();
  }

  const [{ data: tickets }, { data: pagos }] = await Promise.all([
    supabase.from("tickets").select("*").eq("turno_id", id).order("hora_entrada"),
    supabase.from("pagos").select("*").eq("turno_id", id),
  ]);

  const servicioIds = [...new Set((tickets ?? []).map((t) => t.servicio_id))];
  const clienteIds = [...new Set((tickets ?? []).map((t) => t.cliente_id).filter(Boolean))] as string[];
  const vehiculoIds = [...new Set((tickets ?? []).map((t) => t.vehiculo_id).filter(Boolean))] as string[];
  const empleadoIds = [...new Set((tickets ?? []).map((t) => t.empleado_id).filter(Boolean))] as string[];
  const lavadorIds = [...new Set((tickets ?? []).map((t) => t.lavador_id).filter(Boolean))] as string[];

  const [
    { data: servicios },
    { data: clientes },
    { data: vehiculos },
    { data: empleados },
    { data: lavadoresTurno },
    { data: usuariosNombres },
  ] = await Promise.all([
    servicioIds.length
      ? supabase.from("servicios_catalogo").select("id, nombre").in("id", servicioIds)
      : Promise.resolve({ data: [] }),
    clienteIds.length
      ? supabase.from("clientes").select("id, nombre").in("id", clienteIds)
      : Promise.resolve({ data: [] }),
    vehiculoIds.length
      ? supabase.from("vehiculos").select("id, placas").in("id", vehiculoIds)
      : Promise.resolve({ data: [] }),
    empleadoIds.length
      ? supabase.from("usuarios").select("id, nombre").in("id", empleadoIds)
      : Promise.resolve({ data: [] }),
    lavadorIds.length
      ? supabase.from("lavadores").select("id, nombre").in("id", lavadorIds)
      : Promise.resolve({ data: [] }),
    supabase.from("usuarios").select("id, nombre").in("id", [turno.usuario_apertura_id, turno.usuario_cierre_id].filter(Boolean) as string[]),
  ]);

  const nombrePorServicio = new Map((servicios ?? []).map((s) => [s.id, s.nombre]));
  const nombrePorCliente = new Map((clientes ?? []).map((c) => [c.id, c.nombre]));
  const placasPorVehiculo = new Map((vehiculos ?? []).map((v) => [v.id, v.placas]));
  const nombrePorEmpleado = new Map((empleados ?? []).map((e) => [e.id, e.nombre]));
  const nombrePorLavador = new Map((lavadoresTurno ?? []).map((l) => [l.id, l.nombre]));
  const nombrePorUsuario = new Map((usuariosNombres ?? []).map((u) => [u.id, u.nombre]));

  const pagosPorTicket = new Map<string, { monto: number; metodo: PagoMetodo }[]>();
  for (const p of pagos ?? []) {
    const lista = pagosPorTicket.get(p.ticket_id) ?? [];
    lista.push({ monto: p.monto, metodo: p.metodo });
    pagosPorTicket.set(p.ticket_id, lista);
  }

  const filaTickets = (tickets ?? []).map((t) => {
    const pagosTicket = pagosPorTicket.get(t.id) ?? [];
    return {
      id: t.id,
      horaEntrada: t.hora_entrada,
      cliente: t.cliente_id ? nombrePorCliente.get(t.cliente_id) ?? "—" : t.distintivo ?? "Mostrador",
      placas: t.cliente_id ? t.distintivo ?? (t.vehiculo_id ? placasPorVehiculo.get(t.vehiculo_id) ?? null : null) : null,
      servicioId: t.servicio_id,
      servicio: nombrePorServicio.get(t.servicio_id) ?? "—",
      tamanoVehiculo: t.tamano_vehiculo,
      empleado: nombrePorEmpleado.get(t.empleado_id) ?? "—",
      lavador: t.lavador_id ? nombrePorLavador.get(t.lavador_id) ?? "—" : "—",
      estado: t.estado,
      descuentoMonto: t.descuento_monto,
      lavadaGratis: t.lavada_gratis,
      pagos: pagosTicket,
      montoTotal: pagosTicket.reduce((acc, p) => acc + p.monto, 0),
    };
  });

  const serviciosPresentes = [...nombrePorServicio.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const filtroServicio = filtros.servicio ?? "";
  const filtroTamano = (filtros.tamano ?? "") as TamanoVehiculo | "";
  const filtroMetodo = (filtros.metodo ?? "") as PagoMetodo | "";

  const filaFiltrada = filaTickets.filter((t) => {
    if (filtroServicio && t.servicioId !== filtroServicio) return false;
    if (filtroTamano && t.tamanoVehiculo !== filtroTamano) return false;
    if (filtroMetodo && !t.pagos.some((p) => p.metodo === filtroMetodo)) return false;
    return true;
  });

  const totalFiltrado = filaFiltrada.reduce((acc, t) => acc + t.montoTotal, 0);
  const hayFiltro = Boolean(filtroServicio || filtroTamano || filtroMetodo);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/reportes" className="text-sm text-accent hover:underline">
          ← Volver a Reportes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Desglose del turno</h1>
        <p className="text-sm text-muted">
          Abierto el {new Date(turno.hora_apertura).toLocaleString("es-MX")}
          {turno.hora_cierre && ` · Cerrado el ${new Date(turno.hora_cierre).toLocaleString("es-MX")}`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Abrió / Cerró</p>
          <p className="mt-1 font-semibold text-foreground">
            {nombrePorUsuario.get(turno.usuario_apertura_id) ?? "—"}
          </p>
          <p className="text-sm text-muted">
            {turno.usuario_cierre_id ? nombrePorUsuario.get(turno.usuario_cierre_id) ?? "—" : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Efectivo inicial / esperado</p>
          <p className="mt-1 font-semibold text-foreground">{money(turno.efectivo_inicial)}</p>
          <p className="text-sm text-muted">{turno.efectivo_esperado != null ? money(turno.efectivo_esperado) : "—"}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Efectivo contado</p>
          <p className="mt-1 font-semibold text-foreground">
            {turno.efectivo_contado != null ? money(turno.efectivo_contado) : "—"}
          </p>
        </div>
        <div
          className={`rounded-xl border p-5 ${
            turno.alerta_diferencia ? "border-primary/40 bg-primary/5" : "border-border bg-surface"
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-muted">Diferencia</p>
          <p className={`mt-1 text-xl font-bold ${turno.alerta_diferencia ? "text-primary" : "text-foreground"}`}>
            {turno.diferencia != null ? money(turno.diferencia) : "—"}
          </p>
          {turno.alerta_diferencia && <p className="mt-1 text-xs text-primary">Este turno tiene faltante/sobrante.</p>}
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface px-4 py-3">
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
            {serviciosPresentes.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tamano" className="text-[11px] text-muted">
            Tamaño de vehículo
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
            {(Object.entries(METODO_LABEL) as [PagoMetodo, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
            hayFiltro ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"
          }`}
        >
          Filtrar
        </button>
        {hayFiltro && (
          <Link
            href={`/reportes/turnos/${id}`}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
          >
            Quitar filtros
          </Link>
        )}
        <div className="ml-auto text-sm text-muted">
          {filaFiltrada.length} tickets{hayFiltro && ` de ${filaTickets.length}`} · Total:{" "}
          <span className="font-semibold text-foreground">{money(totalFiltrado)}</span>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Hora</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Distintivo</th>
              <th className="px-4 py-3">Paquete</th>
              <th className="px-4 py-3">Tamaño</th>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Lavador</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Método</th>
              <th className="px-4 py-3">Monto</th>
            </tr>
          </thead>
          <tbody>
            {filaFiltrada.map((t) => (
              <tr key={t.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                <td className="px-4 py-3 text-muted">
                  {new Date(t.horaEntrada).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-3 text-foreground">{t.cliente}</td>
                <td className="px-4 py-3 text-muted">{t.placas ?? "—"}</td>
                <td className="px-4 py-3 text-foreground">
                  {t.servicio}
                  {t.descuentoMonto > 0 && (
                    <span className="text-warning"> · -{money(t.descuentoMonto)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{nombreTamano(t.tamanoVehiculo)}</td>
                <td className="px-4 py-3 text-foreground">{t.empleado}</td>
                <td className="px-4 py-3 text-muted">{t.lavador}</td>
                <td className="px-4 py-3 text-muted">{ESTADO_LABEL[t.estado] ?? t.estado}</td>
                <td className="px-4 py-3 text-muted">
                  {t.lavadaGratis
                    ? "Gratis"
                    : t.pagos.length > 0
                      ? t.pagos.map((p) => METODO_LABEL[p.metodo]).join(", ")
                      : "—"}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{money(t.montoTotal)}</td>
              </tr>
            ))}
            {filaFiltrada.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-muted">
                  {hayFiltro ? "Ningún ticket coincide con este filtro." : "Sin tickets en este turno."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
