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

export async function membresiaActivaDeCliente(clienteId: string) {
  const supabase = await createClient();
  const hoy = new Date().toISOString().slice(0, 10);

  const { data: vinculo, error } = await supabase
    .from("membresias_clientes")
    .select("id, membresia_id, saldo_paquete, fecha_fin")
    .eq("cliente_id", clienteId)
    .eq("activa", true)
    .gte("fecha_fin", hoy)
    .maybeSingle();

  if (error || !vinculo) return { data: null, error: error?.message ?? null };

  const { data: membresia } = await supabase
    .from("membresias")
    .select("nombre, tipo, beneficio_valor")
    .eq("id", vinculo.membresia_id)
    .maybeSingle();

  return {
    data: {
      membresiaClienteId: vinculo.id,
      saldoPaquete: vinculo.saldo_paquete,
      nombre: membresia?.nombre ?? "Membresía",
      tipo: membresia?.tipo ?? null,
      beneficioValor: membresia?.beneficio_valor ?? 0,
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
  membresiaClienteId: string | null;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sesión no válida." };

  // El descuento de una membresía descuento_fijo se aplica aquí, derivado siempre
  // del catálogo (nunca de lo que mande el cliente) — el trigger tr_ticket_descuento_autorizado
  // vuelve a validar server-side que coincide exactamente con el beneficio_valor del plan.
  let descuentoMonto = 0;
  if (input.membresiaClienteId) {
    const { data: vinculo } = await supabase
      .from("membresias_clientes")
      .select("membresia_id")
      .eq("id", input.membresiaClienteId)
      .maybeSingle();

    if (vinculo) {
      const { data: membresia } = await supabase
        .from("membresias")
        .select("tipo, beneficio_valor")
        .eq("id", vinculo.membresia_id)
        .maybeSingle();

      if (membresia?.tipo === "descuento_fijo") {
        descuentoMonto = membresia.beneficio_valor;
      }
    }
  }

  const { error } = await supabase.from("tickets").insert({
    cliente_id: input.clienteId,
    vehiculo_id: input.vehiculoId,
    servicio_id: input.servicioId,
    empleado_id: input.empleadoId,
    turno_id: input.turnoId,
    membresia_cliente_id: input.membresiaClienteId,
    descuento_monto: descuentoMonto,
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
  membresiaUsada: boolean;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sesión no válida." };

  const { error } = await supabase.from("pagos").insert({
    ticket_id: input.ticketId,
    turno_id: input.turnoId,
    metodo: input.metodo,
    monto: input.monto,
    membresia_usada: input.membresiaUsada,
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
