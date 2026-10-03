import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PERIODOS, resolverRango } from "@/lib/rangoFechas";
import { CATEGORIAS_GASTO } from "@/lib/gastoCategorias";
import { inicioDeMesMX, mesMX } from "@/lib/fecha";
import { GastosClient } from "./GastosClient";

const MESES_TENDENCIA = 12;

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }>;
}) {
  const searchParamsResueltos = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  if (!usuario) {
    redirect("/login");
  }

  if (usuario.rol === "cajero") {
    redirect("/");
  }

  const rango = resolverRango(searchParamsResueltos);

  const gastosQuery = supabase.from("gastos").select("*").order("fecha", { ascending: false });
  if (rango.desdeIso) gastosQuery.gte("fecha", rango.desdeIso);
  if (rango.hastaIso) gastosQuery.lte("fecha", rango.hastaIso);

  const { data: gastosRaw } = await gastosQuery;

  const gastoIds = (gastosRaw ?? []).map((g) => g.id);

  // Tendencia mensual: independiente del período de arriba (que puede estar
  // en "Hoy") — siempre mira los últimos 12 meses completos, para poder
  // responder "¿en qué mes gasté más?" sin tener que cambiar el filtro de
  // toda la página.
  const desdeTendencia = inicioDeMesMX(MESES_TENDENCIA - 1);

  const [
    { data: usuarios },
    { data: archivosRaw },
    { data: itemsRaw },
    { data: subcategoriasRaw },
    { data: lavadoresRaw },
    { data: gastosTendenciaRaw },
  ] = await Promise.all([
    gastoIds.length
      ? (async () => {
          const usuarioIds = [...new Set((gastosRaw ?? []).map((g) => g.creado_por))];
          return supabase.from("usuarios").select("id, nombre").in("id", usuarioIds);
        })()
      : Promise.resolve({ data: [] }),
    gastoIds.length
      ? supabase.from("gasto_archivos").select("id, gasto_id, archivo_nombre, archivo_tipo").in("gasto_id", gastoIds)
      : Promise.resolve({ data: [] }),
    gastoIds.length
      ? supabase
          .from("gasto_items")
          .select("id, gasto_id, producto, cantidad, precio_unitario")
          .in("gasto_id", gastoIds)
          .order("creado_en", { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase.from("gasto_subcategorias").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("lavadores").select("id, nombre").order("nombre"),
    supabase.from("gastos").select("fecha, monto").gte("fecha", desdeTendencia.toISOString()),
  ]);

  const nombrePorUsuario = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]));
  const subcategorias = subcategoriasRaw ?? [];
  const nombrePorSubcategoria = new Map(subcategorias.map((s) => [s.id, s.nombre]));
  const lavadores = lavadoresRaw ?? [];
  const nombrePorLavador = new Map(lavadores.map((l) => [l.id, l.nombre]));

  const archivosPorGasto = new Map<string, { id: string; nombre: string; tipo: string | null }[]>();
  for (const a of archivosRaw ?? []) {
    const lista = archivosPorGasto.get(a.gasto_id) ?? [];
    lista.push({ id: a.id, nombre: a.archivo_nombre, tipo: a.archivo_tipo });
    archivosPorGasto.set(a.gasto_id, lista);
  }

  const itemsPorGasto = new Map<string, { id: string; producto: string; cantidad: number; precioUnitario: number }[]>();
  for (const it of itemsRaw ?? []) {
    const lista = itemsPorGasto.get(it.gasto_id) ?? [];
    lista.push({ id: it.id, producto: it.producto, cantidad: it.cantidad, precioUnitario: it.precio_unitario });
    itemsPorGasto.set(it.gasto_id, lista);
  }

  const gastos = (gastosRaw ?? []).map((g) => ({
    id: g.id,
    concepto: g.concepto,
    monto: g.monto,
    fecha: g.fecha,
    notas: g.notas,
    categoria: g.categoria,
    subcategoriaId: g.subcategoria_id,
    subcategoriaNombre: g.subcategoria_id ? nombrePorSubcategoria.get(g.subcategoria_id) ?? null : null,
    lavadorId: g.lavador_id,
    lavadorNombre: g.lavador_id ? nombrePorLavador.get(g.lavador_id) ?? null : null,
    creadoPor: nombrePorUsuario.get(g.creado_por) ?? "—",
    archivos: archivosPorGasto.get(g.id) ?? [],
    items: itemsPorGasto.get(g.id) ?? [],
  }));

  const totalGastos = gastos.reduce((acc, g) => acc + g.monto, 0);

  // Para la gráfica de "en qué se va más el dinero" — suma por categoría,
  // ordenada de mayor a menor para que la barra más grande (el mayor gasto)
  // quede primero.
  const totalPorCategoriaMap = new Map<string, number>();
  for (const g of gastos) {
    totalPorCategoriaMap.set(g.categoria, (totalPorCategoriaMap.get(g.categoria) ?? 0) + g.monto);
  }
  const gastosPorCategoria = CATEGORIAS_GASTO.map((c) => ({
    categoria: c.value,
    nombre: c.label,
    total: totalPorCategoriaMap.get(c.value) ?? 0,
  }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  // Igual, pero por producto específico (subcategoría). Un gasto con
  // subcategoría puesta directamente cuenta su monto completo ahí. Uno SIN
  // subcategoría pero con "productos de la compra" desglosados (una compra
  // mixta de varios productos en un solo ticket) reparte su monto entre los
  // renglones que coincidan por nombre con el catálogo — así una compra
  // como "Dogo: Abrillantador + Teflón + Depósitos" no se queda sin
  // clasificar solo por no tener un único producto. Lo que no coincide con
  // ningún producto del catálogo (ej. un renglón de "Iva") se ignora aquí.
  const idPorNombreSubcategoria = new Map(
    subcategorias.map((s) => [s.nombre.trim().toLowerCase(), s.id])
  );
  const totalPorSubcategoriaMap = new Map<string, number>();
  for (const g of gastos) {
    if (g.subcategoriaId) {
      totalPorSubcategoriaMap.set(g.subcategoriaId, (totalPorSubcategoriaMap.get(g.subcategoriaId) ?? 0) + g.monto);
      continue;
    }
    for (const it of g.items) {
      const subId = idPorNombreSubcategoria.get(it.producto.trim().toLowerCase());
      if (!subId) continue;
      const montoRenglon = it.cantidad * it.precioUnitario;
      totalPorSubcategoriaMap.set(subId, (totalPorSubcategoriaMap.get(subId) ?? 0) + montoRenglon);
    }
  }
  const gastosPorSubcategoria = Array.from(totalPorSubcategoriaMap.entries())
    .map(([subcategoriaId, total]) => ({
      subcategoriaId,
      nombre: nombrePorSubcategoria.get(subcategoriaId) ?? "—",
      total,
    }))
    .sort((a, b) => b.total - a.total);

  // Nómina por lavador — "¿cuánto se le ha pagado a cada quién?" — solo
  // entre los gastos de categoría Nómina del período actual que sí tienen
  // un lavador asignado.
  const totalPorLavadorMap = new Map<string, number>();
  for (const g of gastos) {
    if (g.categoria !== "nomina" || !g.lavadorId) continue;
    totalPorLavadorMap.set(g.lavadorId, (totalPorLavadorMap.get(g.lavadorId) ?? 0) + g.monto);
  }
  const nominaPorLavador = Array.from(totalPorLavadorMap.entries())
    .map(([lavadorId, total]) => ({ lavadorId, nombre: nombrePorLavador.get(lavadorId) ?? "—", total }))
    .sort((a, b) => b.total - a.total);

  // Tendencia mensual: últimos 12 meses completos, sin importar el período
  // seleccionado arriba.
  const totalPorMesMap = new Map<string, number>();
  for (let i = MESES_TENDENCIA - 1; i >= 0; i--) {
    totalPorMesMap.set(mesMX(inicioDeMesMX(i).toISOString()), 0);
  }
  for (const g of gastosTendenciaRaw ?? []) {
    const mes = mesMX(g.fecha);
    if (totalPorMesMap.has(mes)) {
      totalPorMesMap.set(mes, (totalPorMesMap.get(mes) ?? 0) + g.monto);
    }
  }
  const gastosPorMes = Array.from(totalPorMesMap, ([mes, total]) => ({
    mes,
    etiqueta: new Date(`${mes}-01T12:00:00`).toLocaleDateString("es-MX", {
      month: "short",
      year: "2-digit",
      timeZone: "America/Mexico_City",
    }),
    total,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gastos</h1>
        <p className="text-sm text-muted">
          Sueldos, insumos, servicios y cualquier otro gasto que se descuente de las ventas.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {PERIODOS.map((p) => (
            <Link
              key={p.value}
              href={`/gastos?periodo=${p.value}`}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                !rango.personalizado && p.value === rango.periodo
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>

        <form className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface px-3 py-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="desde" className="text-[11px] text-muted">
              Desde
            </label>
            <input
              id="desde"
              type="date"
              name="desde"
              defaultValue={rango.desdeInput}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="hasta" className="text-[11px] text-muted">
              Hasta
            </label>
            <input
              id="hasta"
              type="date"
              name="hasta"
              defaultValue={rango.hastaInput}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              rango.personalizado
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            Filtrar
          </button>
          {rango.personalizado && (
            <Link
              href="/gastos"
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
            >
              Quitar filtro
            </Link>
          )}
        </form>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Total de gastos ({rango.etiqueta})</p>
        <p className="mt-1 text-2xl font-bold text-primary">{money(totalGastos)}</p>
      </div>

      <GastosClient
        gastos={gastos}
        gastosPorCategoria={gastosPorCategoria}
        gastosPorSubcategoria={gastosPorSubcategoria}
        subcategorias={subcategorias}
        lavadores={lavadores}
        nominaPorLavador={nominaPorLavador}
        gastosPorMes={gastosPorMes}
      />
    </div>
  );
}
