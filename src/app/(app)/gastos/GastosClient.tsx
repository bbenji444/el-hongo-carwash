"use client";

import { useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { GastoCategoria } from "@/types/database.types";
import { CATEGORIAS_GASTO, nombreCategoriaGasto } from "@/lib/gastoCategorias";
import {
  GastosPorCategoriaChart,
  GastosPorSubcategoriaChart,
  GastosPorMesChart,
  NominaPorLavadorChart,
  type GastoPorCategoria,
  type GastoPorSubcategoria,
  type GastoPorMes,
  type GastoPorLavador,
} from "./GastosCharts";
import {
  crearGasto,
  actualizarGasto,
  eliminarGasto,
  crearSubcategoriaGasto,
  subirArchivoGasto,
  eliminarArchivoGasto,
  obtenerUrlArchivoGasto,
  agregarGastoItem,
  actualizarGastoItem,
  eliminarGastoItem,
} from "./actions";

type GastoArchivo = { id: string; nombre: string; tipo: string | null };
type GastoItem = { id: string; producto: string; cantidad: number; precioUnitario: number };
type Subcategoria = { id: string; nombre: string };
type Lavador = { id: string; nombre: string };

type Gasto = {
  id: string;
  concepto: string;
  monto: number;
  fecha: string;
  notas: string | null;
  categoria: GastoCategoria;
  subcategoriaId: string | null;
  subcategoriaNombre: string | null;
  lavadorId: string | null;
  lavadorNombre: string | null;
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

const emptyForm = {
  concepto: "",
  monto: "",
  fecha: fechaInput(new Date().toISOString()),
  notas: "",
  categoria: "otros" as GastoCategoria,
  subcategoriaId: "" as string,
  lavadorId: "" as string,
};

export function GastosClient({
  gastos,
  gastosPorCategoria,
  gastosPorSubcategoria,
  subcategorias,
  lavadores,
  nominaPorLavador,
  gastosPorMes,
}: {
  gastos: Gasto[];
  gastosPorCategoria: GastoPorCategoria[];
  gastosPorSubcategoria: GastoPorSubcategoria[];
  subcategorias: Subcategoria[];
  lavadores: Lavador[];
  nominaPorLavador: GastoPorLavador[];
  gastosPorMes: GastoPorMes[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [categoriaFiltro, setCategoriaFiltro] = useState<GastoCategoria | null>(null);
  const [subcategoriaFiltro, setSubcategoriaFiltro] = useState<string | null>(null);
  const [lavadorFiltro, setLavadorFiltro] = useState<string | null>(null);
  const [subcategoriasLocal, setSubcategoriasLocal] = useState<Subcategoria[]>(subcategorias);
  const [agregandoSubcategoria, setAgregandoSubcategoria] = useState(false);
  const [nuevaSubcategoriaNombre, setNuevaSubcategoriaNombre] = useState("");
  const [guardandoSubcategoria, setGuardandoSubcategoria] = useState(false);

  function alternarFiltroCategoria(categoria: GastoCategoria) {
    setCategoriaFiltro((actual) => (actual === categoria ? null : categoria));
  }

  function alternarFiltroSubcategoria(subcategoriaId: string) {
    setSubcategoriaFiltro((actual) => (actual === subcategoriaId ? null : subcategoriaId));
  }

  function alternarFiltroLavador(lavadorId: string) {
    setLavadorFiltro((actual) => (actual === lavadorId ? null : lavadorId));
  }

  function irAMes(mes: string) {
    const [anio, mesNum] = mes.split("-").map(Number);
    const desde = `${mes}-01`;
    const ultimoDia = new Date(anio, mesNum, 0).getDate();
    const hasta = `${mes}-${String(ultimoDia).padStart(2, "0")}`;
    router.push(`/gastos?desde=${desde}&hasta=${hasta}`);
  }

  // Mismo criterio que usa la gráfica (page.tsx) para "explotar" una compra
  // itemizada sin subcategoría propia: si no tiene subcategoría directa,
  // cuenta como coincidencia si alguno de sus renglones ("productos de la
  // compra") se llama igual que la subcategoría buscada. Sin esto, la
  // gráfica mostraba montos para productos como Teflón (que solo salen de
  // compras mixtas de Dogo, itemizadas) pero el filtro de abajo no
  // encontraba nada, porque solo miraba la subcategoría del gasto, nunca
  // sus renglones.
  const nombrePorSubcategoriaId = useMemo(
    () => new Map(subcategoriasLocal.map((s) => [s.id, s.nombre.trim().toLowerCase()])),
    [subcategoriasLocal]
  );
  // Mismo truco para Nómina: un "Sueldos" semanal normal no trae un
  // lavador puesto directo, trae un renglón por persona — así que el
  // filtro busca también ahí, igual que la gráfica de nómina por lavador.
  const nombrePorLavadorId = useMemo(() => new Map(lavadores.map((l) => [l.id, l.nombre.trim().toLowerCase()])), [lavadores]);

  const gastosFiltrados = useMemo(() => {
    const nombreSubFiltro = subcategoriaFiltro ? nombrePorSubcategoriaId.get(subcategoriaFiltro) : undefined;
    const nombreLavFiltro = lavadorFiltro ? nombrePorLavadorId.get(lavadorFiltro) : undefined;
    return gastos.filter((g) => {
      if (categoriaFiltro && g.categoria !== categoriaFiltro) return false;
      if (lavadorFiltro) {
        const coincideLavador = g.lavadorId
          ? g.lavadorId === lavadorFiltro
          : nombreLavFiltro
            ? g.items.some((it) => it.producto.trim().toLowerCase() === nombreLavFiltro)
            : false;
        if (!coincideLavador) return false;
      }
      if (!subcategoriaFiltro) return true;
      if (g.subcategoriaId) return g.subcategoriaId === subcategoriaFiltro;
      return nombreSubFiltro ? g.items.some((it) => it.producto.trim().toLowerCase() === nombreSubFiltro) : false;
    });
  }, [gastos, categoriaFiltro, subcategoriaFiltro, lavadorFiltro, nombrePorSubcategoriaId, nombrePorLavadorId]);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleAgregarSubcategoria() {
    const nombre = nuevaSubcategoriaNombre.trim();
    if (!nombre) return;
    setGuardandoSubcategoria(true);
    const result = await crearSubcategoriaGasto(nombre);
    setGuardandoSubcategoria(false);
    if (result.error || !result.data) {
      setError(result.error ?? "No se pudo agregar el producto.");
      return;
    }
    setSubcategoriasLocal((prev) =>
      prev.some((s) => s.id === result.data!.id) ? prev : [...prev, result.data!].sort((a, b) => a.nombre.localeCompare(b.nombre))
    );
    setForm((f) => ({ ...f, subcategoriaId: result.data!.id }));
    setNuevaSubcategoriaNombre("");
    setAgregandoSubcategoria(false);
  }

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
    setAgregandoSubcategoria(false);
    setNuevaSubcategoriaNombre("");
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
      categoria: g.categoria,
      subcategoriaId: g.subcategoriaId ?? "",
      lavadorId: g.lavadorId ?? "",
    });
    setAgregandoSubcategoria(false);
    setNuevaSubcategoriaNombre("");
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
      categoria: form.categoria,
      subcategoriaId: form.subcategoriaId || null,
      lavadorId: form.categoria === "nomina" ? form.lavadorId || null : null,
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
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold text-foreground">Gastos por mes (últimos 12 meses)</h2>
        <p className="text-xs text-muted">Clic en un mes para ver el detalle de ese mes abajo.</p>
        <div className="mt-3">
          <GastosPorMesChart data={gastosPorMes} onSeleccionarMes={irAMes} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-foreground">¿En qué se va más el dinero?</h2>
              <p className="text-xs text-muted">Clic en una rebanada para filtrar la tabla de abajo.</p>
            </div>
            {categoriaFiltro && (
              <button
                onClick={() => setCategoriaFiltro(null)}
                className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
              >
                Mostrando: {nombreCategoriaGasto(categoriaFiltro)} ✕
              </button>
            )}
          </div>
          <div className="mt-3">
            <GastosPorCategoriaChart
              data={gastosPorCategoria}
              seleccionada={categoriaFiltro}
              onSeleccionar={alternarFiltroCategoria}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-foreground">¿En qué producto específico se va más?</h2>
              <p className="text-xs text-muted">
                Solo entre los gastos que ya tienen un producto asignado (ej. Shampoo, Abrillantador).
              </p>
            </div>
            {subcategoriaFiltro && (
              <button
                onClick={() => setSubcategoriaFiltro(null)}
                className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20"
              >
                Mostrando: {subcategoriasLocal.find((s) => s.id === subcategoriaFiltro)?.nombre ?? "—"} ✕
              </button>
            )}
          </div>
          <div className="mt-3 max-h-[300px] overflow-y-auto pr-1">
            <GastosPorSubcategoriaChart
              data={gastosPorSubcategoria}
              seleccionada={subcategoriaFiltro}
              onSeleccionar={alternarFiltroSubcategoria}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-success/40 bg-success/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-foreground">¿A quién se le ha pagado cuánto en Nómina?</h2>
            <p className="text-xs text-muted">
              Solo entre los gastos de Nómina de este período que ya tienen un lavador asignado.
            </p>
          </div>
          {lavadorFiltro && (
            <button
              onClick={() => setLavadorFiltro(null)}
              className="rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/20"
            >
              Mostrando: {lavadores.find((l) => l.id === lavadorFiltro)?.nombre ?? "—"} ✕
            </button>
          )}
        </div>
        <div className="mt-3 max-h-[300px] overflow-y-auto pr-1">
          <NominaPorLavadorChart data={nominaPorLavador} seleccionado={lavadorFiltro} onSeleccionar={alternarFiltroLavador} />
        </div>
      </div>

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
                <label className="text-xs font-medium text-muted">Categoría</label>
                <select
                  value={form.categoria}
                  onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value as GastoCategoria }))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                >
                  {CATEGORIAS_GASTO.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              {form.categoria === "nomina" && (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-muted">
                    Lavador (opcional — para poder ver cuánto se le ha pagado a cada quién)
                  </label>
                  <select
                    value={form.lavadorId}
                    onChange={(e) => setForm((f) => ({ ...f, lavadorId: e.target.value }))}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  >
                    <option value="">Sin asignar</option>
                    {lavadores.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted">
                  Producto específico (opcional — para Sueldos, Renta, etc. déjalo en blanco)
                </label>
                {!agregandoSubcategoria ? (
                  <div className="flex gap-2">
                    <select
                      value={form.subcategoriaId}
                      onChange={(e) => setForm((f) => ({ ...f, subcategoriaId: e.target.value }))}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                    >
                      <option value="">Sin producto específico</option>
                      {subcategoriasLocal.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setAgregandoSubcategoria(true)}
                      className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs text-accent hover:bg-surface-hover"
                    >
                      + Nuevo
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={nuevaSubcategoriaNombre}
                      onChange={(e) => setNuevaSubcategoriaNombre(e.target.value)}
                      onKeyDown={(e) => {
                        // Este input vive dentro del <form> del gasto — sin
                        // esto, Enter mandaría a guardar el gasto completo
                        // en vez de solo agregar el producto nuevo.
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAgregarSubcategoria();
                        }
                      }}
                      placeholder="Ej. Cera"
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={handleAgregarSubcategoria}
                      disabled={guardandoSubcategoria || !nuevaSubcategoriaNombre.trim()}
                      className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                    >
                      {guardandoSubcategoria ? "Agregando..." : "Agregar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAgregandoSubcategoria(false);
                        setNuevaSubcategoriaNombre("");
                      }}
                      className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs text-muted hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
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
                  <label className="text-xs font-medium text-muted">
                    {form.categoria === "nomina"
                      ? "Pagos por persona (opcional)"
                      : "Productos de la compra — orden de compra (opcional)"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setItemsForm((f) => [...f, nuevoRenglonItem()])}
                    className="text-xs text-accent hover:underline"
                  >
                    {form.categoria === "nomina" ? "+ Agregar persona" : "+ Agregar producto"}
                  </button>
                </div>
                {itemsForm.length > 0 && (
                  <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
                    {itemsForm.map((it) =>
                      form.categoria === "nomina" ? (
                        <div key={it.key} className="grid grid-cols-[1fr_84px_auto] items-center gap-2">
                          <select
                            value={it.producto}
                            onChange={(e) => actualizarRenglonItem(it.key, "producto", e.target.value)}
                            className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
                          >
                            <option value="">Elige a quién</option>
                            {lavadores.map((l) => (
                              <option key={l.id} value={l.nombre}>
                                {l.nombre}
                              </option>
                            ))}
                          </select>
                          <input
                            value={it.precioUnitario}
                            onChange={(e) => actualizarRenglonItem(it.key, "precioUnitario", e.target.value)}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Monto"
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
                      ) : (
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
                      )
                    )}
                    <p className="text-right text-xs font-medium text-foreground">Total: {money(totalItems)}</p>
                  </div>
                )}
                <p className="text-[11px] text-muted">
                  {form.categoria === "nomina"
                    ? "Útil para pagar a varias personas en un solo registro semanal: agrega una línea por persona (de una lista, para que no haya variaciones de un nombre escrito distinto cada vez) — el monto total se calcula solo."
                    : "Útil cuando compras varios insumos en un solo ticket: agrega cada producto por separado (con cantidad y precio) en vez de registrar un gasto por cada uno — el monto se calcula solo y todo queda en un mismo registro."}
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
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Lavador</th>
              <th className="px-4 py-3">Notas</th>
              <th className="px-4 py-3">Registró</th>
              <th className="px-4 py-3">Archivo</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {gastosFiltrados.map((g) => (
              <tr key={g.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                <td className="px-4 py-3 text-muted">{new Date(g.fecha).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })}</td>
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
                <td className="px-4 py-3 text-muted">
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs">
                    {nombreCategoriaGasto(g.categoria)}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">
                  {g.subcategoriaNombre ? (
                    <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-accent">
                      {g.subcategoriaNombre}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{g.lavadorNombre ?? "—"}</td>
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
            {gastosFiltrados.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-muted">
                  {categoriaFiltro || subcategoriaFiltro || lavadorFiltro
                    ? "Ningún gasto coincide con el filtro seleccionado."
                    : "Sin gastos registrados en este período."}
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
