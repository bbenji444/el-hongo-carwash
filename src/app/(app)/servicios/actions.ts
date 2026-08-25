"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TamanoVehiculo } from "@/types/database.types";

type PrecioInput = { tamanoVehiculo: TamanoVehiculo; precio: number };

type ServicioInput = {
  nombre: string;
  descripcion: string | null;
  caracteristicas: string[];
  orden: number;
  destacado: boolean;
  tiempoEstimadoMin: number | null;
  precios: PrecioInput[];
};

export async function crearServicio(input: ServicioInput) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("servicios_catalogo")
    .insert({
      nombre: input.nombre,
      descripcion: input.descripcion,
      caracteristicas: input.caracteristicas,
      orden: input.orden,
      destacado: input.destacado,
      tiempo_estimado_min: input.tiempoEstimadoMin,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const { error: preciosError } = await supabase.from("servicios_precios").insert(
    input.precios.map((p) => ({
      servicio_id: data.id,
      tamano_vehiculo: p.tamanoVehiculo,
      precio: p.precio,
    }))
  );

  if (preciosError) return { error: preciosError.message };

  revalidatePath("/servicios");
  return { error: null };
}

export async function actualizarServicio(id: string, input: ServicioInput) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("servicios_catalogo")
    .update({
      nombre: input.nombre,
      descripcion: input.descripcion,
      caracteristicas: input.caracteristicas,
      orden: input.orden,
      destacado: input.destacado,
      tiempo_estimado_min: input.tiempoEstimadoMin,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  const { error: preciosError } = await supabase.from("servicios_precios").upsert(
    input.precios.map((p) => ({
      servicio_id: id,
      tamano_vehiculo: p.tamanoVehiculo,
      precio: p.precio,
    })),
    { onConflict: "servicio_id,tamano_vehiculo" }
  );

  if (preciosError) return { error: preciosError.message };

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

export async function eliminarServicio(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("servicios_catalogo").delete().eq("id", id);

  if (error) {
    // 23503 = violación de llave foránea: hay tickets que ya usan este
    // paquete, así que borrarlo rompería ese historial. En ese caso hay que
    // desactivarlo en vez de eliminarlo.
    if (error.code === "23503") {
      return {
        error: "No se puede eliminar: ya tiene tickets registrados. Desactívalo en vez de eliminarlo.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/servicios");
  return { error: null };
}
