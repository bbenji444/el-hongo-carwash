"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearServicio(input: {
  nombre: string;
  precio: number;
  tiempoEstimadoMin: number | null;
}) {
  const supabase = await createClient();

  const { error } = await supabase.from("servicios_catalogo").insert({
    nombre: input.nombre,
    precio: input.precio,
    tiempo_estimado_min: input.tiempoEstimadoMin,
  });

  if (error) return { error: error.message };

  revalidatePath("/servicios");
  return { error: null };
}

export async function actualizarServicio(
  id: string,
  input: { nombre: string; precio: number; tiempoEstimadoMin: number | null }
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("servicios_catalogo")
    .update({
      nombre: input.nombre,
      precio: input.precio,
      tiempo_estimado_min: input.tiempoEstimadoMin,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/servicios");
  return { error: null };
}

export async function toggleActivoServicio(id: string, activo: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("servicios_catalogo")
    .update({ activo })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/servicios");
  return { error: null };
}
