"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearInsumo(input: {
  nombre: string;
  stockActual: number;
  stockMinimo: number;
  costoUnitario: number;
}) {
  const supabase = await createClient();

  const { error } = await supabase.from("inventario").insert({
    nombre_insumo: input.nombre,
    stock_actual: input.stockActual,
    stock_minimo: input.stockMinimo,
    costo_unitario: input.costoUnitario,
  });

  if (error) return { error: error.message };

  revalidatePath("/inventario");
  return { error: null };
}

export async function actualizarInsumo(
  id: string,
  input: { nombre: string; stockActual: number; stockMinimo: number; costoUnitario: number }
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("inventario")
    .update({
      nombre_insumo: input.nombre,
      stock_actual: input.stockActual,
      stock_minimo: input.stockMinimo,
      costo_unitario: input.costoUnitario,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/inventario");
  return { error: null };
}

export async function eliminarInsumo(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("inventario").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/inventario");
  return { error: null };
}

export async function crearReceta(input: { servicioId: string; insumoId: string; cantidadEstimada: number }) {
  const supabase = await createClient();

  const { error } = await supabase.from("consumo_inventario").insert({
    servicio_id: input.servicioId,
    insumo_id: input.insumoId,
    cantidad_estimada: input.cantidadEstimada,
  });

  if (error) return { error: error.message };

  revalidatePath("/inventario");
  return { error: null };
}

export async function eliminarReceta(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("consumo_inventario").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/inventario");
  return { error: null };
}
