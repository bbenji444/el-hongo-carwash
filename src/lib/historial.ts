import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Cuenta de Benjamin — la única con permiso para editar/eliminar renglones
// del histórico (ver historial/actions.ts) y la única cuyas propias
// consultas/ediciones/eliminaciones se excluyen de quedar registradas (ver
// nota en registrarMovimiento). Mismo id que USUARIO_HISTORICO_ID usa en
// usuarios/actions.ts para la reactivación de la cuenta original.
export const BENJAMIN_USER_ID = "3069df5a-d7c0-4f0a-8b6e-7d8914f13a51";

export type AccionHistorial = "crear" | "editar" | "eliminar" | "activar" | "desactivar" | "abrir" | "cerrar" | "ver";
export type EntidadHistorial = "ticket" | "gasto" | "ingreso_extra" | "usuario" | "turno" | "lavador" | "reporte";

export const ACCION_EMOJI: Record<AccionHistorial, string> = {
  crear: "✅",
  editar: "✏️",
  eliminar: "🗑️",
  activar: "🔓",
  desactivar: "🔒",
  abrir: "🟢",
  cerrar: "🔴",
  ver: "👁️",
};

export const ACCION_LABEL: Record<AccionHistorial, string> = {
  crear: "Creó",
  editar: "Editó",
  eliminar: "Eliminó",
  activar: "Activó",
  desactivar: "Desactivó",
  abrir: "Abrió turno",
  cerrar: "Cerró turno",
  ver: "Consultó / visitó",
};

export const ENTIDAD_LABEL: Record<EntidadHistorial, string> = {
  ticket: "Ticket",
  gasto: "Gasto",
  ingreso_extra: "Ingreso extra",
  usuario: "Usuario",
  turno: "Turno",
  lavador: "Trabajador",
  reporte: "Reportes",
};

// Acciones que representan un cambio real contra el negocio (vs. solo
// consultar/ver algo) — usado por el filtro de /historial.
export const ACCIONES_CAMBIO: AccionHistorial[] = [
  "crear",
  "editar",
  "eliminar",
  "activar",
  "desactivar",
  "abrir",
  "cerrar",
];

export function tiempoRelativo(fechaIso: string): string {
  const diffMs = Date.now() - new Date(fechaIso).getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return "justo ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias}d`;
}

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
  // A petición explícita de Benjamin: su propia cuenta no deja rastro en el
  // histórico de sus consultas, ediciones o eliminaciones — solo se
  // registra cuando ÉL da de alta un ticket (su actividad operativa normal
  // del día a día). Es una decisión consciente del dueño sobre su propia
  // cuenta; no cambia nada para ningún otro usuario.
  if (usuarioId === BENJAMIN_USER_ID && !(accion === "crear" && entidad === "ticket")) {
    return;
  }

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
