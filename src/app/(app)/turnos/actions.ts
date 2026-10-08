"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registrarMovimiento } from "@/lib/historial";

// Verifica el permiso "puede_editar_turnos" (dueño siempre lo tiene; a los
// demás roles el dueño se los puede delegar por usuario desde /usuarios).
// Se revisa aquí además de en RLS por el mismo motivo que en tickets/actions.ts:
// da un mensaje de error claro en vez de un fallo silencioso de la política.
async function requierePermisoEditarTurnos() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, actorId: null, error: "Sesión no válida." };

  const { data: actor } = await supabase
    .from("usuarios")
    .select("rol, puede_editar_turnos")
    .eq("id", user.id)
    .maybeSingle();

  const autorizado = Boolean(actor && (actor.rol === "dueno" || actor.puede_editar_turnos));

  if (!autorizado) {
    return { supabase, actorId: user.id, error: "No tienes permiso para editar turnos ya cerrados." };
  }

  return { supabase, actorId: user.id, error: null };
}

// Corrige el efectivo inicial y/o el efectivo contado de un turno ya
// cerrado (por ejemplo, si se capturó mal al hacer el cierre). El trigger
// tr_turno_cierre_calcula recalcula efectivo_esperado y diferencia solo con
// que cambie cualquiera de los dos montos.
export async function editarTurnoCerrado(
  turnoId: string,
  input: { efectivoInicial: number; efectivoContado: number }
) {
  const { supabase, actorId, error: permisoError } = await requierePermisoEditarTurnos();
  if (permisoError) return { error: permisoError };

  const { data: turnoAntes } = await supabase
    .from("turnos")
    .select("efectivo_inicial, efectivo_contado")
    .eq("id", turnoId)
    .maybeSingle();

  const { error } = await supabase
    .from("turnos")
    .update({
      efectivo_inicial: input.efectivoInicial,
      efectivo_contado: input.efectivoContado,
    })
    .eq("id", turnoId)
    .eq("estado", "cerrado");

  if (error) return { error: error.message };

  // Editar los montos de un turno YA cerrado cambia el efectivo
  // esperado/diferencia con los que ya se hizo el corte de caja — de los
  // movimientos más sensibles para detectar manipulación, por eso el
  // resumen lleva el antes→después explícito.
  await registrarMovimiento(
    supabase,
    actorId!,
    "editar",
    "turno",
    turnoId,
    `Editó un turno cerrado — efectivo inicial $${(turnoAntes?.efectivo_inicial ?? 0).toFixed(2)}→$${input.efectivoInicial.toFixed(2)}, contado $${(turnoAntes?.efectivo_contado ?? 0).toFixed(2)}→$${input.efectivoContado.toFixed(2)}`
  );

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

  if (!user) return { supabase, actorId: null, error: "Sesión no válida." };

  const { data: actor } = await supabase
    .from("usuarios")
    .select("rol, puede_eliminar_turnos")
    .eq("id", user.id)
    .maybeSingle();

  const autorizado = Boolean(actor && (actor.rol === "dueno" || actor.puede_eliminar_turnos));

  if (!autorizado) {
    return { supabase, actorId: user.id, error: "No tienes permiso para eliminar turnos." };
  }

  return { supabase, actorId: user.id, error: null };
}

// Borra el turno completo junto con sus pagos y tickets (los ticket_extras
// se van solos por el ON DELETE CASCADE hacia tickets). Se borra en ese
// orden — pagos, tickets, turno — para no toparse con las llaves foráneas
// que no tienen cascada.
export async function eliminarTurno(turnoId: string) {
  const { supabase, actorId, error: permisoError } = await requierePermisoEliminarTurnos();
  if (permisoError) return { error: permisoError };

  const { data: turno } = await supabase
    .from("turnos")
    .select("hora_apertura, efectivo_inicial, efectivo_contado")
    .eq("id", turnoId)
    .maybeSingle();
  const { count: numTickets } = await supabase
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .eq("turno_id", turnoId);

  const { error: pagosError } = await supabase.from("pagos").delete().eq("turno_id", turnoId);
  if (pagosError) return { error: pagosError.message };

  const { error: ticketsError } = await supabase.from("tickets").delete().eq("turno_id", turnoId);
  if (ticketsError) return { error: ticketsError.message };

  const { error } = await supabase.from("turnos").delete().eq("id", turnoId);
  if (error) return { error: error.message };

  // Borra tickets y pagos completos junto con el turno — de las acciones
  // más destructivas del sistema, así que queda registrada con el detalle
  // de cuántos tickets se llevó y cuándo se había abierto.
  await registrarMovimiento(
    supabase,
    actorId!,
    "eliminar",
    "turno",
    turnoId,
    `Eliminó un turno completo (${numTickets ?? 0} tickets, abierto ${
      turno?.hora_apertura
        ? new Date(turno.hora_apertura).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })
        : "—"
    })`
  );

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

  await registrarMovimiento(
    supabase,
    user.id,
    "cerrar",
    "turno",
    turnoId,
    `Cerró un turno (efectivo contado: $${efectivoContado.toFixed(2)})`
  );

  revalidatePath("/", "layout");
  return { error: null };
}
