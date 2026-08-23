"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MembresiaTipo } from "@/types/database.types";

export async function crearMembresia(input: {
  nombre: string;
  tipo: MembresiaTipo;
  beneficioValor: number;
  precio: number;
  vigenciaDias: number;
}) {
  const supabase = await createClient();

  const { error } = await supabase.from("membresias").insert({
    nombre: input.nombre,
    tipo: input.tipo,
    beneficio_valor: input.beneficioValor,
    precio: input.precio,
    vigencia_dias: input.vigenciaDias,
  });

  if (error) return { error: error.message };

  revalidatePath("/membresias");
  return { error: null };
}

export async function actualizarMembresia(
  id: string,
  input: { nombre: string; tipo: MembresiaTipo; beneficioValor: number; precio: number; vigenciaDias: number }
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("membresias")
    .update({
      nombre: input.nombre,
      tipo: input.tipo,
      beneficio_valor: input.beneficioValor,
      precio: input.precio,
      vigencia_dias: input.vigenciaDias,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/membresias");
  return { error: null };
}

export async function toggleActivoMembresia(id: string, activo: boolean) {
  const supabase = await createClient();

  const { error } = await supabase.from("membresias").update({ activo }).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/membresias");
  return { error: null };
}
