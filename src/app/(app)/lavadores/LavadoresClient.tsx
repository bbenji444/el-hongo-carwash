"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import type { LavadorStat } from "./data";
import { crearLavador, actualizarLavador, toggleActivoLavador, eliminarLavador } from "./actions";
import type { LavadorTipo } from "@/types/database.types";

const TIPO_LABEL: Record<LavadorTipo, string> = { lavador: "Lavador", encargado: "Encargado" };

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export function LavadoresClient({
  lavadores,
  puedeEditar,
  queryString,
  emojiLavador,
}: {
  lavadores: LavadorStat[];
  puedeEditar: boolean;
  queryString: string;
  emojiLavador: string;
}) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<LavadorTipo>("lavador");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mostrarForm, setMostrarForm] = useState(false);

  function abrirEdicion(lavador: LavadorStat) {
    setEditandoId(lavador.id);
    setNombre(lavador.nombre);
    setTipo(lavador.tipo);
    setMostrarForm(true);
  }

  function abrirNuevo() {
    setEditandoId(null);
    setNombre("");
    setTipo("lavador");
    setMostrarForm(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    startTransition(async () => {
      const result = editandoId
        ? await actualizarLavador(editandoId, nombre.trim(), tipo)
        : await crearLavador(nombre.trim(), tipo);

      if (result.error) {
        setError(result.error);
        return;
      }

      setMostrarForm(false);
      setNombre("");
      setTipo("lavador");
      setEditandoId(null);
    });
  }

  function handleToggle(lavador: LavadorStat) {
    startTransition(async () => {
      await toggleActivoLavador(lavador.id, !lavador.activo);
    });
  }

  function handleEliminar(lavador: LavadorStat) {
    if (!window.confirm(`¿Eliminar a "${lavador.nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await eliminarLavador(lavador.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {puedeEditar && (
        <div>
          {!mostrarForm ? (
            <button
              onClick={abrirNuevo}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/25"
            >
              + Nuevo trabajador
            </button>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-end sm:gap-4"
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Nombre</label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  placeholder="Carlos Ramírez"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Tipo</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as LavadorTipo)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                >
                  <option value="lavador">Lavador</option>
                  <option value="encargado">Encargado</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
                >
                  {editandoId ? "Guardar" : "Crear"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarForm(false);
                    setError(null);
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
          {error && <p className="mt-2 text-sm text-primary">{error}</p>}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Autos lavados</th>
              <th className="px-4 py-3">Ventas generadas</th>
              <th className="px-4 py-3"></th>
              {puedeEditar && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {lavadores.map((l) => (
              <tr key={l.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                <td className="px-4 py-3 font-medium text-foreground">
                  {l.tipo === "lavador" ? emojiLavador : "👔"} {l.nombre}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      l.tipo === "encargado"
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border bg-surface-hover text-muted"
                    }`}
                  >
                    {TIPO_LABEL[l.tipo]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      l.activo
                        ? "border-success/40 bg-success/15 text-success"
                        : "border-muted/40 bg-muted/10 text-muted"
                    }`}
                  >
                    {l.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground">{l.autosLavados}</td>
                <td className="px-4 py-3 text-foreground">{money(l.ventasGeneradas)}</td>
                <td className="px-4 py-3">
                  <Link href={`/lavadores/${l.id}${queryString}`} className="text-xs text-accent hover:underline">
                    Ver desglose →
                  </Link>
                </td>
                {puedeEditar && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => abrirEdicion(l)} className="text-xs text-accent hover:underline">
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggle(l)}
                        disabled={pending}
                        className="text-xs text-muted hover:text-foreground disabled:opacity-60"
                      >
                        {l.activo ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        onClick={() => handleEliminar(l)}
                        disabled={pending}
                        className="text-xs text-primary hover:underline disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {lavadores.length === 0 && (
              <tr>
                <td colSpan={puedeEditar ? 7 : 6} className="px-4 py-6 text-center text-muted">
                  Sin trabajadores registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
