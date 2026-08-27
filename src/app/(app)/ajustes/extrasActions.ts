"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ExtraInput = { nombre: string; precio: number; orden: number };

export async function crearExtra(input: ExtraInput) {
  const supabase = await createClient();

  const { error } = await supabase.from("extras_catalogo").insert({
    nombre: input.nombre,
    precio: input.precio,
    orden: input.orden,
  });

  if (error) return { error: error.message };

  revalidatePath("/ajustes");
  revalidatePath("/tickets");
  return { error: null };
}

export async function actualizarExtra(id: string, input: ExtraInput) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("extras_catalogo")
    .update({ nombre: input.nombre, precio: input.precio, orden: input.orden })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/ajustes");
  revalidatePath("/tickets");
  return { error: null };
}

export async function toggleActivoExtra(id: string, activo: boolean) {
  const supabase = await createClient();

  const { error } = await supabase.from("extras_catalogo").update({ activo }).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/ajustes");
  revalidatePath("/tickets");
  return { error: null };
}

export async function eliminarExtra(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("extras_catalogo").delete().eq("id", id);

  if (error) {
    // 23503 = violación de llave foránea: hay tickets que ya usan este
    // extra, así que borrarlo rompería ese historial. En ese caso hay que
    // desactivarlo en vez de eliminarlo.
    if (error.code === "23503") {
      return {
        error: "No se puede eliminar: ya tiene tickets registrados. Desactívalo en vez de eliminarlo.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/ajustes");
  revalidatePath("/tickets");
  return { error: null };
}
