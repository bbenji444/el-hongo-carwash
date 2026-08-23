import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TurnoActivoCard } from "./TurnoActivoCard";

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
    .select("id, nombre, rol")
    .eq("id", user.id)
    .maybeSingle();

  if (!usuario) {
    redirect("/login");
  }

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

    const totales: Record<string, number> = { efectivo: 0, tarjeta: 0, transferencia: 0, membresia: 0 };
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
        : { tarjeta: totales.tarjeta, transferencia: totales.transferencia, membresia: totales.membresia },
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

  const historial = (turnosCerrados ?? []).map((t) => ({
    ...t,
    nombreApertura: usuarioMap.get(t.usuario_apertura_id) ?? "—",
    nombreCierre: t.usuario_cierre_id ? usuarioMap.get(t.usuario_cierre_id) ?? "—" : "—",
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Caja y turnos</h1>
        <p className="text-sm text-muted">Cierre de turno y conciliación de efectivo.</p>
      </div>

      {turnoAbierto && resumen ? (
        <TurnoActivoCard turno={turnoAbierto} resumen={resumen} />
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
          No hay un turno abierto. Ábrelo desde la sección de Tickets.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Historial de turnos</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Apertura</th>
                <th className="px-3 py-2">Cierre</th>
                <th className="px-3 py-2">Abrió</th>
                <th className="px-3 py-2">Cerró</th>
                <th className="px-3 py-2 text-right">Inicial</th>
                <th className="px-3 py-2 text-right">Esperado</th>
                <th className="px-3 py-2 text-right">Contado</th>
                <th className="px-3 py-2 text-right">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((t) => (
                <tr key={t.id} className={`border-t border-border ${t.alerta_diferencia ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-2 text-muted">{new Date(t.hora_apertura).toLocaleString("es-MX")}</td>
                  <td className="px-3 py-2 text-muted">
                    {t.hora_cierre ? new Date(t.hora_cierre).toLocaleString("es-MX") : "—"}
                  </td>
                  <td className="px-3 py-2 text-foreground">{t.nombreApertura}</td>
                  <td className="px-3 py-2 text-foreground">{t.nombreCierre}</td>
                  <td className="px-3 py-2 text-right text-foreground">${t.efectivo_inicial.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-foreground">
                    {t.efectivo_esperado != null ? `$${t.efectivo_esperado.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">
                    {t.efectivo_contado != null ? `$${t.efectivo_contado.toFixed(2)}` : "—"}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-medium ${
                      t.alerta_diferencia ? "text-primary" : "text-success"
                    }`}
                  >
                    {t.diferencia != null ? `$${t.diferencia.toFixed(2)}` : "—"}
                  </td>
                </tr>
              ))}
              {historial.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted">
                    Sin turnos cerrados aún.
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
