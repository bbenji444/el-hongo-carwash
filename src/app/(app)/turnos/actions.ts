"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Verifica el permiso "puede_editar_turnos" (dueño siempre lo tiene; a los
// demás roles el dueño se los puede delegar por usuario desde /usuarios).
// Se revisa aquí además de en RLS por el mismo motivo que en tickets/actions.ts:
// da un mensaje de error claro en vez de un fallo silencioso de la política.
async function requierePermisoEditarTurnos() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, error: "Sesión no válida." };

  const { data: actor } = await supabase
    .from("usuarios")
    .select("rol, puede_editar_turnos")
    .eq("id", user.id)
    .maybeSingle();

  const autorizado = Boolean(actor && (actor.rol === "dueno" || actor.puede_editar_turnos));

  if (!autorizado) {
    return { supabase, error: "No tienes permiso para editar turnos ya cerrados." };
  }

  return { supabase, error: null };
}

// Corrige el efectivo inicial y/o el efectivo contado de un turno ya
// cerrado (por ejemplo, si se capturó mal al hacer el cierre). El trigger
// tr_turno_cierre_calcula recalcula efectivo_esperado y diferencia solo con
// que cambie cualquiera de los dos montos.
export async function editarTurnoCerrado(
  turnoId: string,
  input: { efectivoInicial: number; efectivoContado: number }
) {
  const { supabase, error: permisoError } = await requierePermisoEditarTurnos();
  if (permisoError) return { error: permisoError };

  const { error } = await supabase
    .from("turnos")
    .update({
      efectivo_inicial: input.efectivoInicial,
      efectivo_contado: input.efectivoContado,
    })
    .eq("id", turnoId)
    .eq("estado", "cerrado");

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}

// Mismo patrón que requierePermisoEditarTurnos, para el permiso separado
// de eliminar turnos por completo (más destructivo: se lleva tickets y
// pagos, no solo corrige montos).
async function requierePermisoEliminarTurnos() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, error: "Sesión no válida." };

  const { data: actor } = await supabase
    .from("usuarios")
    .select("rol, puede_eliminar_turnos")
    .eq("id", user.id)
    .maybeSingle();

  const autorizado = Boolean(actor && (actor.rol === "dueno" || actor.puede_eliminar_turnos));

  if (!autorizado) {
    return { supabase, error: "No tienes permiso para eliminar turnos." };
  }

  return { supabase, error: null };
}

// Borra el turno completo junto con sus pagos y tickets (los ticket_extras
// se van solos por el ON DELETE CASCADE hacia tickets). Se borra en ese
// orden — pagos, tickets, turno — para no toparse con las llaves foráneas
// que no tienen cascada.
export async function eliminarTurno(turnoId: string) {
  const { supabase, error: permisoError } = await requierePermisoEliminarTurnos();
  if (permisoError) return { error: permisoError };

  const { error: pagosError } = await supabase.from("pagos").delete().eq("turno_id", turnoId);
  if (pagosError) return { error: pagosError.message };

  const { error: ticketsError } = await supabase.from("tickets").delete().eq("turno_id", turnoId);
  if (ticketsError) return { error: ticketsError.message };

  const { error } = await supabase.from("turnos").delete().eq("id", turnoId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}

export async function cerrarTurno(turnoId: string, efectivoContado: number) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sesión no válida." };

  const { error } = await supabase
    .from("turnos")
    .update({
      estado: "cerrado",
      efectivo_contado: efectivoContado,
      usuario_cierre_id: user.id,
      hora_cierre: new Date().toISOString(),
    })
    .eq("id", turnoId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}
