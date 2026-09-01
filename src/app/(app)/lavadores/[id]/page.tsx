import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PERIODOS, resolverRango, queryStringRango } from "@/lib/rangoFechas";
import { nombreTamano } from "@/lib/servicios";
import { obtenerConfiguracion } from "@/lib/configuracion";
import type { TamanoVehiculo } from "@/types/database.types";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function formatearMinutos(minutos: number) {
  const redondeado = Math.round(minutos);
  if (redondeado < 60) return `${redondeado} min`;
  const horas = Math.floor(redondeado / 60);
  const resto = redondeado % 60;
  return resto > 0 ? `${horas}h ${resto}min` : `${horas}h`;
}

const ESTADO_LABEL: Record<string, string> = {
  en_espera: "En espera",
  en_proceso: "En proceso",
  terminado: "Terminado",
  entregado: "Entregado",
};

export default async function DesgloseLavadorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }>;
}) {
  const { id } = await params;
  const searchParamsResueltos = await searchParams;

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

  const { data: lavador } = await supabase.from("lavadores").select("*").eq("id", id).maybeSingle();

  if (!lavador) {
    notFound();
  }

  const config = await obtenerConfiguracion();
  const rango = resolverRango(searchParamsResueltos);
  const qs = queryStringRango(rango);

  const ticketsQuery = supabase
    .from("tickets")
    .select(
      "id, cliente_id, vehiculo_id, distintivo, placa, servicio_id, tamano_vehiculo, estado, hora_entrada, hora_inicio_lavado, hora_fin_lavado"
    )
    .eq("lavador_id", id)
    .order("hora_entrada", { ascending: false });
  if (rango.desdeIso) ticketsQuery.gte("hora_entrada", rango.desdeIso);
  if (rango.hastaIso) ticketsQuery.lte("hora_entrada", rango.hastaIso);

  const { data: tickets } = await ticketsQuery;

  const servicioIds = [...new Set((tickets ?? []).map((t) => t.servicio_id))];
  const clienteIds = [...new Set((tickets ?? []).map((t) => t.cliente_id).filter(Boolean))] as string[];
  const vehiculoIds = [...new Set((tickets ?? []).map((t) => t.vehiculo_id).filter(Boolean))] as string[];
  const ticketIds = (tickets ?? []).map((t) => t.id);

  const [{ data: servicios }, { data: clientes }, { data: vehiculos }, { data: pagos }] = await Promise.all([
    servicioIds.length
      ? supabase.from("servicios_catalogo").select("id, nombre").in("id", servicioIds)
      : Promise.resolve({ data: [] }),
    clienteIds.length
      ? supabase.from("clientes").select("id, nombre").in("id", clienteIds)
      : Promise.resolve({ data: [] }),
    vehiculoIds.length
      ? supabase.from("vehiculos").select("id, placas").in("id", vehiculoIds)
      : Promise.resolve({ data: [] }),
    ticketIds.length
      ? supabase.from("pagos").select("ticket_id, monto").in("ticket_id", ticketIds)
      : Promise.resolve({ data: [] }),
  ]);

  const nombrePorServicio = new Map((servicios ?? []).map((s) => [s.id, s.nombre]));
  const nombrePorCliente = new Map((clientes ?? []).map((c) => [c.id, c.nombre]));
  const placasPorVehiculo = new Map((vehiculos ?? []).map((v) => [v.id, v.placas]));
  const montoPorTicket = new Map<string, number>();
  for (const p of pagos ?? []) {
    montoPorTicket.set(p.ticket_id, (montoPorTicket.get(p.ticket_id) ?? 0) + p.monto);
  }

  const filaTickets = (tickets ?? []).map((t) => ({
    id: t.id,
    horaEntrada: t.hora_entrada,
    cliente: t.cliente_id ? nombrePorCliente.get(t.cliente_id) ?? "—" : t.distintivo ?? "Mostrador",
    placas:
      [
        t.cliente_id ? t.distintivo : null,
        t.placa ?? (t.vehiculo_id ? placasPorVehiculo.get(t.vehiculo_id) ?? null : null),
      ]
        .filter(Boolean)
        .join(" · ") || null,
    servicio: nombrePorServicio.get(t.servicio_id) ?? "—",
    tamanoVehiculo: t.tamano_vehiculo,
    estado: t.estado,
    monto: montoPorTicket.get(t.id) ?? 0,
    tiempoLavadoMin:
      t.hora_inicio_lavado && t.hora_fin_lavado
        ? (new Date(t.hora_fin_lavado).getTime() - new Date(t.hora_inicio_lavado).getTime()) / 60000
        : null,
  }));

  const entregados = filaTickets.filter((t) => t.estado === "entregado");
  const totalAutos = entregados.length;
  const totalVentas = entregados.reduce((acc, t) => acc + t.monto, 0);
  const porTamano = new Map<TamanoVehiculo, number>();
  for (const t of entregados) {
    porTamano.set(t.tamanoVehiculo, (porTamano.get(t.tamanoVehiculo) ?? 0) + 1);
  }

  // Tiempo real de lavada (de "Iniciar" a "Terminado", sin contar la espera
  // en cola) de todas las lavadas que ya pasaron por ese tramo, entregadas
  // o no.
  const conTiempoLavado = (tickets ?? []).filter((t) => t.hora_inicio_lavado && t.hora_fin_lavado);
  const tiempoPromedioLavadoMin =
    conTiempoLavado.length > 0
      ? conTiempoLavado.reduce(
          (acc, t) => acc + (new Date(t.hora_fin_lavado!).getTime() - new Date(t.hora_inicio_lavado!).getTime()),
          0
        ) /
        conTiempoLavado.length /
        60000
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/lavadores${qs ? `?${qs}` : ""}`} className="text-sm text-accent hover:underline">
          ← Volver a Lavadores
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">
          {config.emoji_lavador} {lavador.nombre}
        </h1>
        <p className="text-sm text-muted">
          {lavador.activo ? "Activo" : "Inactivo"} · Registrado el {new Date(lavador.creado_en).toLocaleDateString("es-MX")}
        </p>
      </div>

      <div className="flex gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p.value}
            href={`/lavadores/${id}?periodo=${p.value}`}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Autos lavados</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{totalAutos}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Ventas generadas</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{money(totalVentas)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Tiempo promedio de lavada</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {tiempoPromedioLavadoMin !== null ? formatearMinutos(tiempoPromedioLavadoMin) : "—"}
          </p>
          <p className="text-[11px] text-muted">De &quot;Iniciar&quot; a &quot;Terminado&quot;</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 sm:col-span-2">
          <p className="text-xs uppercase tracking-wide text-muted">Por tamaño de vehículo</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...porTamano.entries()].map(([tamano, count]) => (
              <span
                key={tamano}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
              >
                {nombreTamano(tamano)}: {count}
              </span>
            ))}
            {porTamano.size === 0 && <span className="text-sm text-muted">Sin autos entregados en este período.</span>}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Distintivo</th>
              <th className="px-4 py-3">Paquete</th>
              <th className="px-4 py-3">Tamaño</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Tiempo de lavada</th>
              <th className="px-4 py-3">Monto</th>
            </tr>
          </thead>
          <tbody>
            {filaTickets.map((t) => (
              <tr key={t.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                <td className="px-4 py-3 text-muted">{new Date(t.horaEntrada).toLocaleString("es-MX")}</td>
                <td className="px-4 py-3 text-foreground">{t.cliente}</td>
                <td className="px-4 py-3 text-muted">{t.placas ?? "—"}</td>
                <td className="px-4 py-3 text-foreground">{t.servicio}</td>
                <td className="px-4 py-3 text-muted">{nombreTamano(t.tamanoVehiculo)}</td>
                <td className="px-4 py-3 text-muted">{ESTADO_LABEL[t.estado] ?? t.estado}</td>
                <td className="px-4 py-3 text-muted">
                  {t.tiempoLavadoMin !== null ? formatearMinutos(t.tiempoLavadoMin) : "—"}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{money(t.monto)}</td>
              </tr>
            ))}
            {filaTickets.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted">
                  Sin tickets asignados en este período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
