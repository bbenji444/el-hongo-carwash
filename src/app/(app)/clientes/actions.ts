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

// fecha_fin y saldo_paquete se calculan aquí a partir del catálogo (nunca los manda el
// cliente): vigencia_dias y beneficio_valor los define el dueño en /membresias.
export async function afiliarMembresia(input: { clienteId: string; membresiaId: string }) {
  const supabase = await createClient();

  const { data: membresia, error: membresiaError } = await supabase
    .from("membresias")
    .select("tipo, beneficio_valor, vigencia_dias")
    .eq("id", input.membresiaId)
    .maybeSingle();

  if (membresiaError || !membresia) return { error: "Membresía no encontrada." };

  const fechaInicio = new Date();
  const fechaFin = new Date(fechaInicio);
  fechaFin.setDate(fechaFin.getDate() + membresia.vigencia_dias);

  const { error } = await supabase.from("membresias_clientes").insert({
    cliente_id: input.clienteId,
    membresia_id: input.membresiaId,
    fecha_fin: fechaFin.toISOString().slice(0, 10),
    saldo_paquete: membresia.tipo === "paquete_prepagado" ? membresia.beneficio_valor : 0,
  });

  if (error) return { error: error.message };

  revalidatePath(`/clientes/${input.clienteId}`);
  return { error: null };
}

export async function desactivarMembresiaCliente(vinculoId: string, clienteId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("membresias_clientes")
    .update({ activa: false })
    .eq("id", vinculoId);

  if (error) return { error: error.message };

  revalidatePath(`/clientes/${clienteId}`);
  return { error: null };
}
