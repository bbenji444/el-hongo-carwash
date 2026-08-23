"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearCliente(input: { nombre: string; telefono: string | null }) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clientes")
    .insert({ nombre: input.nombre, telefono: input.telefono })
    .select("id")
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath("/clientes");
  return { data, error: null };
}

export async function crearVehiculo(input: {
  clienteId: string;
  placas: string | null;
  tipoVehiculo: string | null;
}) {
  const supabase = await createClient();

  const { error } = await supabase.from("vehiculos").insert({
    cliente_id: input.clienteId,
    placas: input.placas,
    tipo_vehiculo: input.tipoVehiculo,
  });

  if (error) return { error: error.message };

  revalidatePath(`/clientes/${input.clienteId}`);
  return { error: null };
}
