"use client";

import { useEffect, useState, useTransition } from "react";
import type { RolUsuario, TamanoVehiculo } from "@/types/database.types";
import { TAMANOS_VEHICULO, nombreTamano, precioPorTamano } from "@/lib/servicios";
import type { ServicioConPrecios } from "./types";
import {
  buscarClientes,
  crearCliente,
  crearVehiculo,
  crearTicket,
  progresoLealtadCliente,
  usuariosActivos,
} from "./actions";

type ClienteResultado = { id: string; nombre: string; telefono: string | null };
type LealtadInfo = { lavadasEnCiclo: number; proximaGratis: boolean; ultimaLavada: string | null };

export function NuevoTicketModal({
  turnoId,
  servicios,
  rolActual,
  usuarioActualId,
  onClose,
}: {
  turnoId: string;
  servicios: ServicioConPrecios[];
  rolActual: RolUsuario;
  usuarioActualId: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clienteQuery, setClienteQuery] = useState("");
  const [resultados, setResultados] = useState<ClienteResultado[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteResultado | null>(null);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState("");
  const [nuevoClienteTelefono, setNuevoClienteTelefono] = useState("");
  const [creandoClienteNuevo, setCreandoClienteNuevo] = useState(false);

  const [placas, setPlacas] = useState("");
  const [tamanoVehiculo, setTamanoVehiculo] = useState<TamanoVehiculo>("automovil");

  const [servicioId, setServicioId] = useState(servicios[0]?.id ?? "");

  const [empleados, setEmpleados] = useState<{ id: string; nombre: string; rol: RolUsuario }[]>([]);
  const [empleadoId, setEmpleadoId] = useState(usuarioActualId);

  const [lealtad, setLealtad] = useState<LealtadInfo | null>(null);

  useEffect(() => {
    if (rolActual === "encargado" || rolActual === "dueno") {
      usuariosActivos().then((res) => setEmpleados(res.data as { id: string; nombre: string; rol: RolUsuario }[]));
    }
  }, [rolActual]);

  useEffect(() => {
    if (!clienteQuery.trim() || clienteSeleccionado) return;
    const timeout = setTimeout(() => {
      buscarClientes(clienteQuery.trim()).then((res) => setResultados(res.data));
    }, 300);
    return () => clearTimeout(timeout);
  }, [clienteQuery, clienteSeleccionado]);

  useEffect(() => {
    if (!clienteSeleccionado) {
      setLealtad(null);
      return;
    }
    progresoLealtadCliente(clienteSeleccionado.id).then((res) => setLealtad(res.data));
  }, [clienteSeleccionado]);

  function seleccionarCliente(c: ClienteResultado) {
    setClienteSeleccionado(c);
    setClienteQuery(c.nombre);
    setResultados([]);
  }

  function limpiarCliente() {
    setClienteSeleccionado(null);
    setClienteQuery("");
    setNuevoClienteNombre("");
    setNuevoClienteTelefono("");
    setCreandoClienteNuevo(false);
    setResultados([]);
    setLealtad(null);
  }

  function handleSubmit() {
    setError(null);

    if (!servicioId) {
      setError("Selecciona un servicio.");
      return;
    }
    if (!empleadoId) {
      setError("Selecciona el empleado que realizará el servicio.");
      return;
    }
    if (creandoClienteNuevo && !nuevoClienteNombre.trim()) {
      setError("Ingresa el nombre del cliente nuevo.");
      return;
    }

    startTransition(async () => {
      let clienteId: string | null = clienteSeleccionado?.id ?? null;

      if (!clienteId && creandoClienteNuevo && nuevoClienteNombre.trim()) {
        const res = await crearCliente(nuevoClienteNombre.trim(), nuevoClienteTelefono.trim() || null);
        if (res.error || !res.data) {
          setError(res.error ?? "No se pudo crear el cliente.");
          return;
        }
        clienteId = res.data.id;
      }

      let vehiculoId: string | null = null;
      if (clienteId && placas.trim()) {
        const res = await crearVehiculo(clienteId, placas.trim() || null, nombreTamano(tamanoVehiculo));
        if (res.error) {
          setError(res.error);
          return;
        }
        vehiculoId = res.data?.id ?? null;
      }

      const result = await crearTicket({
        clienteId,
        vehiculoId,
        servicioId,
        tamanoVehiculo,
        empleadoId,
        turnoId,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Nuevo ticket</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Cliente */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Cliente (opcional)</label>
            {clienteSeleccionado ? (
              <div className="flex items-center justify-between rounded-lg border border-accent/40 bg-accent/10 px-3 py-2">
                <span className="text-sm text-foreground">{clienteSeleccionado.nombre}</span>
                <button onClick={limpiarCliente} className="text-xs text-muted hover:text-foreground">
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <input
                  value={clienteQuery}
                  onChange={(e) => {
                    setClienteQuery(e.target.value);
                    setCreandoClienteNuevo(false);
                    if (!e.target.value.trim()) setResultados([]);
                  }}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  placeholder="Buscar cliente por nombre..."
                />
                {resultados.length > 0 && (
                  <div className="rounded-lg border border-border bg-background">
                    {resultados.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => seleccionarCliente(c)}
                        className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                      >
                        {c.nombre} {c.telefono ? `· ${c.telefono}` : ""}
                      </button>
                    ))}
                  </div>
                )}
                {clienteQuery.trim() && resultados.length === 0 && !creandoClienteNuevo && (
                  <button
                    onClick={() => {
                      setCreandoClienteNuevo(true);
                      setNuevoClienteNombre(clienteQuery.trim());
                    }}
                    className="self-start text-xs text-accent hover:underline"
                  >
                    + Crear cliente nuevo &quot;{clienteQuery.trim()}&quot;
                  </button>
                )}
                {creandoClienteNuevo && (
                  <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
                    <input
                      value={nuevoClienteNombre}
                      onChange={(e) => setNuevoClienteNombre(e.target.value)}
                      placeholder="Nombre del cliente"
                      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                    />
                    <input
                      value={nuevoClienteTelefono}
                      onChange={(e) => setNuevoClienteTelefono(e.target.value)}
                      placeholder="Teléfono (opcional)"
                      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Programa de lealtad */}
          {lealtad && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                lealtad.proximaGratis
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-border bg-background text-muted"
              }`}
            >
              {lealtad.proximaGratis
                ? "¡Esta será su 6ta lavada — sale gratis!"
                : `Lleva ${lealtad.lavadasEnCiclo} de 6 lavadas en su ciclo actual.`}
            </div>
          )}

          {/* Vehículo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Placas (opcional)</label>
              <input
                value={placas}
                onChange={(e) => setPlacas(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Tamaño de vehículo</label>
              <select
                value={tamanoVehiculo}
                onChange={(e) => setTamanoVehiculo(e.target.value as TamanoVehiculo)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              >
                {TAMANOS_VEHICULO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Servicio */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Servicio</label>
            <select
              value={servicioId}
              onChange={(e) => setServicioId(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} · ${precioPorTamano(s.precios, tamanoVehiculo).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {/* Empleado */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Empleado asignado</label>
            {rolActual === "cajero" ? (
              <p className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted">
                Tú (se asigna automáticamente)
              </p>
            ) : (
              <select
                value={empleadoId}
                onChange={(e) => setEmpleadoId(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              >
                {empleados.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={pending}
            className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
          >
            {pending ? "Creando..." : "Crear ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}
