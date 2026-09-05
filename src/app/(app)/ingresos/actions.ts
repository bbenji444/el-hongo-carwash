"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requiereDuenoOEncargado() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, error: "Sesión no válida." };

  const { data: actor } = await supabase.from("usuarios").select("rol").eq("id", user.id).maybeSingle();

  if (!actor || !["dueno", "encargado"].includes(actor.rol)) {
    return { supabase, error: "No tienes permiso para administrar ingresos extra." };
  }

  return { supabase, userId: user.id, error: null };
}

export async function crearIngreso(input: { concepto: string; monto: number; fecha: string; notas: string | null }) {
  const { supabase, userId, error: permisoError } = await requiereDuenoOEncargado();
  if (permisoError) return { data: null, error: permisoError };

  const { data, error } = await supabase
    .from("ingresos_extra")
    .insert({
      concepto: input.concepto,
      monto: input.monto,
      fecha: input.fecha,
      notas: input.notas,
      creado_por: userId!,
    })
    .select("id")
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath("/", "layout");
  return { data, error: null };
}

export async function actualizarIngreso(
  ingresoId: string,
  input: { concepto: string; monto: number; fecha: string; notas: string | null }
) {
  const { supabase, error: permisoError } = await requiereDuenoOEncargado();
  if (permisoError) return { error: permisoError };

  const { error } = await supabase
    .from("ingresos_extra")
    .update({
      concepto: input.concepto,
      monto: input.monto,
      fecha: input.fecha,
      notas: input.notas,
    })
    .eq("id", ingresoId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}

export async function eliminarIngreso(ingresoId: string) {
  const { supabase, error: permisoError } = await requiereDuenoOEncargado();
  if (permisoError) return { error: permisoError };

  const { error } = await supabase.from("ingresos_extra").delete().eq("id", ingresoId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}
