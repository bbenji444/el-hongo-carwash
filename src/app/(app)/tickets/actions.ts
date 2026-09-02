"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PRECIOS_MOTO_FIJOS } from "@/lib/servicios";
import type { TicketEstado, PagoMetodo, TamanoVehiculo } from "@/types/database.types";

export async function abrirTurno(efectivoInicial: number) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sesión no válida." };

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

  const { error } = await supabase.from("turnos").insert({
    usuario_apertura_id: user.id,
    efectivo_inicial: efectivoInicial,
  });

  if (error) {
    if (error.code === "23505") {
      revalidatePath("/", "layout");
      return { error: "Ya hay un turno abierto." };
    }
    return { error: error.message };
  }

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

export async function crearTicket(input: {
  clienteId: string | null;
  vehiculoId: string | null;
  distintivo: string | null;
  placa: string | null;
  servicioId: string;
  tamanoVehiculo: TamanoVehiculo;
  empleadoId: string;
  lavadorId: string | null;
  turnoId: string;
  extraIds?: string[];
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
  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      cliente_id: input.clienteId,
      vehiculo_id: input.vehiculoId,
      distintivo: input.distintivo,
      placa: input.placa,
      servicio_id: input.servicioId,
      tamano_vehiculo: input.tamanoVehiculo,
      empleado_id: input.empleadoId,
      lavador_id: input.lavadorId,
      turno_id: input.turnoId,
      creado_por: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (input.extraIds && input.extraIds.length > 0) {
    const errorExtras = await sincronizarExtrasTicket(supabase, ticket.id, input.extraIds);
    if (errorExtras) return { error: errorExtras };
  }

  revalidatePath("/", "layout");
  return { error: null };
}

// Copia nombre y precio del extra tal como están en el catálogo al momento
// de agregarlo al ticket (ver nota de la migración): si después se edita el
// catálogo, lo ya agregado a tickets no cambia solo.
async function sincronizarExtrasTicket(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

export async function actualizarEstadoTicket(ticketId: string, estado: TicketEstado) {
  const supabase = await createClient();

  // hora_cambio_estado se manda explícito aquí (no se deja solo al trigger de
  // DB) para que el cronómetro de "tiempo en esta etapa" reinicie siempre que
  // esta acción cambia el estado, sin depender de que la migración del
  // trigger haya quedado aplicada correctamente en el entorno del usuario.
  //
  // hora_inicio_lavado y hora_fin_lavado son distintas de hora_cambio_estado:
  // esa se sobreescribe en cada cambio de estado, así que para cuando el
  // ticket llega a "entregado" ya se perdió el instante exacto en que
  // empezó a lavarse. Estas dos solo se llenan una vez, al pasar por
  // "en_proceso" y "terminado" respectivamente, para poder calcular después
  // cuánto tardó la lavada en sí (sin contar la espera en cola).
  const ahora = new Date().toISOString();
  const update: {
    estado: TicketEstado;
    hora_cambio_estado: string;
    hora_salida: string | null;
    hora_inicio_lavado?: string;
    hora_fin_lavado?: string;
  } = {
    estado,
    hora_cambio_estado: ahora,
    hora_salida: estado === "entregado" ? ahora : null,
  };
  if (estado === "en_proceso") update.hora_inicio_lavado = ahora;
  if (estado === "terminado") update.hora_fin_lavado = ahora;

  const { error } = await supabase.from("tickets").update(update).eq("id", ticketId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}

export async function registrarPago(input: {
  ticketId: string;
  turnoId: string;
  metodo: PagoMetodo;
  monto: number;
  montoRecibido?: number | null;
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
    revalidatePath("/", "layout");
    return { error: null };
  }

  const { error } = await supabase.from("pagos").insert({
    ticket_id: input.ticketId,
    turno_id: input.turnoId,
    metodo: input.metodo,
    monto: input.monto,
    monto_recibido: input.montoRecibido ?? null,
    usuario_id: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}

// Precio especial: se captura el precio final (no el monto de descuento, la
// resta la hace el servidor) y solo el nombre de quien lo autoriza — a
// petición del dueño, ya no se pide correo/contraseña real de un
// encargado/dueño (ver nota en la migración 20260909010000).
export async function solicitarDescuento(input: {
  ticketId: string;
  precioFinal: number;
  autorizadorNombre: string;
}) {
  if (!input.autorizadorNombre.trim()) {
    return { error: "Escribe el nombre de quien autoriza este precio." };
  }

  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select("servicio_id, tamano_vehiculo")
    .eq("id", input.ticketId)
    .maybeSingle();

  if (!ticket) return { error: "El ticket ya no existe." };

  const [{ data: precio }, { data: extras }] = await Promise.all([
    supabase
      .from("servicios_precios")
      .select("precio")
      .eq("servicio_id", ticket.servicio_id)
      .eq("tamano_vehiculo", ticket.tamano_vehiculo)
      .maybeSingle(),
    supabase.from("ticket_extras").select("precio").eq("ticket_id", input.ticketId),
  ]);

  const precioTamano = PRECIOS_MOTO_FIJOS[ticket.tamano_vehiculo] ?? precio?.precio ?? 0;
  const precioBase = precioTamano + (extras ?? []).reduce((suma, e) => suma + e.precio, 0);
  const descuentoMonto = Math.max(precioBase - input.precioFinal, 0);

  const { error } = await supabase
    .from("tickets")
    .update({
      descuento_monto: descuentoMonto,
      descuento_autorizado_por: input.autorizadorNombre.trim(),
    })
    .eq("id", input.ticketId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}

// Verifica el permiso "puede_editar_tickets" (dueño siempre lo tiene; a los
// demás roles el dueño se los puede delegar por usuario desde /usuarios).
// Se revisa aquí además de en RLS porque UPDATE en tickets es permisivo a
// nivel de base de datos para cualquier rol autenticado (lo usan los
// avances normales de estado); esta acción específica de editar contenido
// del ticket sí debe quedar reservada a quien tiene el permiso.
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

  return { supabase, error: null, esDueno: actor?.rol === "dueno" };
}

export async function actualizarTicket(
  ticketId: string,
  input: {
    servicioId: string;
    tamanoVehiculo: TamanoVehiculo;
    lavadorId: string | null;
    distintivo: string | null;
    placa: string | null;
    vehiculoId: string | null;
    extraIds: string[];
  }
) {
  const { supabase, error: permisoError, esDueno } = await requierePermisoEditarTickets();
  if (permisoError) return { error: permisoError };

  // Editar un ticket ya entregado puede afectar una venta ya cobrada y
  // sumada a una caja que quizás ya cerró — solo el dueño puede hacerlo
  // (mismo criterio que eliminar un ticket entregado). A un
  // encargado/cajero con el permiso normal de editar tickets se le sigue
  // bloqueando en ese caso.
  if (!esDueno) {
    const { data: ticket } = await supabase.from("tickets").select("estado").eq("id", ticketId).maybeSingle();
    if (ticket?.estado === "entregado") {
      return { error: "Solo el dueño puede editar un ticket ya entregado." };
    }
  }

  const { error } = await supabase
    .from("tickets")
    .update({
      servicio_id: input.servicioId,
      tamano_vehiculo: input.tamanoVehiculo,
      lavador_id: input.lavadorId,
      distintivo: input.distintivo,
      placa: input.placa,
      vehiculo_id: input.vehiculoId,
    })
    .eq("id", ticketId);

  if (error) return { error: error.message };

  // Se reemplazan todos los extras del ticket por la selección actual (en
  // vez de calcular un diff) — es una lista corta y así siempre queda en
  // el precio vigente del catálogo al momento de guardar la edición.
  const { error: borrarError } = await supabase.from("ticket_extras").delete().eq("ticket_id", ticketId);
  if (borrarError) return { error: borrarError.message };

  if (input.extraIds.length > 0) {
    const errorExtras = await sincronizarExtrasTicket(supabase, ticketId, input.extraIds);
    if (errorExtras) return { error: errorExtras };
  }

  revalidatePath("/", "layout");
  return { error: null };
}

export async function eliminarTicket(ticketId: string) {
  const { supabase, error: permisoError, esDueno } = await requierePermisoEditarTickets();
  if (permisoError) return { error: permisoError };

  const { data: ticket } = await supabase.from("tickets").select("estado").eq("id", ticketId).maybeSingle();

  if (!ticket) return { error: "El ticket ya no existe." };
  // Un ticket entregado puede tener pagos que ya se sumaron a la caja
  // cerrada del turno — solo el dueño puede eliminarlo (p. ej. para
  // corregir una prueba capturada por error), no un encargado/cajero al
  // que solo se le delegó el permiso de editar/eliminar tickets normales.
  if (ticket.estado === "entregado" && !esDueno) {
    return { error: "Solo el dueño puede eliminar un ticket ya entregado (afectaría la caja cerrada)." };
  }

  // Un ticket puede ya tener pagos registrados (se puede cobrar antes de
  // entregar) — hay que borrarlos primero, si no la llave foránea bloquea
  // el borrado del ticket.
  const { error: pagosError } = await supabase.from("pagos").delete().eq("ticket_id", ticketId);
  if (pagosError) return { error: pagosError.message };

  const { error } = await supabase.from("tickets").delete().eq("id", ticketId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}
