"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { crearGasto, eliminarGasto, subirArchivoGasto, obtenerUrlArchivoGasto } from "./actions";

type Gasto = {
  id: string;
  concepto: string;
  monto: number;
  fecha: string;
  notas: string | null;
  archivoNombre: string | null;
  creadoPor: string;
};

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function hoyInput() {
  const hoy = new Date();
  const offset = hoy.getTimezoneOffset();
  return new Date(hoy.getTime() - offset * 60000).toISOString().slice(0, 10);
}

const emptyForm = { concepto: "", monto: "", fecha: hoyInput(), notas: "" };

export function GastosClient({ gastos }: { gastos: Gasto[] }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [verArchivoPendiente, setVerArchivoPendiente] = useState<string | null>(null);
  const archivoInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.concepto.trim()) {
      setError("Escribe el concepto del gasto (ej. Sueldos, Insumos).");
      return;
    }
    const monto = Number(form.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      setError("Ingresa un monto válido.");
      return;
    }
    if (!form.fecha) {
      setError("Selecciona una fecha.");
      return;
    }

    const archivo = archivoInputRef.current?.files?.[0] ?? null;

    startTransition(async () => {
      const result = await crearGasto({
        concepto: form.concepto.trim(),
        monto,
        fecha: new Date(`${form.fecha}T12:00:00`).toISOString(),
        notas: form.notas.trim() || null,
      });
      if (result.error || !result.data) {
        setError(result.error ?? "No se pudo guardar el gasto.");
        return;
      }

      if (archivo) {
        const datosArchivo = new FormData();
        datosArchivo.set("archivo", archivo);
        const resultArchivo = await subirArchivoGasto(result.data.id, datosArchivo);
        if (resultArchivo.error) {
          setError(`El gasto se guardó, pero el archivo no se pudo subir: ${resultArchivo.error}`);
          setForm(emptyForm);
          if (archivoInputRef.current) archivoInputRef.current.value = "";
          return;
        }
      }

      setForm(emptyForm);
      if (archivoInputRef.current) archivoInputRef.current.value = "";
      setMostrarForm(false);
    });
  }

  function handleEliminar(id: string) {
    if (!window.confirm("¿Eliminar este gasto? Esta acción no se puede deshacer (borra también su archivo adjunto, si tiene).")) return;
    setError(null);
    startTransition(async () => {
      const result = await eliminarGasto(id);
      if (result.error) setError(result.error);
    });
  }

  function handleVerArchivo(id: string) {
    setError(null);
    // La pestaña se abre YA (en blanco), en el mismo instante del clic —
    // en celular (sobre todo iOS), si se abre hasta que responde el
    // servidor, el navegador ya no lo asocia con el toque del usuario y lo
    // bloquea como pop-up sin avisar. Así conserva el permiso y solo se le
    // pone la URL real cuando ya se tiene.
    const ventana = window.open("", "_blank", "noopener,noreferrer");
    setVerArchivoPendiente(id);
    obtenerUrlArchivoGasto(id).then((result) => {
      setVerArchivoPendiente(null);
      if (result.error || !result.data) {
        setError(result.error ?? "No se pudo abrir el archivo.");
        ventana?.close();
        return;
      }
      if (ventana) {
        ventana.location.href = result.data;
      } else {
        window.location.href = result.data;
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        {!mostrarForm ? (
          <button
            onClick={() => setMostrarForm(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            + Nuevo gasto
          </button>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Concepto</label>
                <input
                  value={form.concepto}
                  onChange={(e) => setForm((f) => ({ ...f, concepto: e.target.value }))}
                  placeholder="Ej. Sueldos, Insumos, Luz"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Monto</label>
                <input
                  value={form.monto}
                  onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Fecha</label>
                <input
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                  type="date"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Notas (opcional)</label>
                <input
                  value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted">Añadir archivo (opcional)</label>
                <input
                  ref={archivoInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none file:mr-3 file:rounded-md file:border-0 file:bg-accent/15 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent"
                />
                <p className="text-[11px] text-muted">
                  Foto o PDF del ticket de compra — captura solo el total ahora y consulta el detalle completo
                  después.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
              >
                {pending ? "Guardando..." : "Guardar gasto"}
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

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Concepto</th>
              <th className="px-4 py-3">Notas</th>
              <th className="px-4 py-3">Registró</th>
              <th className="px-4 py-3">Archivo</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {gastos.map((g) => (
              <tr key={g.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                <td className="px-4 py-3 text-muted">{new Date(g.fecha).toLocaleDateString("es-MX")}</td>
                <td className="px-4 py-3 text-foreground">{g.concepto}</td>
                <td className="px-4 py-3 text-muted">{g.notas ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{g.creadoPor}</td>
                <td className="px-4 py-3">
                  {g.archivoNombre ? (
                    <button
                      onClick={() => handleVerArchivo(g.id)}
                      disabled={verArchivoPendiente === g.id}
                      className="text-xs text-accent hover:underline disabled:opacity-60"
                    >
                      {verArchivoPendiente === g.id ? "Abriendo..." : "Ver archivo"}
                    </button>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-primary">{money(g.monto)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleEliminar(g.id)}
                    disabled={pending}
                    className="text-xs text-primary hover:underline disabled:opacity-60"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {gastos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  Sin gastos registrados en este período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
