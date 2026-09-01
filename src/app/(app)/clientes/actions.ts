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

// Autocompletado al capturar la placa en Nuevo ticket: busca coincidencias
// parciales (como la búsqueda de cliente por nombre) mientras la persona
// sigue escribiendo, para poder elegir el cliente correcto de una lista en
// vez de tener que terminar de escribir la placa completa.
export async function buscarVehiculosPorPlaca(query: string) {
  const supabase = await createClient();
  const queryNorm = query.trim();
  if (!queryNorm) return { data: [], error: null };

  // Sin relaciones embebidas (mismo motivo que en el resto de la app: el
  // tipo Database se escribió a mano con Relationships: [] para evitar
  // ambigüedad de FKs) — se resuelve con dos consultas por separado.
  const { data: vehiculos, error: vehiculosError } = await supabase
    .from("vehiculos")
    .select("id, cliente_id, placas, tipo_vehiculo")
    .ilike("placas", `%${queryNorm}%`)
    .limit(8);

  if (vehiculosError) return { data: [], error: vehiculosError.message };
  if (!vehiculos || vehiculos.length === 0) return { data: [], error: null };

  const clienteIds = [...new Set(vehiculos.map((v) => v.cliente_id))];
  const { data: clientes, error: clientesError } = await supabase
    .from("clientes")
    .select("id, nombre, telefono")
    .in("id", clienteIds);

  if (clientesError) return { data: [], error: clientesError.message };

  const clientePorId = new Map((clientes ?? []).map((c) => [c.id, c]));

  const resultados = vehiculos
    .map((v) => {
      const cliente = clientePorId.get(v.cliente_id);
      if (!cliente) return null;
      return { cliente, placas: v.placas, tipoVehiculo: v.tipo_vehiculo };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return { data: resultados, error: null };
}
