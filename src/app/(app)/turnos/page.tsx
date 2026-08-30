import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TurnoActivoCard } from "./TurnoActivoCard";
import { HistorialTurnos } from "./HistorialTurnos";
import { RealtimeSync } from "@/components/RealtimeSync";

export default async function TurnosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, nombre, rol, puede_editar_turnos, puede_eliminar_turnos")
    .eq("id", user.id)
    .maybeSingle();

  if (!usuario) {
    redirect("/login");
  }

  const puedeEditarTurnos = usuario.rol === "dueno" || usuario.puede_editar_turnos;
  const puedeEliminarTurnos = usuario.rol === "dueno" || usuario.puede_eliminar_turnos;

  const { data: turnoAbierto } = await supabase
    .from("turnos")
    .select("*")
    .eq("estado", "abierto")
    .maybeSingle();

  let resumen = null;
  if (turnoAbierto) {
    const [{ data: pagos }, { count: pendientes }] = await Promise.all([
      supabase.from("pagos").select("metodo, monto").eq("turno_id", turnoAbierto.id),
      supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("turno_id", turnoAbierto.id)
        .neq("estado", "entregado"),
    ]);

    const totales: Record<string, number> = { efectivo: 0, tarjeta: 0, transferencia: 0 };
    for (const p of pagos ?? []) {
      totales[p.metodo] = (totales[p.metodo] ?? 0) + p.monto;
    }

    // Los cajeros no ven el total de efectivo esperado antes de cerrar: deben contar
    // la caja física a ciegas y el sistema compara contra lo esperado al cerrar.
    // Esto es lo que hace que el conteo sirva como control real, no solo trámite.
    const puedeVerEfectivo = usuario.rol !== "cajero";

    resumen = {
      totalesVisibles: puedeVerEfectivo
        ? totales
        : { tarjeta: totales.tarjeta, transferencia: totales.transferencia },
      efectivoEsperado: puedeVerEfectivo ? turnoAbierto.efectivo_inicial + totales.efectivo : null,
      pendientes: pendientes ?? 0,
      ocultarEfectivo: !puedeVerEfectivo,
    };
  }

  const { data: turnosCerrados } = await supabase
    .from("turnos")
    .select("*")
    .eq("estado", "cerrado")
    .order("hora_cierre", { ascending: false })
    .limit(30);

  const usuarioIds = [
    ...new Set(
      (turnosCerrados ?? []).flatMap((t) => [t.usuario_apertura_id, t.usuario_cierre_id]).filter(Boolean)
    ),
  ] as string[];

  const { data: usuarios } = usuarioIds.length
    ? await supabase.from("usuarios").select("id, nombre").in("id", usuarioIds)
    : { data: [] };

  const usuarioMap = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]));

  const turnoIds = (turnosCerrados ?? []).map((t) => t.id);
  const { data: pagosTurnos } = turnoIds.length
    ? await supabase.from("pagos").select("turno_id, monto").in("turno_id", turnoIds)
    : { data: [] };

  // Ganancia = lo que realmente entró de ventas (efectivo + tarjeta +
  // transferencia), sin el efectivo inicial de caja — a diferencia de
  // "Esperado", que sí lo incluye porque ese es el monto que se debe
  // contar físicamente al cerrar.
  const gananciaPorTurno = new Map<string, number>();
  for (const p of pagosTurnos ?? []) {
    gananciaPorTurno.set(p.turno_id, (gananciaPorTurno.get(p.turno_id) ?? 0) + p.monto);
  }

  const historial = (turnosCerrados ?? []).map((t) => ({
    ...t,
    nombreApertura: usuarioMap.get(t.usuario_apertura_id) ?? "—",
    nombreCierre: t.usuario_cierre_id ? usuarioMap.get(t.usuario_cierre_id) ?? "—" : "—",
    ganancia: gananciaPorTurno.get(t.id) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <RealtimeSync tablas={["turnos", "pagos"]} />
      <div>
        <h1 className="text-2xl font-bold text-foreground">Caja y turnos</h1>
        <p className="text-sm text-muted">Cierre de turno y conciliación de efectivo.</p>
      </div>

      {turnoAbierto && resumen ? (
        <TurnoActivoCard turno={turnoAbierto} resumen={resumen} puedeEliminar={puedeEliminarTurnos} />
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
          No hay un turno abierto. Ábrelo desde la sección de Tickets.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Historial de turnos</h2>
        <HistorialTurnos historial={historial} puedeEditar={puedeEditarTurnos} puedeEliminar={puedeEliminarTurnos} />
      </div>
    </div>
  );
}
