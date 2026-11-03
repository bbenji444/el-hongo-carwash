"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { GastoCategoria } from "@/types/database.types";
import { CATEGORIAS_GASTO, nombreCategoriaGasto } from "@/lib/gastoCategorias";
import {
  crearOpcionGasto,
  actualizarOpcionGasto,
  toggleActivoOpcionGasto,
  eliminarOpcionGasto,
} from "./gastoOpcionesActions";

type Opcion = { id: string; nombre: string; activo: boolean; categoria: GastoCategoria | null };

// Nómina no lleva opciones aquí: sus "opciones" son los trabajadores, que se
// administran en la sección Trabajadores.
const CATEGORIAS_CON_OPCIONES = CATEGORIAS_GASTO.filter((c) => c.value !== "nomina");

const inputClass =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export function GastoOpcionesManager({ opciones }: { opciones: Opcion[] }) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState<GastoCategoria>("insumos");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function abrirNuevo(cat: GastoCategoria = "insumos") {
    setEditandoId(null);
    setNombre("");
    setCategoria(cat);
    setError(null);
    setMostrarForm(true);
  }

  function abrirEdicion(o: Opcion) {
    setEditandoId(o.id);
    setNombre(o.nombre);
    setCategoria(o.categoria ?? "insumos");
    setError(null);
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
      const input = { nombre: nombre.trim(), categoria };
      const result = editandoId ? await actualizarOpcionGasto(editandoId, input) : await crearOpcionGasto(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMostrarForm(false);
      setEditandoId(null);
      setNombre("");
    });
  }

  function handleToggle(o: Opcion) {
    setError(null);
    startTransition(async () => {
      const result = await toggleActivoOpcionGasto(o.id, !o.activo);
      if (result.error) setError(result.error);
    });
  }

  function handleEliminar(o: Opcion) {
    if (!window.confirm(`¿Eliminar la opción "${o.nombre}"? Esta acción no se puede deshacer.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await eliminarOpcionGasto(o.id);
      if (result.error) setError(result.error);
    });
  }

  const sinCategoria = opciones.filter((o) => o.categoria === null);
  const grupos: { value: GastoCategoria | null; label: string; items: Opcion[] }[] = [
    ...CATEGORIAS_CON_OPCIONES.map((c) => ({
      value: c.value,
      label: c.label,
      items: opciones.filter((o) => o.categoria === c.value),
    })),
    ...(sinCategoria.length > 0 ? [{ value: null, label: "Sin categoría (aparecen en todas)", items: sinCategoria }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        {!mostrarForm ? (
          <button
            type="button"
            onClick={() => abrirNuevo()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/25"
          >
            + Nueva opción
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Nombre</label>
                <input
                  autoFocus
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Fabuloso"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Categoría</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as GastoCategoria)}
                  className={inputClass}
                >
                  {CATEGORIAS_CON_OPCIONES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
              >
                {pending ? "Guardando..." : editandoId ? "Guardar" : "Agregar"}
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {grupos.map((g) => (
          <div key={g.value ?? "sin"} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                {g.label} <span className="font-normal text-muted">({g.items.length})</span>
              </p>
              {g.value && (
                <button
                  type="button"
                  onClick={() => abrirNuevo(g.value!)}
                  className="text-xs text-accent hover:underline"
                >
                  + Agregar aquí
                </button>
              )}
            </div>
            {g.items.length === 0 && <p className="text-xs text-muted">Sin opciones todavía.</p>}
            <ul className="flex flex-col divide-y divide-border">
              {g.items.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <span className={o.activo ? "text-foreground" : "text-muted line-through"}>{o.nombre}</span>
                  <div className="flex shrink-0 gap-3 text-xs">
                    <button type="button" onClick={() => abrirEdicion(o)} className="text-accent hover:underline">
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(o)}
                      disabled={pending}
                      className="text-muted hover:text-foreground disabled:opacity-60"
                    >
                      {o.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEliminar(o)}
                      disabled={pending}
                      className="text-primary hover:underline disabled:opacity-60"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted">
        Las opciones de {nombreCategoriaGasto("nomina")} son los trabajadores — se administran en la sección
        Trabajadores. Una opción desactivada deja de aparecer al registrar gastos, pero los gastos que ya la usan la
        conservan.
      </p>
    </div>
  );
}
