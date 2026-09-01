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

// Autocompletado al capturar la placa en Nuevo ticket: si esa placa ya está
// registrada a nombre de un cliente, se regresa para llenar el cliente y el
// distintivo solos, sin tener que buscarlo por nombre. Coincidencia exacta
// (sin importar mayúsculas/espacios) para no auto-seleccionar de más
// mientras la persona sigue escribiendo.
export async function buscarClientePorPlaca(placa: string) {
  const supabase = await createClient();
  const placaNorm = placa.trim();
  if (!placaNorm) return { data: null, error: null };

  // Sin relaciones embebidas (mismo motivo que en el resto de la app: el
  // tipo Database se escribió a mano con Relationships: [] para evitar
  // ambigüedad de FKs) — se resuelve con dos consultas por separado.
  const { data: vehiculo, error: vehiculoError } = await supabase
    .from("vehiculos")
    .select("cliente_id, tipo_vehiculo")
    .ilike("placas", placaNorm)
    .limit(1)
    .maybeSingle();

  if (vehiculoError) return { data: null, error: vehiculoError.message };
  if (!vehiculo) return { data: null, error: null };

  const { data: cliente, error: clienteError } = await supabase
    .from("clientes")
    .select("id, nombre, telefono")
    .eq("id", vehiculo.cliente_id)
    .maybeSingle();

  if (clienteError) return { data: null, error: clienteError.message };
  if (!cliente) return { data: null, error: null };

  return {
    data: { cliente, tipoVehiculo: vehiculo.tipo_vehiculo },
    error: null,
  };
}
