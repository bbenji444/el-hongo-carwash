import { resolverRango, type Periodo } from "@/lib/rangoFechas";
import { obtenerDatosReporte } from "@/app/(app)/reportes/data";
import { obtenerDatosLavadores } from "@/app/(app)/lavadores/data";
import { createClient } from "@/lib/supabase/server";
import { nombreCategoriaGasto } from "@/lib/gastoCategorias";
import type { GastoCategoria } from "@/types/database.types";

const PERIODOS_VALIDOS: Periodo[] = ["hoy", "7d", "30d", "todo"];

function periodoValido(periodo: unknown): Periodo {
  return typeof periodo === "string" && (PERIODOS_VALIDOS as string[]).includes(periodo) ? (periodo as Periodo) : "hoy";
}

const PARAM_PERIODO = {
  type: "object",
  properties: {
    periodo: {
      type: "string",
      enum: PERIODOS_VALIDOS,
      description: "Rango de tiempo a consultar: 'hoy', '7d' (últimos 7 días), '30d' (últimos 30 días) o 'todo' el histórico.",
    },
  },
  required: ["periodo"],
} as const;

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
  const rango = resolverRango({ periodo: periodoValido(args.periodo) });
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
  const rango = resolverRango({ periodo: periodoValido(args.periodo) });
  const { lavadores } = await obtenerDatosLavadores(rango);
  return {
    periodo: rango.etiqueta,
    lavadores: lavadores
      .filter((l) => l.activo)
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
  const rango = resolverRango({ periodo: periodoValido(args.periodo) });
  const supabase = await createClient();
  let query = supabase.from("gastos").select("categoria, monto").order("fecha", { ascending: false });
  if (rango.desdeIso) query = query.gte("fecha", rango.desdeIso);
  if (rango.hastaIso) query = query.lte("fecha", rango.hastaIso);
  const { data } = await query;

  const totalesPorCategoria = new Map<GastoCategoria, number>();
  for (const g of data ?? []) {
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
          parameters: PARAM_PERIODO,
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
            parameters: PARAM_PERIODO,
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
            parameters: PARAM_PERIODO,
          },
        },
        ejecutar: gastosPorCategoria,
      }
    );
  }

  return herramientas;
}
