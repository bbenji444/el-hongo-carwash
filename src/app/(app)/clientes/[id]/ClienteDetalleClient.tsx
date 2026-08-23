"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { MembresiaTipo } from "@/types/database.types";
import { crearVehiculo, afiliarMembresia, desactivarMembresiaCliente } from "../actions";

type Vehiculo = { id: string; placas: string | null; tipo_vehiculo: string | null };
type MembresiaCatalogo = {
  id: string;
  nombre: string;
  tipo: MembresiaTipo;
  beneficio_valor: number;
  precio: number;
  vigencia_dias: number;
};
type MembresiaActiva = {
  vinculoId: string;
  nombre: string;
  tipo: MembresiaTipo | null;
  beneficioValor: number;
  saldoPaquete: number;
  fechaInicio: string;
  fechaFin: string;
};

const TIPO_LABEL: Record<MembresiaTipo, string> = {
  descuento_fijo: "Descuento fijo",
  paquete_prepagado: "Paquete prepagado",
};

export function ClienteDetalleClient({
  clienteId,
  vehiculos,
  membresiaActiva,
  membresiasCatalogo,
  puedeDesactivarMembresia,
}: {
  clienteId: string;
  vehiculos: Vehiculo[];
  membresiaActiva: MembresiaActiva | null;
  membresiasCatalogo: MembresiaCatalogo[];
  puedeDesactivarMembresia: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <VehiculosSection clienteId={clienteId} vehiculos={vehiculos} />
      <MembresiaSection
        clienteId={clienteId}
        membresiaActiva={membresiaActiva}
        membresiasCatalogo={membresiasCatalogo}
        puedeDesactivarMembresia={puedeDesactivarMembresia}
      />
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

function MembresiaSection({
  clienteId,
  membresiaActiva,
  membresiasCatalogo,
  puedeDesactivarMembresia,
}: {
  clienteId: string;
  membresiaActiva: MembresiaActiva | null;
  membresiasCatalogo: MembresiaCatalogo[];
  puedeDesactivarMembresia: boolean;
}) {
  const [membresiaId, setMembresiaId] = useState(membresiasCatalogo[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAfiliar(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!membresiaId) {
      setError("Selecciona una membresía.");
      return;
    }

    startTransition(async () => {
      const result = await afiliarMembresia({ clienteId, membresiaId });
      if (result.error) {
        setError(result.error);
      }
    });
  }

  function handleDesactivar() {
    if (!membresiaActiva) return;
    startTransition(async () => {
      await desactivarMembresiaCliente(membresiaActiva.vinculoId, clienteId);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold text-foreground">Membresía</h2>

      {membresiaActiva ? (
        <div className="flex flex-col gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
          <p className="font-medium text-foreground">{membresiaActiva.nombre}</p>
          <p className="text-muted">{membresiaActiva.tipo ? TIPO_LABEL[membresiaActiva.tipo] : "—"}</p>
          {membresiaActiva.tipo === "paquete_prepagado" && (
            <p className="text-muted">Saldo restante: ${membresiaActiva.saldoPaquete.toFixed(2)}</p>
          )}
          {membresiaActiva.tipo === "descuento_fijo" && (
            <p className="text-muted">Descuento por ticket: ${membresiaActiva.beneficioValor.toFixed(2)}</p>
          )}
          <p className="text-xs text-muted">
            Vigente {membresiaActiva.fechaInicio} — {membresiaActiva.fechaFin}
          </p>
          {puedeDesactivarMembresia && (
            <button
              onClick={handleDesactivar}
              disabled={pending}
              className="mt-1 w-fit text-xs text-primary hover:underline disabled:opacity-60"
            >
              Desactivar membresía
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleAfiliar} className="flex flex-col gap-2">
          <p className="text-sm text-muted">Este cliente no tiene una membresía activa.</p>
          <select
            value={membresiaId}
            onChange={(e) => setMembresiaId(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          >
            {membresiasCatalogo.length === 0 && <option value="">Sin planes activos</option>}
            {membresiasCatalogo.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} · {TIPO_LABEL[m.tipo]} · ${m.precio.toFixed(2)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending || membresiasCatalogo.length === 0}
            className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
          >
            {pending ? "Afiliando..." : "Afiliar membresía"}
          </button>
          {error && <p className="text-xs text-primary">{error}</p>}
        </form>
      )}
    </div>
  );
}
