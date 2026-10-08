"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { BENJAMIN_USER_ID } from "@/lib/historial";

// Editar/eliminar renglones del histórico es exclusivo de la cuenta de
// Benjamin — ni siquiera otras cuentas con puede_ver_historial (ej. Pepe)
// pueden hacerlo. El RLS de la migración 20261008030000 bloquea esto
// también a nivel de base de datos; esta verificación aquí solo da un
// mensaje de error claro en vez de un fallo silencioso de la política.
async function requiereBenjamin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== BENJAMIN_USER_ID) {
    return { supabase, error: "Solo la cuenta de Benjamin puede modificar el histórico." };
  }

  return { supabase, error: null };
}

export async function editarMovimientoHistorial(id: string, resumen: string) {
  const { supabase, error: permisoError } = await requiereBenjamin();
  if (permisoError) return { error: permisoError };

  const resumenLimpio = resumen.trim();
  if (!resumenLimpio) return { error: "El resumen no puede quedar vacío." };

  const { error } = await supabase.from("historial_movimientos").update({ resumen: resumenLimpio }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/historial");
  revalidatePath("/", "layout");
  return { error: null };
}

export async function eliminarMovimientoHistorial(id: string) {
  const { supabase, error: permisoError } = await requiereBenjamin();
  if (permisoError) return { error: permisoError };

  const { error } = await supabase.from("historial_movimientos").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/historial");
  revalidatePath("/", "layout");
  return { error: null };
}
