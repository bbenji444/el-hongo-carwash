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

// Usado al capturar la placa de un cliente ya registrado directamente desde
// el ticket (Nuevo/Editar ticket): reutiliza el vehículo si ese cliente ya
// tiene una placa igual registrada, en vez de crear un duplicado cada vez
// que vuelve a visitar.
export async function obtenerOCrearVehiculo(input: {
  clienteId: string;
  placas: string;
  tipoVehiculo: string | null;
}) {
  const supabase = await createClient();
  const placasNorm = input.placas.trim();

  const { data: existente } = await supabase
    .from("vehiculos")
    .select("id")
    .eq("cliente_id", input.clienteId)
    .ilike("placas", placasNorm)
    .maybeSingle();

  if (existente) return { data: existente, error: null };

  const { data, error } = await supabase
    .from("vehiculos")
    .insert({ cliente_id: input.clienteId, placas: placasNorm, tipo_vehiculo: input.tipoVehiculo })
    .select("id")
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath(`/clientes/${input.clienteId}`);
  return { data, error: null };
}
