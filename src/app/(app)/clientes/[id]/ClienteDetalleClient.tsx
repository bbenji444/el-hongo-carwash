"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { TicketEstado } from "@/types/database.types";
import { crearVehiculo } from "../actions";

type Vehiculo = { id: string; placas: string | null; tipo_vehiculo: string | null };
type LavadaHistorial = {
  id: string;
  servicioNombre: string;
  estado: TicketEstado;
  horaEntrada: string;
  horaSalida: string | null;
  descuentoMonto: number;
  lavadaGratis: boolean;
};

export function ClienteDetalleClient({
  clienteId,
  vehiculos,
  historial,
  lavadasEnCiclo,
  ultimaLavada,
}: {
  clienteId: string;
  vehiculos: Vehiculo[];
  historial: LavadaHistorial[];
  lavadasEnCiclo: number;
  ultimaLavada: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <VehiculosSection clienteId={clienteId} vehiculos={vehiculos} />
      <HistorialLavadosSection historial={historial} lavadasEnCiclo={lavadasEnCiclo} ultimaLavada={ultimaLavada} />
    </div>
  );
}

function VehiculosSection({ clienteId, vehiculos }: { clienteId: string; vehiculos: Vehiculo[] }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [placas, setPlacas] = useState("");
  const [tipoVehiculo, setTipoVehiculo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await crearVehiculo({
        clienteId,
        placas: placas.trim() || null,
        tipoVehiculo: tipoVehiculo.trim() || null,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setMostrarForm(false);
      setPlacas("");
      setTipoVehiculo("");
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Vehículos</h2>
        {!mostrarForm && (
          <button onClick={() => setMostrarForm(true)} className="text-xs text-accent hover:underline">
            + Agregar
          </button>
        )}
      </div>

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
          <input
            value={placas}
            onChange={(e) => setPlacas(e.target.value)}
            placeholder="Placas"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          <input
            value={tipoVehiculo}
            onChange={(e) => setTipoVehiculo(e.target.value)}
            placeholder="Tipo (sedán, camioneta...)"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              {pending ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setMostrarForm(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
          {error && <p className="text-xs text-primary">{error}</p>}
        </form>
      )}

      <div className="flex flex-col gap-2">
        {vehiculos.map((v) => (
          <div key={v.id} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <span className="text-foreground">{v.placas ?? "Sin placas"}</span>
            {v.tipo_vehiculo && <span className="text-muted"> · {v.tipo_vehiculo}</span>}
          </div>
        ))}
        {vehiculos.length === 0 && <p className="text-sm text-muted">Sin vehículos registrados.</p>}
      </div>
    </div>
  );
}

function HistorialLavadosSection({
  historial,
  lavadasEnCiclo,
  ultimaLavada,
}: {
  historial: LavadaHistorial[];
  lavadasEnCiclo: number;
  ultimaLavada: string | null;
}) {
  const proximaGratis = lavadasEnCiclo === 5;
  const faltan = 6 - lavadasEnCiclo;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold text-foreground">Programa de lealtad</h2>

      <div
        className={`flex flex-col gap-2 rounded-lg border p-3 text-sm ${
          proximaGratis ? "border-success/40 bg-success/10" : "border-accent/40 bg-accent/10"
        }`}
      >
        <p className={`font-medium ${proximaGratis ? "text-success" : "text-foreground"}`}>
          {proximaGratis ? "¡Su próxima lavada es gratis!" : `${lavadasEnCiclo} de 6 lavadas`}
        </p>
        <p className="text-muted">
          {proximaGratis
            ? "Ya acumuló 5 lavadas en este ciclo."
            : ultimaLavada === null
              ? "Aún no acumula lavadas en este ciclo."
              : `Le faltan ${faltan} lavada${faltan === 1 ? "" : "s"} para la siguiente gratis.`}
        </p>
        <p className="text-xs text-muted">
          Última lavada:{" "}
          {ultimaLavada
            ? new Date(ultimaLavada).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
            : "Sin registro"}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted">Historial</p>
        {historial.length === 0 && <p className="text-sm text-muted">Sin lavadas registradas.</p>}
        {historial.map((h) => (
          <div key={h.id} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-foreground">{h.servicioNombre}</span>
              {h.lavadaGratis && (
                <span className="rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                  Gratis
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              {new Date(h.horaEntrada).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
              {" · "}
              {h.estado === "entregado" ? "Entregado" : "En curso"}
              {h.descuentoMonto > 0 && ` · -$${h.descuentoMonto.toFixed(2)}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
