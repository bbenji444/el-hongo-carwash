import { resolverRango, type Periodo, type RangoResuelto } from "@/lib/rangoFechas";
import { obtenerDatosReporte } from "@/app/(app)/reportes/data";
import { obtenerDatosLavadores } from "@/app/(app)/lavadores/data";
import { createClient } from "@/lib/supabase/server";
import { nombreCategoriaGasto } from "@/lib/gastoCategorias";
import { fetchPaginado } from "@/lib/supabaseBatch";
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

function resolverRangoDesdeArgs(args: Record<string, unknown>): RangoResuelto {
  if (args.periodo === "personalizado" && typeof args.desde === "string") {
    return resolverRango({
      desde: args.desde,
      hasta: typeof args.hasta === "string" ? args.hasta : undefined,
    });
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
              "Desglose de los gastos del negocio por categoría (Nómina, Insumos/Productos, Servicios, Renta, Mantenimiento, Otros) en un período. Úsala para preguntas sobre en qué se está gastando más o el detalle de gastos.",
            parameters: PARAM_FECHA,
          },
        },
        ejecutar: gastosPorCategoria,
      }
    );
  }

  return herramientas;
}
