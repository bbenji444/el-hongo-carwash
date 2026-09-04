"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import {
  crearGasto,
  actualizarGasto,
  eliminarGasto,
  subirArchivoGasto,
  eliminarArchivoGasto,
  obtenerUrlArchivoGasto,
  agregarGastoItem,
  actualizarGastoItem,
  eliminarGastoItem,
} from "./actions";

type GastoArchivo = { id: string; nombre: string; tipo: string | null };
type GastoItem = { id: string; producto: string; cantidad: number; precioUnitario: number };

type Gasto = {
  id: string;
  concepto: string;
  monto: number;
  fecha: string;
  notas: string | null;
  creadoPor: string;
  archivos: GastoArchivo[];
  items: GastoItem[];
};

type ArchivoVista = {
  url: string;
  nombre: string | null;
  tipo: string | null;
  previsualizable: boolean;
};

type ItemForm = { key: string; id: string | null; producto: string; cantidad: string; precioUnitario: string };

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

// Las fotos de cámaras de celulares modernos (sobre todo Android de gama
// alta, 50-200MP) pueden pesar 20-50MB+, muy por encima de lo que acepta el
// servidor — eso hacía que la subida fallara en silencio (se veía como un
// error de conexión, no un error de la app). Se reducen a un tamaño
// razonable para leer un ticket antes de subirlas.
const TAMANO_MAX_LADO_PX = 1920;
const CALIDAD_JPEG = 0.82;
async function comprimirImagen(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/")) return archivo;
  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, TAMANO_MAX_LADO_PX / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.max(1, Math.round(bitmap.width * escala));
    const alto = Math.max(1, Math.round(bitmap.height * escala));

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) return archivo;
    ctx.drawImage(bitmap, 0, 0, ancho, alto);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", CALIDAD_JPEG));
    if (!blob || blob.size >= archivo.size) return archivo;

    const nuevoNombre = archivo.name.replace(/\.[^.]+$/, ".jpg");
    return new File([blob], nuevoNombre, { type: "image/jpeg" });
  } catch {
    // Si algo falla comprimiendo (formato raro, navegador viejo, etc.), se
    // sube el original tal cual — mejor eso que bloquear la subida entera.
    return archivo;
  }
}

async function prepararArchivo(archivo: File): Promise<File> {
  const convertido = await convertirSiEsHeic(archivo);
  return comprimirImagen(convertido);
}

function nuevoRenglonItem(): ItemForm {
  return { key: crypto.randomUUID(), id: null, producto: "", cantidad: "1", precioUnitario: "" };
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
  const [itemsVista, setItemsVista] = useState<{ concepto: string; items: GastoItem[] } | null>(null);
  const archivoInputRef = useRef<HTMLInputElement>(null);
  const editArchivoInputRef = useRef<HTMLInputElement>(null);

  const [itemsForm, setItemsForm] = useState<ItemForm[]>([]);
  const [itemsOriginalIds, setItemsOriginalIds] = useState<Set<string>>(new Set());
  const [archivosNuevos, setArchivosNuevos] = useState<File[]>([]);
  const [archivosEdit, setArchivosEdit] = useState<GastoArchivo[]>([]);
  const [archivoPendingEdit, setArchivoPendingEdit] = useState(false);

  const tieneItems = itemsForm.some((it) => it.producto.trim() !== "");
  const totalItems = itemsForm.reduce((acc, it) => {
    const c = Number(it.cantidad);
    const p = Number(it.precioUnitario);
    return acc + (Number.isFinite(c) && Number.isFinite(p) ? c * p : 0);
  }, 0);

  function abrirNuevo() {
    setEditandoId(null);
    setForm(emptyForm);
    setItemsForm([]);
    setItemsOriginalIds(new Set());
    setArchivosNuevos([]);
    setArchivosEdit([]);
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
    setItemsForm(
      g.items.map((it) => ({
        key: it.id,
        id: it.id,
        producto: it.producto,
        cantidad: String(it.cantidad),
        precioUnitario: String(it.precioUnitario),
      }))
    );
    setItemsOriginalIds(new Set(g.items.map((it) => it.id)));
    setArchivosNuevos([]);
    setArchivosEdit(g.archivos);
    setError(null);
    setMostrarForm(true);
  }

  function actualizarRenglonItem(key: string, campo: "producto" | "cantidad" | "precioUnitario", valor: string) {
    setItemsForm((f) => f.map((it) => (it.key === key ? { ...it, [campo]: valor } : it)));
  }

  function quitarRenglonItem(key: string) {
    setItemsForm((f) => f.filter((it) => it.key !== key));
  }

  async function handleAgregarArchivoEdit(files: FileList | null) {
    if (!files || files.length === 0 || !editandoId) return;
    setArchivoPendingEdit(true);
    setError(null);
    for (const original of Array.from(files)) {
      let archivo = original;
      try {
        archivo = await prepararArchivo(original);
      } catch {
        setError(`No se pudo procesar "${original.name}". Intenta con otra foto.`);
        continue;
      }
      const datosArchivo = new FormData();
      datosArchivo.set("archivo", archivo);
      const result = await subirArchivoGasto(editandoId, datosArchivo);
      if (result.error || !result.data) {
        setError(result.error ?? `No se pudo subir "${archivo.name}".`);
        continue;
      }
      setArchivosEdit((prev) => [...prev, result.data]);
    }
    setArchivoPendingEdit(false);
    if (editArchivoInputRef.current) editArchivoInputRef.current.value = "";
  }

  function handleEliminarArchivoEdit(archivoId: string) {
    if (!window.confirm("¿Eliminar este archivo?")) return;
    setError(null);
    startTransition(async () => {
      const result = await eliminarArchivoGasto(archivoId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setArchivosEdit((prev) => prev.filter((a) => a.id !== archivoId));
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.concepto.trim()) {
      setError("Escribe el concepto del gasto (ej. Sueldos, Insumos).");
      return;
    }

    const renglones = itemsForm
      .filter((it) => it.producto.trim() !== "")
      .map((it) => ({ ...it, cantidadNum: Number(it.cantidad), precioNum: Number(it.precioUnitario) }));

    for (const it of renglones) {
      if (!Number.isFinite(it.cantidadNum) || it.cantidadNum <= 0) {
        setError(`Ingresa una cantidad válida para "${it.producto}".`);
        return;
      }
      if (!Number.isFinite(it.precioNum) || it.precioNum < 0) {
        setError(`Ingresa un precio válido para "${it.producto}".`);
        return;
      }
    }

    const montoCalculado =
      renglones.length > 0 ? renglones.reduce((acc, it) => acc + it.cantidadNum * it.precioNum, 0) : Number(form.monto);

    if (!Number.isFinite(montoCalculado) || montoCalculado <= 0) {
      setError(renglones.length > 0 ? "Agrega al menos un producto con cantidad y precio." : "Ingresa un monto válido.");
      return;
    }
    if (!form.fecha) {
      setError("Selecciona una fecha.");
      return;
    }

    const datosGasto = {
      concepto: form.concepto.trim(),
      monto: montoCalculado,
      fecha: new Date(`${form.fecha}T12:00:00`).toISOString(),
      notas: form.notas.trim() || null,
    };

    const archivosAsubir = archivosNuevos;

    startTransition(async () => {
      let gastoId = editandoId;

      if (editandoId) {
        const result = await actualizarGasto(editandoId, datosGasto);
        if (result.error) {
          setError(result.error);
          return;
        }
      } else {
        const result = await crearGasto(datosGasto);
        if (result.error || !result.data) {
          setError(result.error ?? "No se pudo guardar el gasto.");
          return;
        }
        gastoId = result.data.id;
      }

      const idsActuales = new Set(renglones.filter((it) => it.id).map((it) => it.id!));
      for (const idOriginal of itemsOriginalIds) {
        if (!idsActuales.has(idOriginal)) {
          await eliminarGastoItem(idOriginal);
        }
      }
      for (const it of renglones) {
        if (it.id) {
          await actualizarGastoItem(it.id, {
            producto: it.producto.trim(),
            cantidad: it.cantidadNum,
            precioUnitario: it.precioNum,
          });
        } else {
          await agregarGastoItem(gastoId!, {
            producto: it.producto.trim(),
            cantidad: it.cantidadNum,
            precioUnitario: it.precioNum,
          });
        }
      }

      if (!editandoId && archivosAsubir.length > 0) {
        setConvirtiendo(true);
        for (const original of archivosAsubir) {
          let archivo = original;
          try {
            archivo = await prepararArchivo(original);
          } catch {
            setError(`El gasto se guardó, pero "${original.name}" no se pudo procesar.`);
            continue;
          }
          const datosArchivo = new FormData();
          datosArchivo.set("archivo", archivo);
          const resultArchivo = await subirArchivoGasto(gastoId!, datosArchivo);
          if (resultArchivo.error) {
            setError(`El gasto se guardó, pero "${archivo.name}" no se pudo subir: ${resultArchivo.error}`);
          }
        }
        setConvirtiendo(false);
      }

      setForm(emptyForm);
      setItemsForm([]);
      setItemsOriginalIds(new Set());
      setArchivosNuevos([]);
      setArchivosEdit([]);
      setEditandoId(null);
      if (archivoInputRef.current) archivoInputRef.current.value = "";
      setMostrarForm(false);
    });
  }

  function handleEliminar(id: string) {
    if (!window.confirm("¿Eliminar este gasto? Esta acción no se puede deshacer (borra también sus archivos y productos adjuntos, si tiene).")) return;
    setError(null);
    startTransition(async () => {
      const result = await eliminarGasto(id);
      if (result.error) setError(result.error);
    });
  }

  function handleVerArchivo(archivoId: string) {
    setError(null);
    setVerArchivoPendiente(archivoId);
    obtenerUrlArchivoGasto(archivoId).then((result) => {
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
                  value={tieneItems ? totalItems.toFixed(2) : form.monto}
                  onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={tieneItems}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent disabled:opacity-60"
                />
                {tieneItems && <p className="text-[11px] text-muted">Se calcula solo de los productos de abajo.</p>}
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
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted">Productos de la compra — orden de compra (opcional)</label>
                  <button
                    type="button"
                    onClick={() => setItemsForm((f) => [...f, nuevoRenglonItem()])}
                    className="text-xs text-accent hover:underline"
                  >
                    + Agregar producto
                  </button>
                </div>
                {itemsForm.length > 0 && (
                  <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
                    {itemsForm.map((it) => (
                      <div key={it.key} className="grid grid-cols-[1fr_64px_84px_auto] items-center gap-2">
                        <input
                          value={it.producto}
                          onChange={(e) => actualizarRenglonItem(it.key, "producto", e.target.value)}
                          placeholder="Producto (ej. Fibras)"
                          className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
                        />
                        <input
                          value={it.cantidad}
                          onChange={(e) => actualizarRenglonItem(it.key, "cantidad", e.target.value)}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Cant."
                          className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
                        />
                        <input
                          value={it.precioUnitario}
                          onChange={(e) => actualizarRenglonItem(it.key, "precioUnitario", e.target.value)}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Precio c/u"
                          className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={() => quitarRenglonItem(it.key)}
                          className="text-muted hover:text-primary"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <p className="text-right text-xs font-medium text-foreground">Total productos: {money(totalItems)}</p>
                  </div>
                )}
                <p className="text-[11px] text-muted">
                  Útil cuando compras varios insumos en un solo ticket: agrega cada producto por separado (con
                  cantidad y precio) en vez de registrar un gasto por cada uno — el monto se calcula solo y todo
                  queda en un mismo registro.
                </p>
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted">
                  {editandoId ? "Archivos adjuntos" : "Añadir archivo(s) (opcional)"}
                </label>

                {editandoId ? (
                  <div className="flex flex-col gap-1.5">
                    {archivosEdit.length > 0 ? (
                      <ul className="flex flex-col gap-1">
                        {archivosEdit.map((a) => (
                          <li
                            key={a.id}
                            className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
                          >
                            <span className="truncate text-foreground">{a.nombre}</span>
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => handleVerArchivo(a.id)}
                                disabled={verArchivoPendiente === a.id}
                                className="text-accent hover:underline disabled:opacity-60"
                              >
                                {verArchivoPendiente === a.id ? "Abriendo..." : "Ver"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEliminarArchivoEdit(a.id)}
                                className="text-primary hover:underline"
                              >
                                Eliminar
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted">Sin archivos adjuntos.</p>
                    )}
                    <input
                      ref={editArchivoInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      disabled={archivoPendingEdit}
                      onChange={(e) => handleAgregarArchivoEdit(e.target.files)}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none file:mr-3 file:rounded-md file:border-0 file:bg-accent/15 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent disabled:opacity-60"
                    />
                    {archivoPendingEdit && <p className="text-[11px] text-muted">Subiendo...</p>}
                  </div>
                ) : (
                  <>
                    <input
                      ref={archivoInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      onChange={(e) => setArchivosNuevos(Array.from(e.target.files ?? []))}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none file:mr-3 file:rounded-md file:border-0 file:bg-accent/15 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent"
                    />
                    {archivosNuevos.length > 0 && (
                      <ul className="flex flex-col gap-1">
                        {archivosNuevos.map((f, i) => (
                          <li
                            key={`${f.name}-${i}`}
                            className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
                          >
                            <span className="truncate text-foreground">{f.name}</span>
                            <button
                              type="button"
                              onClick={() => setArchivosNuevos((prev) => prev.filter((_, idx) => idx !== i))}
                              className="shrink-0 text-primary hover:underline"
                            >
                              Quitar
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-[11px] text-muted">
                      Foto(s) o PDF del ticket de compra — puedes subir varias a la vez. Las fotos se optimizan
                      solas antes de subir (se reduce su tamaño, incluso si tu celular las guarda en HEIC) para
                      que carguen rápido y no fallen por ser muy pesadas.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
              >
                {convirtiendo
                  ? "Optimizando foto(s)..."
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
                <td className="px-4 py-3 text-foreground">
                  {g.concepto}
                  {g.items.length > 0 && (
                    <button
                      onClick={() => setItemsVista({ concepto: g.concepto, items: g.items })}
                      className="block text-[11px] text-accent hover:underline"
                    >
                      🧾 {g.items.length} producto{g.items.length > 1 ? "s" : ""}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{g.notas ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{g.creadoPor}</td>
                <td className="px-4 py-3">
                  {g.archivos.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      {g.archivos.map((a, i) => (
                        <button
                          key={a.id}
                          onClick={() => handleVerArchivo(a.id)}
                          disabled={verArchivoPendiente === a.id}
                          className="text-left text-xs text-accent hover:underline disabled:opacity-60"
                        >
                          {verArchivoPendiente === a.id ? "Abriendo..." : g.archivos.length > 1 ? `Ver archivo ${i + 1}` : "Ver archivo"}
                        </button>
                      ))}
                    </div>
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

      {itemsVista && (
        <div
          className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setItemsVista(null)}
        >
          <div
            className="animate-modal flex max-h-[90vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium text-foreground">Productos — {itemsVista.concepto}</p>
              <button onClick={() => setItemsVista(null)} className="text-muted hover:text-foreground">
                ✕
              </button>
            </div>
            <ul className="flex flex-col gap-1.5 text-sm">
              {itemsVista.items.map((it) => (
                <li key={it.id} className="flex justify-between gap-3 border-b border-border pb-1.5 text-foreground">
                  <span>
                    {it.producto} <span className="text-muted">× {it.cantidad}</span>
                  </span>
                  <span className="font-medium">{money(it.cantidad * it.precioUnitario)}</span>
                </li>
              ))}
            </ul>
            <p className="text-right text-sm font-semibold text-primary">
              Total: {money(itemsVista.items.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0))}
            </p>
          </div>
        </div>
      )}

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
