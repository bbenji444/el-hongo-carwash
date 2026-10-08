import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type AccionHistorial = "crear" | "editar" | "eliminar" | "activar" | "desactivar";
export type EntidadHistorial = "ticket" | "gasto" | "ingreso_extra" | "usuario";

// Registra un renglón en el histórico de movimientos — se usa desde cada
// Server Action que crea/edita/elimina algo importante. Nunca bloquea la
// acción real: si el registro falla, solo se avisa en la consola del
// servidor (perder un renglón del histórico es mucho menos grave que
// perder la venta/gasto/ticket real por un error aquí).
export async function registrarMovimiento(
  supabase: SupabaseClient<Database>,
  usuarioId: string,
  accion: AccionHistorial,
  entidad: EntidadHistorial,
  entidadId: string | null,
  resumen: string
) {
  const { data: usuario } = await supabase.from("usuarios").select("nombre").eq("id", usuarioId).maybeSingle();

  const { error } = await supabase.from("historial_movimientos").insert({
    usuario_id: usuarioId,
    usuario_nombre: usuario?.nombre ?? "—",
    accion,
    entidad,
    entidad_id: entidadId,
    resumen,
  });

  if (error) {
    console.error("No se pudo registrar en el histórico de movimientos:", error.message);
  }
}
