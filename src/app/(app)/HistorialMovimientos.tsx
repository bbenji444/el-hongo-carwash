import { createClient } from "@/lib/supabase/server";

const ACCION_EMOJI: Record<string, string> = {
  crear: "✅",
  editar: "✏️",
  eliminar: "🗑️",
  activar: "🔓",
  desactivar: "🔒",
};

function tiempoRelativo(fechaIso: string): string {
  const diffMs = Date.now() - new Date(fechaIso).getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return "justo ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias}d`;
}

// Panel exclusivo del "perfil maestro" (puede_ver_historial = true, hoy
// solo Benjamin) — RLS ya lo bloquea también a nivel de base de datos para
// cualquier otra cuenta, esto solo decide si se muestra la sección.
export async function HistorialMovimientos() {
  const supabase = await createClient();

  const { data: movimientos } = await supabase
    .from("historial_movimientos")
    .select("id, usuario_nombre, accion, entidad, resumen, creado_en")
    .order("creado_en", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <div>
        <h2 className="font-semibold text-foreground">Histórico de movimientos</h2>
        <p className="text-xs text-muted">Quién creó, editó o eliminó algo en el sistema — solo tú ves esto.</p>
      </div>

      <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
        {(movimientos ?? []).map((m) => (
          <div key={m.id} className="flex items-start gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-surface-hover">
            <span className="mt-0.5 text-base">{ACCION_EMOJI[m.accion] ?? "•"}</span>
            <div className="min-w-0 flex-1">
              <p className="text-foreground">
                <span className="font-medium">{m.usuario_nombre}</span> — {m.resumen}
              </p>
              <p className="text-xs text-muted">{tiempoRelativo(m.creado_en)}</p>
            </div>
          </div>
        ))}
        {(!movimientos || movimientos.length === 0) && (
          <p className="px-2 py-6 text-center text-sm text-muted">Todavía no hay movimientos registrados.</p>
        )}
      </div>
    </div>
  );
}
