"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registrarMovimiento } from "@/lib/historial";
import type { LavadorTipo } from "@/types/database.types";

async function usuarioActual(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function crearLavador(nombre: string, tipo: LavadorTipo) {
  const supabase = await createClient();

  const { data, error } = await supabase.from("lavadores").insert({ nombre, tipo }).select("id").single();

  if (error) return { error: error.message };

  const actorId = await usuarioActual(supabase);
  if (actorId) {
    await registrarMovimiento(supabase, actorId, "crear", "lavador", data.id, `Dio de alta al trabajador ${nombre} (${tipo})`);
  }

  revalidatePath("/lavadores");
  revalidatePath("/tickets");
  revalidatePath("/gastos");
  return { error: null };
}

export async function actualizarLavador(id: string, nombre: string, tipo: LavadorTipo) {
  const supabase = await createClient();

  const { data: antes } = await supabase.from("lavadores").select("nombre, tipo").eq("id", id).maybeSingle();

  const { error } = await supabase.from("lavadores").update({ nombre, tipo }).eq("id", id);

  if (error) return { error: error.message };

  // Mismo criterio que editar un ticket: solo menciona en el resumen lo
  // que de verdad cambió (ej. "nombre: Tripas → Manuel"), no solo "editó".
  const cambios: string[] = [];
  if (antes && antes.nombre !== nombre) cambios.push(`nombre: ${antes.nombre} → ${nombre}`);
  if (antes && antes.tipo !== tipo) cambios.push(`tipo: ${antes.tipo} → ${tipo}`);

  const actorId = await usuarioActual(supabase);
  if (actorId) {
    await registrarMovimiento(
      supabase,
      actorId,
      "editar",
      "lavador",
      id,
      `Editó al trabajador ${antes?.nombre ?? nombre}${cambios.length ? ` — ${cambios.join(", ")}` : ""}`
    );
  }

  revalidatePath("/lavadores");
  revalidatePath("/tickets");
  revalidatePath("/gastos");
  return { error: null };
}

export async function toggleActivoLavador(id: string, activo: boolean) {
  const supabase = await createClient();

  const { data: lavador } = await supabase.from("lavadores").select("nombre").eq("id", id).maybeSingle();

  const { error } = await supabase.from("lavadores").update({ activo }).eq("id", id);

  if (error) return { error: error.message };

  const actorId = await usuarioActual(supabase);
  if (actorId) {
    await registrarMovimiento(
      supabase,
      actorId,
      activo ? "activar" : "desactivar",
      "lavador",
      id,
      `${activo ? "Activó" : "Desactivó"} al trabajador ${lavador?.nombre ?? "—"}`
    );
  }

  revalidatePath("/lavadores");
  revalidatePath("/tickets");
  return { error: null };
}

export async function eliminarLavador(id: string) {
  const supabase = await createClient();

  const { data: lavador } = await supabase.from("lavadores").select("nombre").eq("id", id).maybeSingle();

  const { error } = await supabase.from("lavadores").delete().eq("id", id);

  if (error) {
    // 23503 = violación de llave foránea: ya tiene tickets y/o gastos de
    // nómina asociados, así que borrarlo rompería ese historial. Toca
    // desactivarlo en su lugar.
    if (error.code === "23503") {
      return {
        error: "No se puede eliminar: ya tiene autos lavados o pagos de nómina registrados. Desactívalo en vez de eliminarlo.",
      };
    }
    return { error: error.message };
  }

  const actorId = await usuarioActual(supabase);
  if (actorId) {
    await registrarMovimiento(supabase, actorId, "eliminar", "lavador", id, `Eliminó al trabajador ${lavador?.nombre ?? "—"}`);
  }

  revalidatePath("/lavadores");
  revalidatePath("/tickets");
  return { error: null };
}
