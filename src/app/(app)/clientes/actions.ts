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

// Autocompletado al capturar placa o distintivo en Nuevo ticket: busca
// coincidencias parciales (como la búsqueda de cliente por nombre) mientras
// la persona sigue escribiendo, para poder elegir el cliente correcto de
// una lista en vez de tener que terminar de escribir. Una sola consulta
// contra la vista vehiculos_con_cliente (vehículo + cliente ya juntos, ver
// migración 20260913010000) con índice de trigramas en ambas columnas para
// que ILIKE con comodín al inicio sea rápido incluso con muchos registros.
async function buscarVehiculosPorCampo(campo: "placas" | "tipo_vehiculo", query: string) {
  const supabase = await createClient();
  const queryNorm = query.trim();
  if (!queryNorm) return { data: [], error: null };

  const { data, error } = await supabase
    .from("vehiculos_con_cliente")
    .select("placas, tipo_vehiculo, cliente_id, cliente_nombre, cliente_telefono")
    .ilike(campo, `%${queryNorm}%`)
    .limit(8);

  if (error) return { data: [], error: error.message };

  const resultados = (data ?? []).map((v) => ({
    cliente: { id: v.cliente_id, nombre: v.cliente_nombre, telefono: v.cliente_telefono },
    placas: v.placas,
    tipoVehiculo: v.tipo_vehiculo,
  }));

  return { data: resultados, error: null };
}

export async function buscarVehiculosPorPlaca(query: string) {
  return buscarVehiculosPorCampo("placas", query);
}

export async function buscarVehiculosPorTipo(query: string) {
  return buscarVehiculosPorCampo("tipo_vehiculo", query);
}
