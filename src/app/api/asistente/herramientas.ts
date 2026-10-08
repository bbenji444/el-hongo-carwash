import { resolverRango, type Periodo, type RangoResuelto } from "@/lib/rangoFechas";
import { obtenerDatosReporte } from "@/app/(app)/reportes/data";
import { obtenerDatosLavadores } from "@/app/(app)/lavadores/data";
import { obtenerDatosInventario } from "@/app/(app)/inventario/data";
import { buscarClientes, detalleCliente } from "@/app/(app)/tickets/actions";
import { buscarTicketsDetalle } from "@/lib/ticketsDetalle";
import { createClient } from "@/lib/supabase/server";
import { nombreCategoriaGasto } from "@/lib/gastoCategorias";
import { fetchPaginado, fetchEnLotes } from "@/lib/supabaseBatch";
import { ACCIONES_CAMBIO, type AccionHistorial, type EntidadHistorial } from "@/lib/historial";
import type { GastoCategoria, TicketEstado } from "@/types/database.types";

const PERIODOS_VALIDOS: Periodo[] = ["hoy", "7d", "30d", "todo"];

// Atajos fijos (hoy/7d/30d/todo) + "personalizado" para CUALQUIER otro
// período con nombre (un mes del calendario, una semana específica, "los
// últimos 4 días", etc.) — el modelo ya recibe la fecha de hoy en el
// system prompt y calcula "desde"/"hasta" él mismo. Antes solo existían
// los 4 atajos fijos: preguntar por "octubre" el día 4 de octubre hacía
// que el modelo aproximara con "30d" (que se va hasta principios de
// septiembre) pero describiera el resultado como si fuera "octubre" —
// esto se quita por completo dándole la herramienta correcta.
const PARAM_FECHA = {
  type: "object",
  properties: {
    periodo: {
      type: "string",
      enum: [...PERIODOS_VALIDOS, "personalizado"],
      description:
        "'hoy', '7d' (últimos 7 días), '30d' (últimos 30 días) o 'todo' el histórico. Usa 'personalizado' junto con 'desde' (y opcionalmente 'hasta') para cualquier período con nombre que no sea exactamente uno de esos cuatro — un mes del calendario, una semana específica, 'los últimos N días' con N distinto de 7/30, etc. — calculando tú mismo las fechas a partir de la fecha de hoy que ya tienes.",
    },
    desde: {
      type: "string",
      description: "Fecha de inicio en formato YYYY-MM-DD. Solo se usa si periodo es 'personalizado'.",
    },
    hasta: {
      type: "string",
      description: "Fecha de fin en formato YYYY-MM-DD (incluida). Solo se usa si periodo es 'personalizado'; si se omite, llega hasta hoy.",
    },
  },
  required: ["periodo"],
} as const;

// "en-CA" da el formato YYYY-MM-DD directo, sin tener que armarlo a mano.
function hoyFechaMX(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

function resolverRangoDesdeArgs(args: Record<string, unknown>): RangoResuelto {
  if (args.periodo === "personalizado" && typeof args.desde === "string") {
    // Si el modelo no manda "hasta", NO hay que dejarlo abierto para
    // siempre — resolverRango trata un "hasta" ausente como "sin tope
    // superior" (trae todo lo que sea posterior a "desde", sin límite),
    // no como "hasta hoy". Esto es lo que causaba números distintos entre
    // una pregunta y otra por el mismo mes: una llamada traía el mes
    // completo y la siguiente, al no mandar "hasta", seguía sumando hasta
    // la fecha real del servidor (más allá del mes preguntado).
    const hasta = typeof args.hasta === "string" && args.hasta ? args.hasta : hoyFechaMX();
    return resolverRango({ desde: args.desde, hasta });
  }
  const periodo =
    typeof args.periodo === "string" && (PERIODOS_VALIDOS as string[]).includes(args.periodo)
      ? (args.periodo as Periodo)
      : "hoy";
  return resolverRango({ periodo });
}

export type Herramienta = {
  definicion: {
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  };
  ejecutar: (args: Record<string, unknown>) => Promise<unknown>;
};

// Resumen financiero y de ventas — cubre la mayoría de preguntas generales
// del negocio (ventas, ticket promedio, descuentos, gastos, ingresos
// extra, ganancia neta, diferencias de caja).
async function resumenNegocio(args: Record<string, unknown>) {
  const rango = resolverRangoDesdeArgs(args);
  const datos = await obtenerDatosReporte(rango);
  return {
    periodo: rango.etiqueta,
    ventasTotales: datos.ventasTotales,
    numTickets: datos.numTickets,
    ticketPromedio: Math.round(datos.ticketPromedio * 100) / 100,
    totalDescuentos: datos.totalDescuentos,
    totalGastos: datos.totalGastos,
    totalIngresosExtra: datos.totalIngresosExtra,
    gananciaNeta: datos.gananciaNeta,
    diferenciaAcumuladaCaja: datos.diferenciaAcumulada,
    turnosConAlertaDeCaja: datos.turnosConAlerta,
    ventasPorServicio: datos.ventasPorServicio
      .slice(0, 8)
      .map((v) => ({ servicio: v.nombre, tickets: v.tickets, total: v.total })),
    ventasPorMetodoDePago: datos.ventasPorMetodo,
  };
}

// Rendimiento de lavadores — autos lavados, ventas generadas, tiempo,
// eficiencia y satisfacción. Disponible para cualquier rol (la página de
// Lavadores tampoco está restringida a cajeros).
async function rendimientoLavadores(args: Record<string, unknown>) {
  const rango = resolverRangoDesdeArgs(args);
  const { lavadores } = await obtenerDatosLavadores(rango);
  return {
    periodo: rango.etiqueta,
    lavadores: lavadores
      // Solo tipo "lavador" — un encargado (ej. Fani) no lava autos, así
      // que no tiene sentido evaluarlo en rendimiento de lavado.
      .filter((l) => l.activo && l.tipo === "lavador")
      .map((l) => ({
        nombre: l.nombre,
        autosLavados: l.autosLavados,
        ventasGeneradas: l.ventasGeneradas,
        tiempoPromedioLavadoMin: l.tiempoPromedioLavadoMin !== null ? Math.round(l.tiempoPromedioLavadoMin) : null,
        eficiencia: l.eficiencia !== null ? Math.round(l.eficiencia * 100) / 100 : null,
        satisfaccionPromedio: l.satisfaccionProm !== null ? Math.round(l.satisfaccionProm * 10) / 10 : null,
        calificacionesRecibidas: l.calificaciones,
        puntaje: l.puntaje,
      }))
      .sort((a, b) => b.autosLavados - a.autosLavados),
  };
}

// Desglose de gastos por categoría — "¿en qué se me va más el dinero?".
async function gastosPorCategoria(args: Record<string, unknown>) {
  const rango = resolverRangoDesdeArgs(args);
  const supabase = await createClient();
  const data = await fetchPaginado((desde, hasta) => {
    let query = supabase.from("gastos").select("categoria, monto").order("fecha", { ascending: false }).range(desde, hasta);
    if (rango.desdeIso) query = query.gte("fecha", rango.desdeIso);
    if (rango.hastaIso) query = query.lte("fecha", rango.hastaIso);
    return query;
  });

  const totalesPorCategoria = new Map<GastoCategoria, number>();
  for (const g of data) {
    totalesPorCategoria.set(g.categoria, (totalesPorCategoria.get(g.categoria) ?? 0) + g.monto);
  }
  const categorias = Array.from(totalesPorCategoria.entries())
    .map(([categoria, total]) => ({ categoria: nombreCategoriaGasto(categoria), total }))
    .sort((a, b) => b.total - a.total);

  return {
    periodo: rango.etiqueta,
    totalGastos: categorias.reduce((acc, c) => acc + c.total, 0),
    categorias,
  };
}

// Desglose por PRODUCTO/INSUMO específico (ej. Teflón, Shampoo,
// Abrillantador) — distinto de gastos_por_categoria, que solo agrupa en
// categorías generales (Insumos, Nómina, etc). Mismo criterio que ya usa
// la gráfica de Gastos: un gasto con "producto específico" puesto directo
// cuenta completo ahí; uno sin eso pero con renglones desglosados (una
// compra mixta de varios productos en un ticket) reparte su monto entre
// los renglones que coincidan por nombre con el catálogo de productos.
async function gastosPorProducto(args: Record<string, unknown>) {
  const rango = resolverRangoDesdeArgs(args);
  const supabase = await createClient();

  const gastosRaw = await fetchPaginado((desde, hasta) => {
    let q = supabase.from("gastos").select("id, subcategoria_id, monto").order("fecha", { ascending: false }).range(desde, hasta);
    if (rango.desdeIso) q = q.gte("fecha", rango.desdeIso);
    if (rango.hastaIso) q = q.lte("fecha", rango.hastaIso);
    return q;
  });

  const { data: subcategoriasRaw } = await supabase.from("gasto_subcategorias").select("id, nombre").eq("activo", true);
  const nombrePorSubcategoria = new Map((subcategoriasRaw ?? []).map((s) => [s.id, s.nombre]));
  const idPorNombreSubcategoria = new Map((subcategoriasRaw ?? []).map((s) => [s.nombre.trim().toLowerCase(), s.id]));

  const gastoIdsSinProducto = gastosRaw.filter((g) => !g.subcategoria_id).map((g) => g.id);
  const items = await fetchEnLotes(gastoIdsSinProducto, (lote) =>
    supabase.from("gasto_items").select("gasto_id, producto, cantidad, precio_unitario").in("gasto_id", lote)
  );
  const itemsPorGasto = new Map<string, typeof items>();
  for (const it of items) {
    const lista = itemsPorGasto.get(it.gasto_id) ?? [];
    lista.push(it);
    itemsPorGasto.set(it.gasto_id, lista);
  }

  const totalPorProducto = new Map<string, number>();
  for (const g of gastosRaw) {
    if (g.subcategoria_id) {
      totalPorProducto.set(g.subcategoria_id, (totalPorProducto.get(g.subcategoria_id) ?? 0) + g.monto);
      continue;
    }
    for (const it of itemsPorGasto.get(g.id) ?? []) {
      const subId = idPorNombreSubcategoria.get(it.producto.trim().toLowerCase());
      if (!subId) continue;
      totalPorProducto.set(subId, (totalPorProducto.get(subId) ?? 0) + it.cantidad * it.precio_unitario);
    }
  }

  const productos = Array.from(totalPorProducto.entries())
    .map(([id, total]) => ({ producto: nombrePorSubcategoria.get(id) ?? "—", total }))
    .sort((a, b) => b.total - a.total);

  return {
    periodo: rango.etiqueta,
    // Puede ser menor al total real de gastos del período: solo cuenta lo
    // que sí tiene un producto específico identificado (un gasto como
    // "Renta" o "Luz" no tiene uno).
    totalConProductoIdentificado: productos.reduce((acc, p) => acc + p.total, 0),
    productos,
  };
}

// Nómina pagada a cada lavador en un período — "¿cuánto se le ha pagado a
// Fulano?", para comparar contra sus ventas generadas (rendimiento_lavadores)
// y decidir cosas como sueldo fijo vs comisión por auto. Mismo criterio que
// ya usa la gráfica "Nómina por lavador" de Gastos: un gasto de Nómina con
// el lavador puesto directo cuenta completo; uno sin eso pero con renglones
// desglosados (el "Sueldos" semanal normal, un renglón por persona) reparte
// el monto entre los renglones cuyo nombre coincida con un lavador.
async function nominaPorLavador(args: Record<string, unknown>) {
  const rango = resolverRangoDesdeArgs(args);
  const supabase = await createClient();

  const gastosNomina = await fetchPaginado((desde, hasta) => {
    let q = supabase
      .from("gastos")
      .select("id, monto, lavador_id")
      .eq("categoria", "nomina")
      .order("fecha", { ascending: false })
      .range(desde, hasta);
    if (rango.desdeIso) q = q.gte("fecha", rango.desdeIso);
    if (rango.hastaIso) q = q.lte("fecha", rango.hastaIso);
    return q;
  });

  const { data: lavadoresRaw } = await supabase.from("lavadores").select("id, nombre");
  const idPorNombreLavador = new Map((lavadoresRaw ?? []).map((l) => [l.nombre.trim().toLowerCase(), l.id]));
  const nombrePorLavador = new Map((lavadoresRaw ?? []).map((l) => [l.id, l.nombre]));

  const gastoIdsSinLavador = gastosNomina.filter((g) => !g.lavador_id).map((g) => g.id);
  const items = await fetchEnLotes(gastoIdsSinLavador, (lote) =>
    supabase.from("gasto_items").select("gasto_id, producto, cantidad, precio_unitario").in("gasto_id", lote)
  );
  const itemsPorGasto = new Map<string, typeof items>();
  for (const it of items) {
    const lista = itemsPorGasto.get(it.gasto_id) ?? [];
    lista.push(it);
    itemsPorGasto.set(it.gasto_id, lista);
  }

  const totalPorLavador = new Map<string, number>();
  for (const g of gastosNomina) {
    if (g.lavador_id) {
      totalPorLavador.set(g.lavador_id, (totalPorLavador.get(g.lavador_id) ?? 0) + g.monto);
      continue;
    }
    for (const it of itemsPorGasto.get(g.id) ?? []) {
      const lavId = idPorNombreLavador.get(it.producto.trim().toLowerCase());
      if (!lavId) continue;
      totalPorLavador.set(lavId, (totalPorLavador.get(lavId) ?? 0) + it.cantidad * it.precio_unitario);
    }
  }

  const lavadores = Array.from(totalPorLavador.entries())
    .map(([id, total]) => ({ lavador: nombrePorLavador.get(id) ?? "—", nominaPagada: total }))
    .sort((a, b) => b.nominaPagada - a.nominaPagada);

  return {
    periodo: rango.etiqueta,
    lavadores,
  };
}

// Reportes sobre el histórico de movimientos (auditoría): quién hizo qué,
// cuánto ha hecho cada quien, en qué secciones ha estado entrando alguien,
// etc. La consulta corre con el cliente de la sesión (createClient()), así
// que el RLS de historial_movimientos sigue aplicando igual que en la
// página — esta herramienta solo se ofrece (ver construirHerramientas) a
// quien de verdad tiene puede_ver_historial, así que nunca debería llegar
// vacía por falta de permiso.
async function consultarHistorial(args: Record<string, unknown>) {
  const rango = resolverRangoDesdeArgs(args);
  const supabase = await createClient();

  const tipo = typeof args.tipo === "string" ? args.tipo : "todos";
  const entidad = typeof args.entidad === "string" ? (args.entidad as EntidadHistorial) : undefined;
  const usuarioNombre = typeof args.usuario === "string" ? args.usuario.trim() : "";

  const construirQuery = (desde: number, hasta: number) => {
    let q = supabase
      .from("historial_movimientos")
      .select("usuario_nombre, accion, entidad, resumen, creado_en")
      .order("creado_en", { ascending: false })
      .range(desde, hasta);
    if (rango.desdeIso) q = q.gte("creado_en", rango.desdeIso);
    if (rango.hastaIso) q = q.lte("creado_en", rango.hastaIso);
    if (tipo === "cambios") q = q.in("accion", ACCIONES_CAMBIO);
    if (tipo === "actividad") q = q.eq("accion", "ver");
    if (entidad) q = q.eq("entidad", entidad);
    if (usuarioNombre) q = q.ilike("usuario_nombre", `%${usuarioNombre}%`);
    return q;
  };

  // Tope de seguridad (el negocio es chico, pero por si el período es
  // "todo" sobre meses de operación) — de sobra para cualquier reporte
  // razonable sin mandar una respuesta gigante al modelo.
  const movimientos = await fetchPaginado(construirQuery, 1000, 2000);

  const porUsuario = new Map<string, number>();
  const porAccion = new Map<string, number>();
  const porEntidad = new Map<string, number>();
  for (const m of movimientos) {
    porUsuario.set(m.usuario_nombre, (porUsuario.get(m.usuario_nombre) ?? 0) + 1);
    porAccion.set(m.accion, (porAccion.get(m.accion) ?? 0) + 1);
    porEntidad.set(m.entidad, (porEntidad.get(m.entidad) ?? 0) + 1);
  }

  return {
    periodo: rango.etiqueta,
    totalMovimientos: movimientos.length,
    conteoPorUsuario: Array.from(porUsuario, ([usuario, total]) => ({ usuario, total })).sort((a, b) => b.total - a.total),
    conteoPorAccion: Array.from(porAccion, ([accion, total]) => ({ accion, total })).sort((a, b) => b.total - a.total),
    conteoPorEntidad: Array.from(porEntidad, ([entidad, total]) => ({ entidad, total })).sort((a, b) => b.total - a.total),
    // Los 50 más recientes que coincidan con el filtro — si se necesita ver
    // más detalle de un usuario/sección puntual, hay que acotar con los
    // filtros de usuario/entidad/tipo en vez de pedir todo junto.
    movimientosRecientes: movimientos.slice(0, 50).map((m) => ({
      usuario: m.usuario_nombre,
      accion: m.accion as AccionHistorial,
      entidad: m.entidad as EntidadHistorial,
      resumen: m.resumen,
      fecha: m.creado_en,
    })),
  };
}

// Busca tickets/vehículos por texto (placa o distintivo) y/o estado, en un
// período — "¿qué pasó con el Jetta gris?", "¿qué autos están en espera
// ahorita?". Reutiliza buscarTicketsDetalle (el mismo motor de búsqueda de
// Reportes/Turnos), así que respeta los mismos criterios de paginado.
async function buscarTicket(args: Record<string, unknown>) {
  const rango = resolverRangoDesdeArgs(args);
  const texto = typeof args.texto === "string" ? args.texto : "";
  const estado = typeof args.estado === "string" ? (args.estado as TicketEstado) : "";

  const resultado = await buscarTicketsDetalle(rango, { q: texto });
  const filas = estado ? resultado.filas.filter((f) => f.estado === estado) : resultado.filas;

  return {
    periodo: rango.etiqueta,
    totalCoincidencias: filas.length,
    tickets: filas.slice(0, 30).map((f) => ({
      vehiculo: f.distintivoPlaca,
      cliente: f.cliente,
      servicio: f.servicio,
      lavador: f.lavador,
      estado: f.estado,
      metodoPago: f.metodo,
      monto: f.monto,
      horaEntrada: f.horaEntrada,
    })),
  };
}

// Busca un cliente por nombre (o parte del nombre) y trae su progreso de
// lealtad, visitas totales, gasto acumulado y vehículos registrados —
// "¿cuántas visitas lleva Juan?", "¿le toca lavada gratis?".
async function buscarCliente(args: Record<string, unknown>) {
  const nombre = typeof args.nombre === "string" ? args.nombre.trim() : "";
  if (!nombre) return { error: "Falta el nombre (o parte del nombre) del cliente a buscar." };

  const { data: coincidencias } = await buscarClientes(nombre);
  if (!coincidencias || coincidencias.length === 0) {
    return { encontrados: 0, clientes: [] };
  }

  const detalles = await Promise.all(
    coincidencias.slice(0, 5).map(async (c) => {
      const { data } = await detalleCliente(c.id);
      if (!data) return null;
      return {
        nombre: data.cliente.nombre,
        telefono: data.cliente.telefono,
        vehiculos: data.vehiculos.map((v) => v.placas),
        visitasTotales: data.visitasTotales,
        gastoTotalHistorico: data.gastoTotal,
        ultimaVisita: data.ultimaVisita,
        lavadasEnCicloActual: data.lavadasEnCiclo,
        proximaLavadaGratis: data.proximaGratis,
      };
    })
  );

  return {
    encontrados: coincidencias.length,
    clientes: detalles.filter((d): d is NonNullable<typeof d> => d !== null),
  };
}

// Estado del inventario de insumos — qué está agotado, qué está bajo de
// stock, y el valor total guardado. Disponible para cualquier rol (la
// página de Inventario tampoco está restringida a cajeros).
async function estadoInventario(args: Record<string, unknown>) {
  const soloBajo = args.soloBajo === true;
  const datos = await obtenerDatosInventario(soloBajo);
  return {
    totalInsumos: datos.totalInsumos,
    numAgotados: datos.numAgotados,
    numBajoDeStock: datos.numBajo,
    valorTotalInventario: Math.round(datos.valorTotalInventario * 100) / 100,
    insumos: datos.insumos.slice(0, 50).map((i) => ({
      nombre: i.nombre_insumo,
      stockActual: i.stock_actual,
      stockMinimo: i.stock_minimo,
      costoUnitario: i.costo_unitario,
      agotado: i.stock_actual <= 0,
      bajoDeStock: i.stock_actual > 0 && i.stock_actual <= i.stock_minimo,
    })),
  };
}

// Estado del turno/caja ABIERTO en este momento — "¿cuánto llevamos en
// caja ahorita?", "¿hay turno abierto?". Distinto de resumen_negocio (que
// es financiero por período): esto es un snapshot del instante actual.
async function turnoActual() {
  const supabase = await createClient();
  const { data: turno } = await supabase.from("turnos").select("*").eq("estado", "abierto").maybeSingle();

  if (!turno) {
    return { hayTurnoAbierto: false };
  }

  const [{ data: pagos }, { count: pendientes }] = await Promise.all([
    supabase.from("pagos").select("metodo, monto").eq("turno_id", turno.id),
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("turno_id", turno.id)
      .neq("estado", "entregado"),
  ]);

  const totales: Record<string, number> = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  for (const p of pagos ?? []) {
    totales[p.metodo] = (totales[p.metodo] ?? 0) + p.monto;
  }

  return {
    hayTurnoAbierto: true,
    horaApertura: turno.hora_apertura,
    efectivoInicial: turno.efectivo_inicial,
    totalesPorMetodoDePago: totales,
    efectivoEsperadoEnCaja: Math.round((turno.efectivo_inicial + totales.efectivo) * 100) / 100,
    ticketsPendientesDeEntregar: pendientes ?? 0,
  };
}

// Desglose de ingresos extra (pensiones de estacionamiento, etc.) por
// concepto en un período — paralelo a gastos_por_categoria pero para
// ingresos_extra.
async function ingresosExtraDetalle(args: Record<string, unknown>) {
  const rango = resolverRangoDesdeArgs(args);
  const supabase = await createClient();

  const data = await fetchPaginado((desde, hasta) => {
    let q = supabase
      .from("ingresos_extra")
      .select("concepto, monto")
      .order("fecha", { ascending: false })
      .range(desde, hasta);
    if (rango.desdeIso) q = q.gte("fecha", rango.desdeIso);
    if (rango.hastaIso) q = q.lte("fecha", rango.hastaIso);
    return q;
  });

  const porConcepto = new Map<string, number>();
  for (const i of data) {
    porConcepto.set(i.concepto, (porConcepto.get(i.concepto) ?? 0) + i.monto);
  }

  return {
    periodo: rango.etiqueta,
    totalIngresosExtra: data.reduce((acc, i) => acc + i.monto, 0),
    numRegistros: data.length,
    porConcepto: Array.from(porConcepto, ([concepto, total]) => ({ concepto, total })).sort((a, b) => b.total - a.total),
  };
}

// Las herramientas financieras (ventas, gastos, ganancia neta, caja) se
// ocultan para cajeros — mismo criterio que ya usan las páginas de
// Reportes y Gastos (redirigen a un cajero que intente entrar). La de
// histórico se oculta para cualquiera sin puede_ver_historial — mismo
// criterio que la página /historial.
export function construirHerramientas(incluirFinancieras: boolean, incluirHistorial: boolean): Herramienta[] {
  const herramientas: Herramienta[] = [
    {
      definicion: {
        type: "function",
        function: {
          name: "rendimiento_lavadores",
          description:
            "Estadísticas de cada lavador activo en un período: autos lavados, ventas generadas, tiempo promedio, eficiencia, satisfacción del cliente y puntaje general. Úsala para cualquier pregunta sobre lavadores o su rendimiento.",
          parameters: PARAM_FECHA,
        },
      },
      ejecutar: rendimientoLavadores,
    },
    {
      definicion: {
        type: "function",
        function: {
          name: "buscar_ticket",
          description:
            "Busca tickets/autos por texto (placa o distintivo) y/o estado, en un período. Úsala para preguntas sobre un vehículo o cliente específico (ej. '¿qué pasó con el Jetta gris?', '¿ya se entregó el carro de Juan?') o sobre qué tickets están en cierto estado ahorita (ej. '¿qué autos están en espera?').",
          parameters: {
            type: "object",
            properties: {
              ...PARAM_FECHA.properties,
              texto: {
                type: "string",
                description: "Placa o distintivo (o parte de ellos) a buscar. Omite si solo filtras por estado.",
              },
              estado: {
                type: "string",
                enum: ["en_espera", "en_proceso", "terminado", "entregado"],
                description: "Filtra solo tickets en este estado. Omite para incluir todos los estados.",
              },
            },
            required: ["periodo"],
          },
        },
      },
      ejecutar: buscarTicket,
    },
    {
      definicion: {
        type: "function",
        function: {
          name: "buscar_cliente",
          description:
            "Busca un cliente por nombre (o parte del nombre) y trae su progreso de lealtad (lavadas en el ciclo actual, si le toca la 6ta gratis), visitas totales, gasto acumulado histórico y sus vehículos registrados.",
          parameters: {
            type: "object",
            properties: {
              nombre: { type: "string", description: "Nombre o parte del nombre del cliente a buscar." },
            },
            required: ["nombre"],
          },
        },
      },
      ejecutar: buscarCliente,
    },
    {
      definicion: {
        type: "function",
        function: {
          name: "estado_inventario",
          description:
            "Estado del inventario de insumos: cuáles están agotados, cuáles están bajos de stock, y el valor total del inventario guardado. Úsala para preguntas sobre qué insumo falta, qué hay que comprar, o el valor del inventario.",
          parameters: {
            type: "object",
            properties: {
              soloBajo: {
                type: "boolean",
                description: "true para traer solo los insumos agotados o bajos de stock; false (default) trae todos.",
              },
            },
          },
        },
      },
      ejecutar: estadoInventario,
    },
  ];

  if (incluirFinancieras) {
    herramientas.push(
      {
        definicion: {
          type: "function",
          function: {
            name: "resumen_negocio",
            description:
              "Resumen financiero y de ventas del negocio en un período: ventas totales, ticket promedio, descuentos, gastos, ingresos extra, ganancia neta, diferencias de caja, y ventas por paquete/método de pago. Úsala para cualquier pregunta sobre ventas, ganancias, caja o el negocio en general.",
            parameters: PARAM_FECHA,
          },
        },
        ejecutar: resumenNegocio,
      },
      {
        definicion: {
          type: "function",
          function: {
            name: "gastos_por_categoria",
            description:
              "Desglose de los gastos del negocio por CATEGORÍA GENERAL (Nómina, Insumos/Productos, Servicios, Renta, Mantenimiento, Otros) en un período. Úsala solo cuando pregunten por categorías generales. Si preguntan en qué PRODUCTO específico se gasta más (ej. Teflón, Shampoo, un insumo en particular), usa gastos_por_producto en vez de esta.",
            parameters: PARAM_FECHA,
          },
        },
        ejecutar: gastosPorCategoria,
      },
      {
        definicion: {
          type: "function",
          function: {
            name: "gastos_por_producto",
            description:
              "Desglose de los gastos del negocio por PRODUCTO O INSUMO ESPECÍFICO (ej. Teflón, Shampoo, Abrillantador, Toallas) en un período — no por categoría general. Úsala siempre que pregunten en qué producto/insumo concreto se está gastando más, cuánto se ha comprado de algo específico, etc.",
            parameters: PARAM_FECHA,
          },
        },
        ejecutar: gastosPorProducto,
      },
      {
        definicion: {
          type: "function",
          function: {
            name: "nomina_por_lavador",
            description:
              "Cuánto se le ha pagado en Nómina (sueldo) a cada lavador en un período. Úsala para preguntas sobre sueldos/pagos a lavadores específicos, o para comparar sueldo fijo vs comisión — combínala con rendimiento_lavadores (que trae sus ventas generadas) para ese tipo de análisis.",
            parameters: PARAM_FECHA,
          },
        },
        ejecutar: nominaPorLavador,
      },
      {
        definicion: {
          type: "function",
          function: {
            name: "turno_actual",
            description:
              "Estado del turno/caja ABIERTO en este momento (si lo hay): efectivo inicial, totales por método de pago, efectivo esperado en caja y tickets pendientes de entregar. Úsala para preguntas sobre 'ahorita'/'en este momento', no para períodos pasados (para eso usa resumen_negocio).",
            parameters: { type: "object", properties: {} },
          },
        },
        ejecutar: turnoActual,
      },
      {
        definicion: {
          type: "function",
          function: {
            name: "ingresos_extra_detalle",
            description:
              "Desglose de ingresos extra (pensiones de estacionamiento, etc., todo lo que no viene de un ticket de lavado) por concepto, en un período. Úsala para preguntas sobre ingresos extra específicos o de qué conceptos vienen.",
            parameters: PARAM_FECHA,
          },
        },
        ejecutar: ingresosExtraDetalle,
      }
    );
  }

  if (incluirHistorial) {
    herramientas.push({
      definicion: {
        type: "function",
        function: {
          name: "consultar_historial",
          description:
            "Consulta el histórico de movimientos (auditoría): quién creó, editó, eliminó, activó/desactivó, abrió/cerró un turno, o consultó/visitó una sección, y cuándo. Úsala para cualquier pregunta sobre actividad de usuarios — qué ha hecho alguien, cuántas veces entró a algo, en qué ha estado consultando cada quien, o reportes generales del histórico. Devuelve conteos por usuario/acción/sección y los movimientos más recientes que coincidan.",
          parameters: {
            type: "object",
            properties: {
              ...PARAM_FECHA.properties,
              usuario: {
                type: "string",
                description: "Nombre (o parte del nombre) de la persona a filtrar, ej. 'Fany'. Omite para incluir a todos.",
              },
              tipo: {
                type: "string",
                enum: ["todos", "cambios", "actividad"],
                description:
                  "'cambios' = solo crear/editar/eliminar/activar/desactivar/abrir turno/cerrar turno. 'actividad' = solo consultas/visitas a secciones. 'todos' (default) incluye ambos.",
              },
              entidad: {
                type: "string",
                enum: ["ticket", "gasto", "ingreso_extra", "usuario", "turno", "lavador", "reporte"],
                description: "Sección específica a filtrar, ej. 'gasto' o 'lavador'. Omite para incluir todas.",
              },
            },
            required: ["periodo"],
          },
        },
      },
      ejecutar: consultarHistorial,
    });
  }

  return herramientas;
}
