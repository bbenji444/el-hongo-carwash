"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PRECIOS_MOTO_FIJOS, nombreTamano } from "@/lib/servicios";
import { registrarMovimiento } from "@/lib/historial";
import { inicioDeDiaMX } from "@/lib/fecha";
import {
  DIAS_ATRAS_MAX_TURNO,
  esTurnoDeOtroDia,
  horaMX,
  instanteMX,
  fechaTurno,
  momentoRegistro,
} from "@/lib/turnoDia";
import type { PagoMetodo, TamanoVehiculo } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

function resumenVehiculo(distintivo: string | null, placa: string | null) {
  return [distintivo, placa].filter(Boolean).join(" · ") || "sin distintivo/placa";
}

// Registro automático de cliente: si un ticket trae distintivo Y placa pero
// nadie escogió/creó un cliente a mano, se registra solo — usando el
// distintivo como nombre provisional (se puede corregir después desde
// Editar ticket sin perder el distintivo, que vive aparte en el ticket) —
// para que un registro rápido de "solo carro y placa" no se pierda y sí
// aparezca en Clientes / acumule su lealtad. Si la placa ya estaba
// vinculada a un cliente existente, se reutiliza ese cliente en vez de
// crear uno nuevo, para no fragmentar su historial.
async function resolverClienteAutomatico(
  supabase: SupabaseClient<Database>,
  distintivo: string,
  placa: string,
  tamanoVehiculo: TamanoVehiculo
): Promise<{ clienteId: string | null; vehiculoId: string | null }> {
  const placasNorm = placa.trim();

  const { data: vehiculoExistente } = await supabase
    .from("vehiculos")
    .select("id, cliente_id")
    .ilike("placas", placasNorm)
    .maybeSingle();

  if (vehiculoExistente) {
    return { clienteId: vehiculoExistente.cliente_id, vehiculoId: vehiculoExistente.id };
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .insert({ nombre: distintivo.trim(), telefono: null })
    .select("id")
    .single();

  if (!cliente) return { clienteId: null, vehiculoId: null };

  const { data: vehiculo } = await supabase
    .from("vehiculos")
    .insert({ cliente_id: cliente.id, placas: placasNorm, tipo_vehiculo: nombreTamano(tamanoVehiculo) })
    .select("id")
    .single();

  return { clienteId: cliente.id, vehiculoId: vehiculo?.id ?? null };
}

// "inicio" (opcional) es el día y la hora en que empezó el turno, para poder
// registrar el turno de un día anterior que no se capturó a tiempo (ver
// lib/turnoDia.ts). Sin él, el turno empieza ahora.
export async function abrirTurno(efectivoInicial: number, inicio?: { fecha: string; hora: string }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sesión no válida." };
  if (!Number.isFinite(efectivoInicial) || efectivoInicial < 0) return { error: "Ingresa un monto válido." };

  const ahora = new Date();
  let horaApertura = ahora;
  if (inicio) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio.fecha) || !/^\d{2}:\d{2}$/.test(inicio.hora)) {
      return { error: "Elige el día y la hora de inicio del turno." };
    }
    horaApertura = instanteMX(inicio.fecha, inicio.hora);
    if (Number.isNaN(horaApertura.getTime())) return { error: "La fecha del turno no es válida." };
    // Un minuto de tolerancia por si el reloj del celular va un poco adelantado.
    if (horaApertura.getTime() > ahora.getTime() + 60 * 1000) {
      return { error: "La hora de inicio no puede ser en el futuro." };
    }
    if (horaApertura.getTime() < inicioDeDiaMX(DIAS_ATRAS_MAX_TURNO).getTime()) {
      return { error: `Solo se puede abrir un turno de hasta ${DIAS_ATRAS_MAX_TURNO} días atrás.` };
    }
  }

  // Antes no se validaba esto: si la página tardaba en reflejar el turno ya
  // abierto (o alguien le daba varias veces a "Abrir turno" en pestañas o
  // recargas distintas), se creaban varios turnos con estado "abierto" a la
  // vez. Eso rompe la consulta .maybeSingle() de /tickets y /turnos (espera
  // como máximo una fila), así que la página se quedaba mostrando "no hay
  // turno abierto" aunque sí lo hubiera. Ahora se valida aquí, y además hay
  // un índice único parcial en la base de datos que lo garantiza siempre,
  // incluso ante dos solicitudes simultáneas.
  const { data: yaAbierto } = await supabase.from("turnos").select("id").eq("estado", "abierto").maybeSingle();
  if (yaAbierto) {
    revalidatePath("/", "layout");
    return { error: "Ya hay un turno abierto." };
  }

  const { data: nuevoTurno, error } = await supabase
    .from("turnos")
    .insert({
      usuario_apertura_id: user.id,
      efectivo_inicial: efectivoInicial,
      hora_apertura: horaApertura.toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      revalidatePath("/", "layout");
      return { error: "Ya hay un turno abierto." };
    }
    return { error: error.message };
  }

  await registrarMovimiento(
    supabase,
    user.id,
    "abrir",
    "turno",
    nuevoTurno?.id ?? null,
    esTurnoDeOtroDia(horaApertura.toISOString(), ahora)
      ? `Abrió el turno del ${fechaTurno(horaApertura.toISOString())} (desde las ${horaMX(horaApertura)}, capturado después) con $${efectivoInicial.toFixed(2)} de caja inicial`
      : `Abrió un turno con $${efectivoInicial.toFixed(2)} de caja inicial`
  );

  revalidatePath("/", "layout");
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

// Detalle completo de un cliente para el popup que se abre al hacer click en su
// nombre desde una tarjeta de ticket: historial de visitas, gasto acumulado y
// progreso de lealtad. Es una consulta de solo lectura, sin efectos secundarios.
export async function detalleCliente(clienteId: string) {
  const supabase = await createClient();

  const [{ data: cliente, error: clienteError }, { data: vehiculos }, { data: ticketsCliente }] =
    await Promise.all([
      supabase.from("clientes").select("id, nombre, telefono, creado_en").eq("id", clienteId).maybeSingle(),
      supabase.from("vehiculos").select("id, placas, tipo_vehiculo").eq("cliente_id", clienteId),
      supabase.from("tickets").select("id, estado, lavada_gratis, hora_salida").eq("cliente_id", clienteId),
    ]);

  if (clienteError) return { data: null, error: clienteError.message };
  if (!cliente) return { data: null, error: "Cliente no encontrado." };

  const entregados = (ticketsCliente ?? []).filter((t) => t.estado === "entregado");
  const ticketIds = entregados.map((t) => t.id);

  const { data: pagos } = ticketIds.length
    ? await supabase.from("pagos").select("monto").in("ticket_id", ticketIds)
    : { data: [] };

  const gastoTotal = (pagos ?? []).reduce((sum, p) => sum + p.monto, 0);
  const ultimaVisita = entregados.reduce<string | null>((max, t) => {
    if (!t.hora_salida) return max;
    return !max || t.hora_salida > max ? t.hora_salida : max;
  }, null);

  // Mismo cálculo de ciclo que progresoLealtadCliente, ver nota ahí.
  const lavadasEnCiclo = entregados.length % 6;

  return {
    data: {
      cliente,
      vehiculos: vehiculos ?? [],
      visitasTotales: entregados.length,
      gastoTotal,
      ultimaVisita,
      lavadasEnCiclo,
      proximaGratis: lavadasEnCiclo === 5,
    },
    error: null,
  };
}

// Comisión del lavador: 35% del precio de LISTA del paquete (según tamaño
// del vehículo) — sin extras, y aunque el ticket tenga descuento o sea la
// lavada gratis (ese costo lo absorbe el negocio, no el lavador).
const PORCENTAJE_COMISION_LAVADOR = 0.35;

type SupabaseServidor = Awaited<ReturnType<typeof createClient>>;

async function precioListaPaquete(
  supabase: SupabaseServidor,
  servicioId: string,
  tamano: TamanoVehiculo
): Promise<number> {
  if (tamano in PRECIOS_MOTO_FIJOS) return PRECIOS_MOTO_FIJOS[tamano]!;
  const { data } = await supabase
    .from("servicios_precios")
    .select("precio")
    .eq("servicio_id", servicioId)
    .eq("tamano_vehiculo", tamano)
    .maybeSingle();
  return data?.precio ?? 0;
}

// Total que paga el cliente: paquete + extras - descuento (la lavada
// gratis de lealtad deja el descuento igual al paquete). Se calcula
// siempre aquí en el servidor, nunca se confía en un monto del navegador.
async function totalTicket(supabase: SupabaseServidor, ticketId: string) {
  const { data: ticket } = await supabase
    .from("tickets")
    .select("servicio_id, tamano_vehiculo, descuento_monto, turno_id, lavada_gratis, hora_salida")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) return null;
  const [precio, { data: extras }] = await Promise.all([
    precioListaPaquete(supabase, ticket.servicio_id, ticket.tamano_vehiculo),
    supabase.from("ticket_extras").select("precio").eq("ticket_id", ticketId),
  ]);
  const sumaExtras = (extras ?? []).reduce((acc, e) => acc + e.precio, 0);
  return {
    ticket,
    precioPaquete: precio,
    total: Math.max(Math.round((precio + sumaExtras - ticket.descuento_monto) * 100) / 100, 0),
  };
}

// Guarda (o recalcula) la comisión de cada lavador asignado al ticket. Es
// la ÚNICA función que escribe ticket_lavadores.comision — la llaman el
// registro, la edición y la entrega de tickets pendientes de antes del
// cambio. Si (por tickets viejos) hubiera más de un lavador, el 35% se
// reparte entre ellos para que el negocio nunca pague más de 35% por carro.
async function guardarComisionTicket(supabase: SupabaseServidor, ticketId: string): Promise<string | null> {
  const datos = await totalTicket(supabase, ticketId);
  if (!datos) return "El ticket ya no existe.";
  const { data: asignaciones, error } = await supabase
    .from("ticket_lavadores")
    .select("lavador_id")
    .eq("ticket_id", ticketId);
  if (error) return error.message;
  const n = (asignaciones ?? []).length;
  if (n === 0) return null;
  const comision = Math.round(((datos.precioPaquete * PORCENTAJE_COMISION_LAVADOR) / n) * 100) / 100;
  const { error: updateError } = await supabase
    .from("ticket_lavadores")
    .update({ comision, base_comision: datos.precioPaquete })
    .eq("ticket_id", ticketId);
  return updateError ? updateError.message : null;
}

// Deja el pago del ticket igual al total actual: lo crea si falta, lo
// actualiza si cambió el monto o el método, o lo borra si el total quedó
// en $0 (lavada gratis). Un ticket solo tiene un pago (restricción única
// pagos_ticket_id_unico en la base de datos). Un pago nuevo lleva la fecha
// del registro del auto (momento, o su hora de entrega) — no la de hoy —
// para que un turno de un día anterior cuente sus ventas en ese día.
async function sincronizarPagoTicket(
  supabase: SupabaseServidor,
  ticketId: string,
  metodo: PagoMetodo | null,
  usuarioId: string,
  momento?: string
): Promise<string | null> {
  const datos = await totalTicket(supabase, ticketId);
  if (!datos) return "El ticket ya no existe.";
  const { data: pagoActual } = await supabase
    .from("pagos")
    .select("id, metodo")
    .eq("ticket_id", ticketId)
    .maybeSingle();

  if (datos.total <= 0) {
    if (pagoActual) {
      const { error } = await supabase.from("pagos").delete().eq("id", pagoActual.id);
      if (error) return error.message;
    }
    return null;
  }

  const metodoFinal = metodo ?? pagoActual?.metodo ?? null;
  if (!metodoFinal) return "Elige el método de pago.";

  if (pagoActual) {
    const { error } = await supabase
      .from("pagos")
      .update({ monto: datos.total, metodo: metodoFinal })
      .eq("id", pagoActual.id);
    return error ? error.message : null;
  }

  if (!datos.ticket.turno_id) return "El ticket no tiene turno.";
  const { error } = await supabase.from("pagos").insert({
    ticket_id: ticketId,
    turno_id: datos.ticket.turno_id,
    metodo: metodoFinal,
    monto: datos.total,
    monto_recibido: null,
    usuario_id: usuarioId,
    ...((momento ?? datos.ticket.hora_salida) ? { creado_en: momento ?? datos.ticket.hora_salida! } : {}),
  });
  // 23505 = ya existía un pago (doble clic / reintento) — no es un error.
  if (error && error.code !== "23505") return error.message;
  return null;
}

// Registro de un auto: en un solo paso queda creado, con su lavador y
// comisión, pagado (con el método elegido) y entregado. Ya no hay flujo de
// "en espera → en proceso → terminado → cobrar → entregar" ni tiempos.
// Si cualquier paso falla, se deshace todo lo que alcanzó a guardarse —
// para que nunca quede un ticket a medias (sin pago o sin comisión).
export async function crearTicket(input: {
  clienteId: string | null;
  vehiculoId: string | null;
  distintivo: string | null;
  placa: string | null;
  servicioId: string;
  tamanoVehiculo: TamanoVehiculo;
  empleadoId: string;
  lavadorId: string;
  metodo: PagoMetodo;
  turnoId: string;
  extraIds?: string[];
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sesión no válida." };
  if (!input.lavadorId) return { error: "Selecciona quién va a lavar el auto." };
  if (!input.metodo) return { error: "Elige el método de pago." };

  const { data: turno } = await supabase
    .from("turnos")
    .select("id, estado, hora_apertura")
    .eq("id", input.turnoId)
    .maybeSingle();
  if (!turno || turno.estado !== "abierto") {
    return { error: "El turno ya no está abierto. Recarga la página." };
  }

  // Fecha y hora con que queda el auto (y su pago): la de ahora si el turno
  // es de hoy, o dentro del día del turno si es de un día anterior.
  let ultimoRegistro: string | null = null;
  if (esTurnoDeOtroDia(turno.hora_apertura)) {
    const { data: ultimo } = await supabase
      .from("tickets")
      .select("hora_entrada")
      .eq("turno_id", turno.id)
      .order("hora_entrada", { ascending: false })
      .limit(1)
      .maybeSingle();
    ultimoRegistro = ultimo?.hora_entrada ?? null;
  }
  const momento = momentoRegistro(turno.hora_apertura, ultimoRegistro);

  let clienteId = input.clienteId;
  let vehiculoId = input.vehiculoId;
  if (!clienteId && input.distintivo?.trim() && input.placa?.trim()) {
    const resuelto = await resolverClienteAutomatico(supabase, input.distintivo, input.placa, input.tamanoVehiculo);
    clienteId = resuelto.clienteId;
    vehiculoId = resuelto.vehiculoId ?? vehiculoId;
  }

  // El descuento de la 6ta lavada gratis lo calcula y valida por completo el
  // trigger tr_ticket_descuento_autorizado del lado del servidor.
  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      cliente_id: clienteId,
      vehiculo_id: vehiculoId,
      distintivo: input.distintivo,
      placa: input.placa,
      servicio_id: input.servicioId,
      tamano_vehiculo: input.tamanoVehiculo,
      empleado_id: input.empleadoId,
      turno_id: input.turnoId,
      creado_por: user.id,
      hora_entrada: momento,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  async function deshacer(mensaje: string) {
    await supabase.from("pagos").delete().eq("ticket_id", ticket!.id);
    await supabase.from("tickets").delete().eq("id", ticket!.id);
    return { error: mensaje };
  }

  const { error: lavadorError } = await supabase
    .from("ticket_lavadores")
    .insert({ ticket_id: ticket.id, lavador_id: input.lavadorId });
  if (lavadorError) return deshacer(lavadorError.message);

  if (input.extraIds && input.extraIds.length > 0) {
    const errorExtras = await sincronizarExtrasTicket(supabase, ticket.id, input.extraIds);
    if (errorExtras) return deshacer(errorExtras);
  }

  const errorComision = await guardarComisionTicket(supabase, ticket.id);
  if (errorComision) return deshacer(errorComision);

  const errorPago = await sincronizarPagoTicket(supabase, ticket.id, input.metodo, user.id, momento);
  if (errorPago) return deshacer(errorPago);

  const { error: entregaError } = await supabase
    .from("tickets")
    .update({ estado: "entregado", hora_salida: momento, hora_cambio_estado: momento })
    .eq("id", ticket.id);
  if (entregaError) return deshacer(entregaError.message);

  await registrarMovimiento(supabase, user.id, "crear", "ticket", ticket.id, `Creó un ticket (${resumenVehiculo(input.distintivo, input.placa)})`);

  revalidatePath("/", "layout");
  return { error: null };
}

// Copia nombre y precio del extra tal como están en el catálogo al momento
// de agregarlo al ticket (ver nota de la migración): si después se edita el
// catálogo, lo ya agregado a tickets no cambia solo.
async function sincronizarExtrasTicket(
  supabase: SupabaseServidor,
  ticketId: string,
  extraIds: string[]
): Promise<string | null> {
  const { data: extras, error: extrasError } = await supabase
    .from("extras_catalogo")
    .select("id, nombre, precio")
    .in("id", extraIds);

  if (extrasError) return extrasError.message;

  const { error: insertError } = await supabase.from("ticket_extras").insert(
    (extras ?? []).map((e) => ({
      ticket_id: ticketId,
      extra_id: e.id,
      nombre: e.nombre,
      precio: e.precio,
    }))
  );

  if (insertError) return insertError.message;
  return null;
}

// Solo para tickets que quedaron pendientes de ANTES del cambio (registrados
// con el flujo viejo de estados): los cobra y entrega en un paso, y les
// guarda su comisión igual que a un registro nuevo.
export async function entregarTicketPendiente(ticketId: string, metodo: PagoMetodo | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión no válida." };

  const errorPago = await sincronizarPagoTicket(supabase, ticketId, metodo, user.id);
  if (errorPago) return { error: errorPago };

  const errorComision = await guardarComisionTicket(supabase, ticketId);
  if (errorComision) return { error: errorComision };

  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from("tickets")
    .update({ estado: "entregado", hora_salida: ahora, hora_cambio_estado: ahora })
    .eq("id", ticketId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}

// Verifica el permiso "puede_editar_tickets" (dueño siempre lo tiene; a los
// demás roles el dueño se los puede delegar por usuario desde /usuarios).
// Se revisa aquí además de en RLS porque UPDATE en tickets es permisivo a
// nivel de base de datos para cualquier rol autenticado; esta acción
// específica de editar contenido del ticket sí debe quedar reservada a
// quien tiene el permiso.
async function turnoSigueAbierto(supabase: SupabaseServidor, turnoId: string | null) {
  if (!turnoId) return false;
  const { data } = await supabase.from("turnos").select("estado").eq("id", turnoId).maybeSingle();
  return data?.estado === "abierto";
}

async function requierePermisoEditarTickets() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, error: "Sesión no válida." };

  const { data: actor } = await supabase
    .from("usuarios")
    .select("rol, puede_editar_tickets")
    .eq("id", user.id)
    .maybeSingle();

  const autorizado = Boolean(actor && (actor.rol === "dueno" || actor.puede_editar_tickets));

  if (!autorizado) {
    return { supabase, error: "No tienes permiso para editar o eliminar tickets." };
  }

  return { supabase, error: null, esDueno: actor?.rol === "dueno", actorId: user.id };
}

export async function actualizarTicket(
  ticketId: string,
  input: {
    servicioId: string;
    tamanoVehiculo: TamanoVehiculo;
    lavadorId: string;
    metodo: PagoMetodo | null;
    distintivo: string | null;
    placa: string | null;
    vehiculoId: string | null;
    clienteId: string | null;
    extraIds: string[];
  }
) {
  const { supabase, error: permisoError, esDueno, actorId } = await requierePermisoEditarTickets();
  if (permisoError) return { error: permisoError };

  // Se trae el estado ANTES de la edición junto con todo lo que el histórico
  // va a necesitar para armar un "qué cambió" (paquete, tamaño, lavadores,
  // extras, vehículo) — una sola consulta en vez de pedir el estado aparte
  // como antes.
  const [{ data: ticketAntes }, { data: lavadoresAntesRaw }, { data: extrasAntesRaw }] = await Promise.all([
    supabase
      .from("tickets")
      .select("estado, servicio_id, tamano_vehiculo, distintivo, placa, turno_id")
      .eq("id", ticketId)
      .maybeSingle(),
    supabase.from("ticket_lavadores").select("lavador_id, comision").eq("ticket_id", ticketId),
    supabase.from("ticket_extras").select("nombre").eq("ticket_id", ticketId),
  ]);
  const lavadoresAntesIds = (lavadoresAntesRaw ?? []).map((l) => l.lavador_id);
  // Tickets de antes del cambio a comisión no tienen comisión guardada — al
  // editarlos no se les asigna una retroactiva (la comisión cuenta solo a
  // partir del cambio).
  const teniaComision = (lavadoresAntesRaw ?? []).some((l) => l.comision !== null);
  // Si el lavador elegido ya estaba asignado, no se toca la asignación: así
  // un ticket viejo lavado en pareja conserva a los dos (y sus estadísticas)
  // aunque la pantalla de edición ahora solo deje elegir uno.
  const lavadorSinCambio = lavadoresAntesIds.includes(input.lavadorId);

  if (!ticketAntes) return { error: "El ticket ya no existe." };

  if (!input.lavadorId) return { error: "Selecciona quién lavó el auto." };

  // Ahora todo ticket queda entregado desde que se registra, así que el
  // corte ya no es "entregado o no" sino si su caja sigue abierta: mientras
  // el turno esté abierto, quien tenga el permiso puede corregir un error de
  // captura; una vez cerrado el turno (caja ya contada), solo el dueño.
  const turnoAbierto = await turnoSigueAbierto(supabase, ticketAntes.turno_id);
  if (!esDueno && !turnoAbierto) {
    return { error: "Solo el dueño puede editar un ticket de un turno ya cerrado." };
  }

  let clienteId = input.clienteId;
  let vehiculoId = input.vehiculoId;
  if (!clienteId && input.distintivo?.trim() && input.placa?.trim()) {
    const resuelto = await resolverClienteAutomatico(supabase, input.distintivo, input.placa, input.tamanoVehiculo);
    clienteId = resuelto.clienteId;
    vehiculoId = resuelto.vehiculoId ?? vehiculoId;
  }

  const { error } = await supabase
    .from("tickets")
    .update({
      servicio_id: input.servicioId,
      tamano_vehiculo: input.tamanoVehiculo,
      distintivo: input.distintivo,
      placa: input.placa,
      vehiculo_id: vehiculoId,
      cliente_id: clienteId,
    })
    .eq("id", ticketId);

  if (error) return { error: error.message };

  // Un solo lavador por ticket: si se eligió otro distinto, se reemplaza el
  // (o los, en tickets viejos) que hubiera por el elegido.
  if (!lavadorSinCambio) {
    const { error: borrarLavadoresError } = await supabase.from("ticket_lavadores").delete().eq("ticket_id", ticketId);
    if (borrarLavadoresError) return { error: borrarLavadoresError.message };
    const { error: lavadorError } = await supabase
      .from("ticket_lavadores")
      .insert({ ticket_id: ticketId, lavador_id: input.lavadorId });
    if (lavadorError) return { error: lavadorError.message };
  }

  // Se reemplazan todos los extras del ticket por la selección actual (en
  // vez de calcular un diff) — es una lista corta y así siempre queda en
  // el precio vigente del catálogo al momento de guardar la edición.
  const { error: borrarError } = await supabase.from("ticket_extras").delete().eq("ticket_id", ticketId);
  if (borrarError) return { error: borrarError.message };

  let extrasDespuesRaw: { nombre: string }[] = [];
  if (input.extraIds.length > 0) {
    const { data: extrasCatalogo, error: errorExtras } = await supabase
      .from("extras_catalogo")
      .select("id, nombre, precio")
      .in("id", input.extraIds);
    if (errorExtras) return { error: errorExtras.message };

    const { error: insertExtrasError } = await supabase.from("ticket_extras").insert(
      (extrasCatalogo ?? []).map((e) => ({ ticket_id: ticketId, extra_id: e.id, nombre: e.nombre, precio: e.precio }))
    );
    if (insertExtrasError) return { error: insertExtrasError.message };
    extrasDespuesRaw = extrasCatalogo ?? [];
  }

  // Paquete/tamaño/extras pudieron cambiar: la comisión y el pago se
  // recalculan para que sigan cuadrando con el ticket — pero solo donde no
  // se altera historia ya cerrada: la comisión, solo si el ticket ya la
  // tenía (sistema nuevo); el pago, solo mientras su turno siga abierto
  // (un turno cerrado ya se contó en caja, y su corte no se recalcula).
  if (teniaComision) {
    const errorComision = await guardarComisionTicket(supabase, ticketId);
    if (errorComision) return { error: errorComision };
  }
  if (ticketAntes.estado === "entregado" && turnoAbierto) {
    const errorPago = await sincronizarPagoTicket(supabase, ticketId, input.metodo, actorId!);
    if (errorPago) return { error: errorPago };
  }

  // Arma el "qué cambió" del histórico: compara cada campo antes/después y
  // solo menciona los que de verdad cambiaron — para que un editor vea de
  // un vistazo "paquete: Plus → Premium" o "lavador: Tripas → Manuel" en vez
  // de solo "editó un ticket" a secas.
  const idsLavadoresNecesarios = [...new Set([...(lavadoresAntesRaw ?? []).map((l) => l.lavador_id), input.lavadorId])];
  const idsServiciosNecesarios = [...new Set([ticketAntes.servicio_id, input.servicioId])];
  const [{ data: lavadoresNombresRaw }, { data: serviciosNombresRaw }] = await Promise.all([
    idsLavadoresNecesarios.length
      ? supabase.from("lavadores").select("id, nombre").in("id", idsLavadoresNecesarios)
      : Promise.resolve({ data: [] }),
    supabase.from("servicios_catalogo").select("id, nombre").in("id", idsServiciosNecesarios),
  ]);
  const nombrePorLavador = new Map((lavadoresNombresRaw ?? []).map((l) => [l.id, l.nombre]));
  const nombrePorServicio = new Map((serviciosNombresRaw ?? []).map((s) => [s.id, s.nombre]));

  const cambios: string[] = [];

  if (ticketAntes.servicio_id !== input.servicioId) {
    cambios.push(
      `paquete: ${nombrePorServicio.get(ticketAntes.servicio_id) ?? "—"} → ${nombrePorServicio.get(input.servicioId) ?? "—"}`
    );
  }
  if (ticketAntes.tamano_vehiculo !== input.tamanoVehiculo) {
    cambios.push(`tamaño: ${nombreTamano(ticketAntes.tamano_vehiculo)} → ${nombreTamano(input.tamanoVehiculo)}`);
  }
  const vehAntes = resumenVehiculo(ticketAntes.distintivo, ticketAntes.placa);
  const vehDespues = resumenVehiculo(input.distintivo, input.placa);
  if (vehAntes !== vehDespues) {
    cambios.push(`vehículo: ${vehAntes} → ${vehDespues}`);
  }
  const lavadoresAntesTexto = (lavadoresAntesRaw ?? []).map((l) => nombrePorLavador.get(l.lavador_id) ?? "—").sort().join(", ") || "nadie";
  const lavadoresDespuesTexto = lavadorSinCambio ? lavadoresAntesTexto : (nombrePorLavador.get(input.lavadorId) ?? "—");
  if (lavadoresAntesTexto !== lavadoresDespuesTexto) {
    cambios.push(`lavador: ${lavadoresAntesTexto} → ${lavadoresDespuesTexto}`);
  }
  const extrasAntesTexto = (extrasAntesRaw ?? []).map((e) => e.nombre).sort().join(", ") || "ninguno";
  const extrasDespuesTexto = extrasDespuesRaw.map((e) => e.nombre).sort().join(", ") || "ninguno";
  if (extrasAntesTexto !== extrasDespuesTexto) {
    cambios.push(`extras: ${extrasAntesTexto} → ${extrasDespuesTexto}`);
  }

  await registrarMovimiento(
    supabase,
    actorId!,
    "editar",
    "ticket",
    ticketId,
    `Editó un ticket (${resumenVehiculo(input.distintivo, input.placa)})${cambios.length ? ` — ${cambios.join(", ")}` : ""}`
  );

  revalidatePath("/", "layout");
  return { error: null };
}

export async function eliminarTicket(ticketId: string) {
  const { supabase, error: permisoError, esDueno, actorId } = await requierePermisoEditarTickets();
  if (permisoError) return { error: permisoError };

  const { data: ticket } = await supabase
    .from("tickets")
    .select("estado, distintivo, placa, turno_id")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) return { error: "El ticket ya no existe." };
  // Un ticket entregado puede tener pagos que ya se sumaron a la caja
  // cerrada del turno — solo el dueño puede eliminarlo (p. ej. para
  // corregir una prueba capturada por error), no un encargado/cajero al
  // que solo se le delegó el permiso de editar/eliminar tickets normales.
  if (!esDueno && !(await turnoSigueAbierto(supabase, ticket.turno_id))) {
    return { error: "Solo el dueño puede eliminar un ticket de un turno ya cerrado (afectaría la caja ya contada)." };
  }

  // Un ticket puede ya tener pagos registrados (se puede cobrar antes de
  // entregar) — hay que borrarlos primero, si no la llave foránea bloquea
  // el borrado del ticket.
  const { error: pagosError } = await supabase.from("pagos").delete().eq("ticket_id", ticketId);
  if (pagosError) return { error: pagosError.message };

  const { error } = await supabase.from("tickets").delete().eq("id", ticketId);

  if (error) return { error: error.message };

  await registrarMovimiento(
    supabase,
    actorId!,
    "eliminar",
    "ticket",
    ticketId,
    `Eliminó un ticket (${resumenVehiculo(ticket.distintivo, ticket.placa)})`
  );

  revalidatePath("/", "layout");
  return { error: null };
}
