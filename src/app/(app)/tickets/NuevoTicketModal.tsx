"use client";

import { useEffect, useState, useTransition } from "react";
import type { TamanoVehiculo, Lavador, ConfiguracionApp, ExtraCatalogo } from "@/types/database.types";
import { TAMANOS_VEHICULO, nombreTamano, precioPorTamano } from "@/lib/servicios";
import { emojiPorTamano } from "@/lib/configuracionDefaults";
import type { ServicioConPrecios } from "./types";
import { BotonSeleccion } from "./BotonSeleccion";
import { buscarClientes, crearCliente, crearTicket, progresoLealtadCliente } from "./actions";
import { obtenerOCrearVehiculo, buscarClientePorPlaca } from "../clientes/actions";

type ClienteResultado = { id: string; nombre: string; telefono: string | null };
type LealtadInfo = { lavadasEnCiclo: number; proximaGratis: boolean; ultimaLavada: string | null };

export function NuevoTicketModal({
  turnoId,
  servicios,
  lavadores,
  extras,
  enProcesoPorLavador,
  config,
  usuarioActualId,
  onClose,
}: {
  turnoId: string;
  servicios: ServicioConPrecios[];
  lavadores: Lavador[];
  extras: ExtraCatalogo[];
  enProcesoPorLavador: Record<string, number>;
  config: ConfiguracionApp;
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

  const [distintivo, setDistintivo] = useState("");
  const [placa, setPlaca] = useState("");
  const [placaAutocompleto, setPlacaAutocompleto] = useState(false);
  const [tamanoVehiculo, setTamanoVehiculo] = useState<TamanoVehiculo>("automovil");

  const [servicioId, setServicioId] = useState(servicios[0]?.id ?? "");
  const [lavadorId, setLavadorId] = useState("");
  const [extraIds, setExtraIds] = useState<string[]>([]);

  function toggleExtra(id: string) {
    setExtraIds((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  const [lealtad, setLealtad] = useState<LealtadInfo | null>(null);

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

  // Autocompletado por placa: si ya está registrada a nombre de un cliente,
  // se selecciona solo (sin tener que buscarlo por nombre) y se prellena el
  // distintivo con el tipo de vehículo guardado, si aún no se había escrito.
  useEffect(() => {
    if (clienteSeleccionado || creandoClienteNuevo || !placa.trim()) {
      return;
    }
    const timeout = setTimeout(() => {
      buscarClientePorPlaca(placa.trim()).then((res) => {
        if (!res.data) return;
        setClienteSeleccionado(res.data.cliente);
        setClienteQuery(res.data.cliente.nombre);
        setPlacaAutocompleto(true);
        if (res.data.tipoVehiculo) {
          setDistintivo((actual) => (actual.trim() ? actual : res.data!.tipoVehiculo!));
        }
      });
    }, 400);
    return () => clearTimeout(timeout);
  }, [placa, clienteSeleccionado, creandoClienteNuevo]);

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
    setPlaca("");
    setPlacaAutocompleto(false);
  }

  function handleSubmit() {
    setError(null);

    if (!servicioId) {
      setError("Selecciona un paquete.");
      return;
    }
    if (!lavadorId) {
      setError("Selecciona quién va a lavar el auto.");
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
      if (clienteId && placa.trim()) {
        const res = await obtenerOCrearVehiculo({
          clienteId,
          placas: placa.trim(),
          tipoVehiculo: nombreTamano(tamanoVehiculo),
        });
        if (res.error) {
          setError(res.error);
          return;
        }
        vehiculoId = res.data?.id ?? null;
      }

      const result = await crearTicket({
        clienteId,
        vehiculoId,
        distintivo: distintivo.trim() || null,
        placa: placa.trim() || null,
        servicioId,
        tamanoVehiculo,
        empleadoId: usuarioActualId,
        lavadorId,
        turnoId,
        extraIds,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      onClose();
    });
  }

  return (
    <div className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="animate-modal max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-6">
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

          {/* Distintivo y placa */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Distintivo (opcional)</label>
              <input
                value={distintivo}
                onChange={(e) => setDistintivo(e.target.value)}
                placeholder="Ej. Jetta negro"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Placa (opcional)</label>
              <input
                value={placa}
                onChange={(e) => {
                  setPlaca(e.target.value);
                  setPlacaAutocompleto(false);
                }}
                placeholder="Ej. ABC-123"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
              {placaAutocompleto && (
                <p className="text-[11px] text-success">✓ Cliente encontrado por esta placa</p>
              )}
            </div>
          </div>

          {/* Tamaño de vehículo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Tamaño de vehículo</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {TAMANOS_VEHICULO.map((t) => (
                <BotonSeleccion
                  key={t.value}
                  seleccionado={tamanoVehiculo === t.value}
                  onClick={() => setTamanoVehiculo(t.value)}
                >
                  <span className="text-xl">{emojiPorTamano(config, t.value)}</span>
                  <span className="text-[11px] leading-tight">{t.label}</span>
                </BotonSeleccion>
              ))}
            </div>
          </div>

          {/* Servicio */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Paquete</label>
            <div className="grid grid-cols-2 gap-2">
              {servicios.map((s) => (
                <BotonSeleccion key={s.id} seleccionado={servicioId === s.id} onClick={() => setServicioId(s.id)}>
                  <span className="flex items-center gap-1 text-sm font-medium">
                    {s.destacado && <span title="Destacado">⭐</span>}
                    {s.nombre}
                  </span>
                  <span className="text-xs">${precioPorTamano(s.precios, tamanoVehiculo).toFixed(2)}</span>
                </BotonSeleccion>
              ))}
              {servicios.length === 0 && (
                <p className="col-span-2 text-sm text-muted">No hay paquetes activos en el catálogo.</p>
              )}
            </div>
          </div>

          {/* Extras */}
          {extras.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">+ Extra (opcional)</label>
              <div className="grid grid-cols-2 gap-2">
                {extras.map((extra) => (
                  <BotonSeleccion
                    key={extra.id}
                    seleccionado={extraIds.includes(extra.id)}
                    onClick={() => toggleExtra(extra.id)}
                  >
                    <span className="text-sm font-medium">{extra.nombre}</span>
                    <span className="text-xs">${extra.precio.toFixed(2)}</span>
                  </BotonSeleccion>
                ))}
              </div>
            </div>
          )}

          {/* Lavador */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Lavador</label>
            <div className="grid grid-cols-3 gap-2">
              {lavadores.map((l) => {
                const enProceso = enProcesoPorLavador[l.id] ?? 0;
                return (
                  <BotonSeleccion key={l.id} seleccionado={lavadorId === l.id} onClick={() => setLavadorId(l.id)}>
                    <span className="text-xl">{config.emoji_lavador}</span>
                    <span className="text-xs font-medium leading-tight">{l.nombre}</span>
                    {enProceso > 0 && <span className="text-[10px] text-warning">{enProceso} en curso</span>}
                  </BotonSeleccion>
                );
              })}
              {lavadores.length === 0 && (
                <p className="col-span-3 text-sm text-muted">
                  No hay lavadores registrados. Agrega uno en la sección Lavadores.
                </p>
              )}
            </div>
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
