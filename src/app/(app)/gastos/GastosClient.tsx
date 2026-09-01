"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { crearGasto, actualizarGasto, eliminarGasto, subirArchivoGasto, obtenerUrlArchivoGasto } from "./actions";

type Gasto = {
  id: string;
  concepto: string;
  monto: number;
  fecha: string;
  notas: string | null;
  archivoNombre: string | null;
  creadoPor: string;
};

type ArchivoVista = {
  url: string;
  nombre: string | null;
  tipo: string | null;
  previsualizable: boolean;
};

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function fechaInput(iso: string) {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

// El navegador a veces no reporta bien el tipo de un HEIC/HEIF (algunos
// celulares mandan "" o "application/octet-stream"), así que además del
// mime revisamos la extensión del nombre del archivo.
function esHeic(archivo: File) {
  return archivo.type === "image/heic" || archivo.type === "image/heif" || /\.hei[cf]$/i.test(archivo.name);
}

// Convierte HEIC/HEIF a JPEG en el navegador antes de subirlo, para que se
// pueda previsualizar (ningún navegador muestra HEIC directo). Se hace del
// lado del cliente para no depender de librerías nativas en el servidor.
async function convertirSiEsHeic(archivo: File): Promise<File> {
  if (!esHeic(archivo)) return archivo;
  const heic2any = (await import("heic2any")).default;
  const resultado = await heic2any({ blob: archivo, toType: "image/jpeg", quality: 0.85 });
  const jpegBlob = Array.isArray(resultado) ? resultado[0] : resultado;
  const nuevoNombre = archivo.name.replace(/\.hei[cf]$/i, ".jpg");
  return new File([jpegBlob], nuevoNombre, { type: "image/jpeg" });
}

const emptyForm = { concepto: "", monto: "", fecha: fechaInput(new Date().toISOString()), notas: "" };

export function GastosClient({ gastos }: { gastos: Gasto[] }) {
  const [form, setForm] = useState(emptyForm);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [convirtiendo, setConvirtiendo] = useState(false);
  const [verArchivoPendiente, setVerArchivoPendiente] = useState<string | null>(null);
  const [archivoVista, setArchivoVista] = useState<ArchivoVista | null>(null);
  const archivoInputRef = useRef<HTMLInputElement>(null);

  function abrirNuevo() {
    setEditandoId(null);
    setForm(emptyForm);
    setError(null);
    setMostrarForm(true);
  }

  function abrirEdicion(g: Gasto) {
    setEditandoId(g.id);
    setForm({
      concepto: g.concepto,
      monto: String(g.monto),
      fecha: fechaInput(g.fecha),
      notas: g.notas ?? "",
    });
    setError(null);
    setMostrarForm(true);
  }

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

    const datosGasto = {
      concepto: form.concepto.trim(),
      monto,
      fecha: new Date(`${form.fecha}T12:00:00`).toISOString(),
      notas: form.notas.trim() || null,
    };

    if (editandoId) {
      startTransition(async () => {
        const result = await actualizarGasto(editandoId, datosGasto);
        if (result.error) {
          setError(result.error);
          return;
        }
        setForm(emptyForm);
        setEditandoId(null);
        setMostrarForm(false);
      });
      return;
    }

    const archivoOriginal = archivoInputRef.current?.files?.[0] ?? null;

    startTransition(async () => {
      let archivo = archivoOriginal;
      if (archivo && esHeic(archivo)) {
        setConvirtiendo(true);
        try {
          archivo = await convertirSiEsHeic(archivo);
        } catch {
          setConvirtiendo(false);
          setError("No se pudo convertir la foto HEIC. Intenta guardarla como JPG desde tu celular y subirla de nuevo.");
          return;
        }
        setConvirtiendo(false);
      }

      const result = await crearGasto(datosGasto);
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
    setVerArchivoPendiente(id);
    obtenerUrlArchivoGasto(id).then((result) => {
      setVerArchivoPendiente(null);
      if (result.error || !result.data) {
        setError(result.error ?? "No se pudo abrir el archivo.");
        return;
      }
      setArchivoVista(result.data);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        {!mostrarForm ? (
          <button
            onClick={abrirNuevo}
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
              {!editandoId && (
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
                    después. Si tu celular guarda fotos en HEIC, se convierte automáticamente a JPG al guardar
                    para que se pueda previsualizar.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
              >
                {convirtiendo
                  ? "Convirtiendo foto..."
                  : pending
                    ? "Guardando..."
                    : editandoId
                      ? "Guardar cambios"
                      : "Guardar gasto"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarForm(false);
                  setEditandoId(null);
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
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => abrirEdicion(g)}
                      className="text-xs text-accent hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleEliminar(g.id)}
                      disabled={pending}
                      className="text-xs text-primary hover:underline disabled:opacity-60"
                    >
                      Eliminar
                    </button>
                  </div>
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

      {archivoVista && (
        <div
          className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setArchivoVista(null)}
        >
          <div
            className="animate-modal flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium text-foreground">{archivoVista.nombre ?? "Archivo"}</p>
              <button onClick={() => setArchivoVista(null)} className="text-muted hover:text-foreground">
                ✕
              </button>
            </div>

            {archivoVista.previsualizable && archivoVista.tipo?.startsWith("image/") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={archivoVista.url}
                alt={archivoVista.nombre ?? "Archivo adjunto"}
                className="max-h-[65vh] w-full rounded-lg object-contain"
              />
            )}

            {archivoVista.previsualizable && archivoVista.tipo === "application/pdf" && (
              <iframe src={archivoVista.url} className="h-[65vh] w-full rounded-lg border border-border" />
            )}

            {!archivoVista.previsualizable && (
              <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                Este formato no se puede previsualizar en el navegador
                {archivoVista.tipo?.includes("heic") || archivoVista.tipo?.includes("heif")
                  ? " (HEIC/HEIF, el formato nativo de fotos del iPhone)"
                  : ""}
                . Descárgalo para verlo.
              </p>
            )}

            <a
              href={archivoVista.url}
              download={archivoVista.nombre ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit rounded-lg border border-border px-4 py-2 text-sm text-foreground transition hover:bg-surface-hover"
            >
              ⬇ Descargar
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
