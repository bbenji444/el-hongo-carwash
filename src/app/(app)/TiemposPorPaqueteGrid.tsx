"use client";

import { useState } from "react";
import { nombreTamano } from "@/lib/servicios";
import { emojiPorTamano } from "@/lib/configuracionDefaults";
import type { TamanoVehiculo, ConfiguracionApp } from "@/types/database.types";
import type { TiempoPorPaqueteCelda } from "./lavadores/data";

function formatearMin(min: number) {
  const redondeado = Math.round(min);
  if (redondeado < 60) return `${redondeado} min`;
  const horas = Math.floor(redondeado / 60);
  const resto = redondeado % 60;
  return resto > 0 ? `${horas}h ${resto}min` : `${horas}h`;
}

// Verde (rápido) -> rojo (lento), interpolado sobre el rango real que se
// está observando en el negocio (no una escala fija) — así siempre se ve
// diferencia entre celdas, sin importar si en general todo va rápido o
// todo va lento ese período.
function colorPorTiempo(valor: number, min: number, max: number) {
  const t = max === min ? 0.5 : Math.max(0, Math.min(1, (valor - min) / (max - min)));
  const r = Math.round(22 + t * (220 - 22));
  const g = Math.round(163 + t * (38 - 163));
  const b = Math.round(74 + t * (38 - 74));
  return `rgb(${r}, ${g}, ${b})`;
}

export function TiemposPorPaqueteGrid({
  servicios,
  tamanos,
  celdas,
  config,
}: {
  servicios: { id: string; nombre: string }[];
  tamanos: TamanoVehiculo[];
  celdas: TiempoPorPaqueteCelda[];
  config: ConfiguracionApp;
}) {
  const [seleccionada, setSeleccionada] = useState<string | null>(null);

  const porClave = new Map(celdas.map((c) => [`${c.servicioId}::${c.tamano}`, c]));
  const valores = celdas.map((c) => c.promedioMin).filter((v): v is number => v !== null);
  const min = valores.length ? Math.min(...valores) : 0;
  const max = valores.length ? Math.max(...valores) : 0;

  const celdaSeleccionada = seleccionada ? porClave.get(seleccionada) : null;
  const servicioSeleccionado = celdaSeleccionada
    ? servicios.find((s) => s.id === celdaSeleccionada.servicioId)
    : null;

  if (valores.length === 0) {
    return (
      <p className="flex h-[160px] items-center justify-center text-sm text-muted">
        Aún no hay lavadas cronometradas (Iniciar → Terminado) en este período.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-1.5 text-sm">
          <thead>
            <tr>
              <th className="w-28 text-left text-xs font-medium text-muted">Tamaño \ Paquete</th>
              {servicios.map((s) => (
                <th key={s.id} className="px-1 py-1 text-center text-xs font-semibold text-foreground">
                  {s.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tamanos.map((tamano) => (
              <tr key={tamano}>
                <th className="whitespace-nowrap px-1 py-1 text-left text-xs font-medium text-muted">
                  {emojiPorTamano(config, tamano)} {nombreTamano(tamano)}
                </th>
                {servicios.map((s) => {
                  const clave = `${s.id}::${tamano}`;
                  const celda = porClave.get(clave);
                  const activa = seleccionada === clave;
                  if (!celda || celda.promedioMin === null) {
                    return (
                      <td key={clave} className="rounded-lg bg-background p-2 text-center text-xs text-muted">
                        —
                      </td>
                    );
                  }
                  return (
                    <td key={clave} className="p-0">
                      <button
                        type="button"
                        onClick={() => setSeleccionada(activa ? null : clave)}
                        className={`w-full rounded-lg p-2 text-center transition ${
                          activa ? "ring-2 ring-offset-1 ring-foreground" : ""
                        }`}
                        style={{ backgroundColor: colorPorTiempo(celda.promedioMin, min, max) }}
                      >
                        <span className="block text-sm font-bold text-white drop-shadow">
                          {formatearMin(celda.promedioMin)}
                        </span>
                        <span className="block text-[10px] text-white/80">n={celda.n}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-3 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorPorTiempo(min, min, max) }} /> Más
          rápido
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorPorTiempo(max, min, max) }} /> Más
          lento
        </span>
        <span>· Toca una celda para ver el detalle</span>
      </div>

      {celdaSeleccionada && celdaSeleccionada.promedioMin !== null && (
        <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted">
          <span className="font-medium text-foreground">
            {servicioSeleccionado?.nombre} · {nombreTamano(celdaSeleccionada.tamano)}:
          </span>{" "}
          promedio {formatearMin(celdaSeleccionada.promedioMin)} · más rápida {formatearMin(celdaSeleccionada.minMin!)}{" "}
          · más lenta {formatearMin(celdaSeleccionada.maxMin!)} · basado en {celdaSeleccionada.n} lavada
          {celdaSeleccionada.n === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}
