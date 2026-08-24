"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database, TicketEstado, PagoMetodo } from "@/types/database.types";

export async function abrirTurno(efectivoInicial: number) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sesión no válida." };

  const { error } = await supabase.from("turnos").insert({
    usuario_apertura_id: user.id,
    efectivo_inicial: efectivoInicial,
  });

  if (error) return { error: error.message };

  revalidatePath("/tickets");
  return { error: null };
}

export async function crearCliente(nombre: string, telefono: string | null) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clientes")
    .insert({ nombre, telefono })
    .select("id, nombre, telefono")
    .single();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function crearVehiculo(
  clienteId: string,
  placas: string | null,
  tipoVehiculo: string | null
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vehiculos")
    .insert({ cliente_id: clienteId, placas, tipo_vehiculo: tipoVehiculo })
    .select("id, placas, tipo_vehiculo")
    .single();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function buscarClientes(query: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clientes")
    .select("id, nombre, telefono")
    .ilike("nombre", `%${query}%`)
    .order("nombre")
    .limit(10);

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

// Vista previa para el cajero: cuántas lavadas lleva el cliente en el ciclo
// actual y si la próxima ya sería la 6ta gratis. Es solo informativo — el
// descuento real se calcula y valida siempre en el servidor (trigger
// tr_ticket_descuento_autorizado) al crear el ticket, nunca a partir de lo
// que mande este preview.
export async function progresoLealtadCliente(clienteId: string) {
  const supabase = await createClient();

  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("estado, lavada_gratis, hora_salida")
    .eq("cliente_id", clienteId)
    .eq("estado", "entregado");

  if (error) return { data: null, error: error.message };

  // El ciclo se cuenta sobre TODAS las lavadas entregadas (gratis o no): cada
  // ciclo completo son 6 lavadas exactas, así que el residuo módulo 6 ya
  // vuelve a 0 justo después de la lavada gratis.
  const lavadasEnCiclo = (tickets ?? []).length % 6;
  const ultimaLavada = (tickets ?? []).reduce<string | null>((max, t) => {
    if (!t.hora_salida) return max;
    return !max || t.hora_salida > max ? t.hora_salida : max;
  }, null);

  return {
    data: {
      lavadasEnCiclo,
      proximaGratis: lavadasEnCiclo === 5,
      ultimaLavada,
    },
    error: null,
  };
}

export async function usuariosActivos() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nombre, rol")
    .eq("activo", true)
    .order("nombre");

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function crearTicket(input: {
  clienteId: string | null;
  vehiculoId: string | null;
  servicioId: string;
  empleadoId: string;
  turnoId: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sesión no válida." };

  // El descuento de la 6ta lavada gratis lo calcula y valida por completo el
  // trigger tr_ticket_descuento_autorizado del lado del servidor (cuenta las
  // lavadas previas del cliente) — aquí no se manda ni se confía en ningún
  // monto de descuento.
  const { error } = await supabase.from("tickets").insert({
    cliente_id: input.clienteId,
    vehiculo_id: input.vehiculoId,
    servicio_id: input.servicioId,
    empleado_id: input.empleadoId,
    turno_id: input.turnoId,
    creado_por: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/tickets");
  return { error: null };
}

export async function actualizarEstadoTicket(ticketId: string, estado: TicketEstado) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tickets")
    .update({ estado, hora_salida: estado === "entregado" ? new Date().toISOString() : null })
    .eq("id", ticketId);

  if (error) return { error: error.message };

  revalidatePath("/tickets");
  return { error: null };
}

export async function registrarPago(input: {
  ticketId: string;
  turnoId: string;
  metodo: PagoMetodo;
  monto: number;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sesión no válida." };

  // Una lavada gratis (6ta lavada del ciclo de lealtad) no genera cobro: la
  // tabla pagos exige monto > 0, así que aquí no se inserta nada, solo se
  // deja avanzar el ticket (el estado "gratis" ya vive en tickets.lavada_gratis).
  if (input.monto === 0) {
    revalidatePath("/tickets");
    return { error: null };
  }

  const { error } = await supabase.from("pagos").insert({
    ticket_id: input.ticketId,
    turno_id: input.turnoId,
    metodo: input.metodo,
    monto: input.monto,
    usuario_id: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/tickets");
  return { error: null };
}

// Autorización de descuento: se verifica la contraseña del encargado/dueño en un
// cliente aislado (sin tocar las cookies de sesión del actor actual) para exigir
// presencia real, no solo el UUID de alguien con el rol correcto.
export async function solicitarDescuento(input: {
  ticketId: string;
  montoDescuento: number;
  autorizadorEmail: string;
  autorizadorPassword: string;
}) {
  const isolatedClient = createSupabaseJsClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: authData, error: authError } = await isolatedClient.auth.signInWithPassword({
    email: input.autorizadorEmail,
    password: input.autorizadorPassword,
  });

  if (authError || !authData.user) {
    return { error: "Credenciales de autorización inválidas." };
  }

  const { data: autorizador, error: autorizadorError } = await isolatedClient
    .from("usuarios")
    .select("rol, activo")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (autorizadorError || !autorizador || !autorizador.activo || !["encargado", "dueno"].includes(autorizador.rol)) {
    return { error: "Esa cuenta no tiene permisos para autorizar descuentos." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("tickets")
    .update({
      descuento_monto: input.montoDescuento,
      descuento_autorizado_por: authData.user.id,
    })
    .eq("id", input.ticketId);

  if (error) return { error: error.message };

  revalidatePath("/tickets");
  return { error: null };
}
