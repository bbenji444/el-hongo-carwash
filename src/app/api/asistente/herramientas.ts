import { resolverRango, type Periodo, type RangoResuelto } from "@/lib/rangoFechas";
import { obtenerDatosReporte } from "@/app/(app)/reportes/data";
import { obtenerDatosLavadores } from "@/app/(app)/lavadores/data";
import { createClient } from "@/lib/supabase/server";
import { nombreCategoriaGasto } from "@/lib/gastoCategorias";
import { fetchPaginado, fetchEnLotes } from "@/lib/supabaseBatch";
import type { GastoCategoria } from "@/types/database.types";

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

// Las herramientas financieras (ventas, gastos, ganancia neta, caja) se
// ocultan para cajeros — mismo criterio que ya usan las páginas de
// Reportes y Gastos (redirigen a un cajero que intente entrar).
export function construirHerramientas(incluirFinancieras: boolean): Herramienta[] {
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
      }
    );
  }

  return herramientas;
}
