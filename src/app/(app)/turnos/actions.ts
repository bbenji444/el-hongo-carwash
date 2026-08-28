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

  revalidatePath("/turnos");
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

  revalidatePath("/turnos");
  revalidatePath("/tickets");
  return { error: null };
}
