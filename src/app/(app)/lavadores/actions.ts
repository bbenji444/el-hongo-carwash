"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearLavador(nombre: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("lavadores").insert({ nombre });

  if (error) return { error: error.message };

  revalidatePath("/lavadores");
  revalidatePath("/tickets");
  return { error: null };
}

export async function actualizarLavador(id: string, nombre: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("lavadores").update({ nombre }).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/lavadores");
  revalidatePath("/tickets");
  return { error: null };
}

export async function toggleActivoLavador(id: string, activo: boolean) {
  const supabase = await createClient();

  const { error } = await supabase.from("lavadores").update({ activo }).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/lavadores");
  revalidatePath("/tickets");
  return { error: null };
}

export async function eliminarLavador(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("lavadores").delete().eq("id", id);

  if (error) {
    // 23503 = violación de llave foránea: ya tiene tickets asociados, así
    // que borrarlo rompería ese historial. Toca desactivarlo en su lugar.
    if (error.code === "23503") {
      return {
        error: "No se puede eliminar: ya tiene autos lavados registrados. Desactívalo en vez de eliminarlo.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/lavadores");
  revalidatePath("/tickets");
  return { error: null };
}
