"use client";

import { useRouter } from "next/navigation";
import {
  VentasPorServicioChart,
  VentasPorTamanoChart,
  VentasPorMetodoChart,
  VentasPorMesChart,
  type VentaPorServicio,
  type VentaPorTamano,
  type VentaPorMetodo,
  type VentaPorMes,
} from "./ReportesCharts";

function construirHref(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `/reportes?${s}` : "/reportes";
}

export function ReportesClient({
  ventasPorServicio,
  ventasPorTamano,
  ventasPorMetodo,
  ventasPorMes,
  filtroServicio,
  filtroTamano,
  filtroMetodo,
  currentParams,
}: {
  ventasPorServicio: VentaPorServicio[];
  ventasPorTamano: VentaPorTamano[];
  ventasPorMetodo: VentaPorMetodo[];
  ventasPorMes: VentaPorMes[];
  filtroServicio: string;
  filtroTamano: string;
  filtroMetodo: string;
  currentParams: Record<string, string | undefined>;
}) {
  const router = useRouter();

  function alternar(campo: "servicio" | "tamano" | "metodo", valor: string, actual: string) {
    router.push(construirHref({ ...currentParams, [campo]: actual === valor ? undefined : valor }));
  }

  // Clic en un mes de la tendencia manda a ver ese mes específico como
  // período personalizado, conservando el resto del filtro maestro.
  function irAMes(mes: string) {
    const [anio, mesNum] = mes.split("-").map(Number);
    const desde = `${mes}-01`;
    const ultimoDia = new Date(anio, mesNum, 0).getDate();
    const hasta = `${mes}-${String(ultimoDia).padStart(2, "0")}`;
    router.push(construirHref({ ...currentParams, periodo: undefined, desde, hasta }));
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Ventas por paquete</h3>
        <VentasPorServicioChart
          data={ventasPorServicio}
          seleccionado={filtroServicio || null}
          onSeleccionar={(id) => alternar("servicio", id, filtroServicio)}
        />
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Ventas por tamaño de vehículo</h3>
        <VentasPorTamanoChart
          data={ventasPorTamano}
          seleccionado={filtroTamano || null}
          onSeleccionar={(t) => alternar("tamano", t, filtroTamano)}
        />
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Métodos de pago</h3>
        <VentasPorMetodoChart
          data={ventasPorMetodo}
          seleccionado={filtroMetodo || null}
          onSeleccionar={(m) => alternar("metodo", m, filtroMetodo)}
        />
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Tendencia de ventas (últimos 12 meses)</h3>
        <VentasPorMesChart data={ventasPorMes} onSeleccionarMes={irAMes} />
      </div>
    </div>
  );
}
