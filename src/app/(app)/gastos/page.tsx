import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PERIODOS, resolverRango } from "@/lib/rangoFechas";
import { CATEGORIAS_GASTO } from "@/lib/gastoCategorias";
import { inicioDeMesMX, mesMX } from "@/lib/fecha";
import type { GastoCategoria } from "@/types/database.types";
import { GastosClient } from "./GastosClient";

const MESES_TENDENCIA = 12;

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function construirHref(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `/gastos?${s}` : "/gastos";
}

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{
    periodo?: string;
    desde?: string;
    hasta?: string;
    categoria?: string;
    subcategoria?: string;
    lavador?: string;
    montoMin?: string;
    montoMax?: string;
    q?: string;
    registradoPor?: string;
  }>;
}) {
  const searchParamsResueltos = await searchParams;
  const filtroCategoria = searchParamsResueltos.categoria ?? "";
  const filtroSubcategoria = searchParamsResueltos.subcategoria ?? "";
  const filtroLavador = searchParamsResueltos.lavador ?? "";
  const filtroMontoMin = searchParamsResueltos.montoMin ?? "";
  const filtroMontoMax = searchParamsResueltos.montoMax ?? "";
  const filtroQ = (searchParamsResueltos.q ?? "").trim();
  const filtroRegistradoPor = searchParamsResueltos.registradoPor ?? "";
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

  // Para los links de período y el botón de "Quitar filtros": conserva
  // todo el resto del filtro maestro al cambiar solo las fechas.
  const paramsFiltroActuales = {
    periodo: rango.personalizado ? undefined : rango.periodo,
    desde: rango.personalizado ? rango.desdeInput || undefined : undefined,
    hasta: rango.personalizado ? rango.hastaInput || undefined : undefined,
    categoria: filtroCategoria || undefined,
    subcategoria: filtroSubcategoria || undefined,
    lavador: filtroLavador || undefined,
    montoMin: filtroMontoMin || undefined,
    montoMax: filtroMontoMax || undefined,
    q: filtroQ || undefined,
    registradoPor: filtroRegistradoPor || undefined,
  };
  const hayFiltroMaestro = Boolean(
    rango.personalizado ||
      filtroCategoria ||
      filtroSubcategoria ||
      filtroLavador ||
      filtroMontoMin ||
      filtroMontoMax ||
      filtroQ ||
      filtroRegistradoPor
  );

  // Filtros del "filtro maestro" que sí viven directo en la columna del
  // gasto (categoría, monto, quién lo registró) se mandan a la base de
  // datos — los que dependen de los renglones desglosados (subcategoría,
  // lavador, texto libre) se aplican después en JS, porque necesitan el
  // mismo criterio de "explotar por renglón" que ya usan las gráficas (ver
  // más abajo), y una compra de Dogo o un Sueldos itemizado no tiene esa
  // columna puesta directa en el gasto.
  const gastosQuery = supabase.from("gastos").select("*").order("fecha", { ascending: false });
  if (rango.desdeIso) gastosQuery.gte("fecha", rango.desdeIso);
  if (rango.hastaIso) gastosQuery.lte("fecha", rango.hastaIso);
  if (filtroCategoria) gastosQuery.eq("categoria", filtroCategoria as GastoCategoria);
  if (filtroMontoMin) gastosQuery.gte("monto", Number(filtroMontoMin));
  if (filtroMontoMax) gastosQuery.lte("monto", Number(filtroMontoMax));
  if (filtroRegistradoPor) gastosQuery.eq("creado_por", filtroRegistradoPor);

  const { data: gastosRaw } = await gastosQuery;

  const gastoIds = (gastosRaw ?? []).map((g) => g.id);

  // Tendencia mensual: independiente del período de arriba (que puede estar
  // en "Hoy") — siempre mira los últimos 12 meses completos, para poder
  // responder "¿en qué mes gasté más?" sin tener que cambiar el filtro de
  // toda la página. Sí respeta el resto del filtro maestro (categoría,
  // monto, quién lo registró) — así "¿cuánto gasto al mes en Nómina?" se
  // contesta nada más filtrando categoría y viendo esta misma gráfica.
  const desdeTendencia = inicioDeMesMX(MESES_TENDENCIA - 1);
  const gastosTendenciaQuery = supabase.from("gastos").select("fecha, monto").gte("fecha", desdeTendencia.toISOString());
  if (filtroCategoria) gastosTendenciaQuery.eq("categoria", filtroCategoria as GastoCategoria);
  if (filtroMontoMin) gastosTendenciaQuery.gte("monto", Number(filtroMontoMin));
  if (filtroMontoMax) gastosTendenciaQuery.lte("monto", Number(filtroMontoMax));
  if (filtroRegistradoPor) gastosTendenciaQuery.eq("creado_por", filtroRegistradoPor);

  const [
    { data: usuarios },
    { data: archivosRaw },
    { data: itemsRaw },
    { data: subcategoriasRaw },
    { data: lavadoresRaw },
    { data: gastosTendenciaRaw },
    { data: registradoresRaw },
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
    gastosTendenciaQuery,
    // Opciones del filtro "Registró" — dueño/encargado son los únicos que
    // pueden crear gastos (ver requiereDuenoOEncargado en actions.ts), así
    // que son los únicos que puede haber registrado alguno.
    supabase.from("usuarios").select("id, nombre").in("rol", ["dueno", "encargado"]).order("nombre"),
  ]);

  const nombrePorUsuario = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]));
  const subcategorias = subcategoriasRaw ?? [];
  const nombrePorSubcategoria = new Map(subcategorias.map((s) => [s.id, s.nombre]));
  const lavadores = lavadoresRaw ?? [];
  const nombrePorLavador = new Map(lavadores.map((l) => [l.id, l.nombre]));
  const registradores = registradoresRaw ?? [];
  // Para emparejar texto de renglón ("productos de la compra") contra el
  // catálogo — se usan tanto para el filtro maestro de subcategoría/lavador
  // como para las gráficas correspondientes más abajo.
  const idPorNombreSubcategoria = new Map(subcategorias.map((s) => [s.nombre.trim().toLowerCase(), s.id]));
  const idPorNombreLavador = new Map(lavadores.map((l) => [l.nombre.trim().toLowerCase(), l.id]));

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

  // Filtro maestro, parte 2: subcategoría, lavador y texto libre dependen
  // de los renglones (no son columnas directas del gasto), así que se
  // aplican aquí en JS — con el mismo criterio de "explotar por renglón"
  // de las gráficas, para que filtrar por "Teflón" o por un lavador
  // encuentre también los gastos itemizados (compras mixtas, nómina
  // semanal), no solo los que tienen esa subcategoría/lavador puestos
  // directo.
  const filtroQNorm = filtroQ.toLowerCase();
  const gastosFiltrados = gastos.filter((g) => {
    if (filtroSubcategoria) {
      const coincide = g.subcategoriaId
        ? g.subcategoriaId === filtroSubcategoria
        : g.items.some(
            (it) => idPorNombreSubcategoria.get(it.producto.trim().toLowerCase()) === filtroSubcategoria
          );
      if (!coincide) return false;
    }
    if (filtroLavador) {
      const coincide = g.lavadorId
        ? g.lavadorId === filtroLavador
        : g.items.some((it) => idPorNombreLavador.get(it.producto.trim().toLowerCase()) === filtroLavador);
      if (!coincide) return false;
    }
    if (filtroQNorm) {
      const enConcepto = g.concepto.toLowerCase().includes(filtroQNorm);
      const enNotas = (g.notas ?? "").toLowerCase().includes(filtroQNorm);
      const enItems = g.items.some((it) => it.producto.toLowerCase().includes(filtroQNorm));
      if (!enConcepto && !enNotas && !enItems) return false;
    }
    return true;
  });

  const totalGastos = gastosFiltrados.reduce((acc, g) => acc + g.monto, 0);

  // "¿Cuánto gasto por semana/mes en esto?" — se calcula sobre el período
  // real que abarcan los gastos ya filtrados (no un número de días fijo),
  // para que la respuesta sea precisa sin importar qué tan largo o corto
  // sea el rango de fechas elegido.
  let promedioSemanal: number | null = null;
  let promedioMensual: number | null = null;
  if (gastosFiltrados.length > 0) {
    const fechasMs = gastosFiltrados.map((g) => new Date(g.fecha).getTime());
    // Usa el límite del rango elegido cuando está puesto explícito (ej. un
    // "Desde"/"Hasta" a mano); si quedó abierto ("Todo", o sin "Hasta"),
    // usa la fecha real del dato más antiguo/reciente, extendiendo el
    // extremo abierto hasta hoy (el período sigue corriendo).
    const desdeMs = rango.desdeIso ? new Date(rango.desdeIso).getTime() : Math.min(...fechasMs);
    // Date.now() es impuro a propósito aquí: esta es una Server Component
    // que ya se recalcula fresca en cada request — "hasta hoy" debe ser el
    // momento real en que se pidió la página, no un valor fijo.
    // eslint-disable-next-line react-hooks/purity
    const hastaMs = rango.hastaIso ? new Date(rango.hastaIso).getTime() : Math.max(Date.now(), ...fechasMs);
    const diasSpan = Math.max(1, (hastaMs - desdeMs) / 86400000);
    promedioSemanal = (totalGastos / diasSpan) * 7;
    promedioMensual = (totalGastos / diasSpan) * 30.44;
  }

  // Para la gráfica de "en qué se va más el dinero" — suma por categoría,
  // ordenada de mayor a menor para que la barra más grande (el mayor gasto)
  // quede primero.
  const totalPorCategoriaMap = new Map<string, number>();
  for (const g of gastosFiltrados) {
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
  const totalPorSubcategoriaMap = new Map<string, number>();
  for (const g of gastosFiltrados) {
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

  // Nómina por lavador — "¿cuánto se le ha pagado a cada quién?". Mismo
  // criterio que en producto específico: si el gasto de Nómina tiene un
  // lavador puesto directo, cuenta completo ahí; si no, pero sí tiene
  // renglones desglosados (el "Sueldos" semanal normal, con un renglón por
  // persona), reparte el monto entre los renglones cuyo nombre coincida
  // con un lavador del catálogo.
  const totalPorLavadorMap = new Map<string, number>();
  for (const g of gastosFiltrados) {
    if (g.categoria !== "nomina") continue;
    if (g.lavadorId) {
      totalPorLavadorMap.set(g.lavadorId, (totalPorLavadorMap.get(g.lavadorId) ?? 0) + g.monto);
      continue;
    }
    for (const it of g.items) {
      const lavId = idPorNombreLavador.get(it.producto.trim().toLowerCase());
      if (!lavId) continue;
      const montoRenglon = it.cantidad * it.precioUnitario;
      totalPorLavadorMap.set(lavId, (totalPorLavadorMap.get(lavId) ?? 0) + montoRenglon);
    }
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

      <div className="flex gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p.value}
            href={construirHref({ ...paramsFiltroActuales, periodo: p.value, desde: undefined, hasta: undefined })}
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

      <form className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-medium text-muted">
          Filtro maestro — combina lo que quieras: fechas, categoría, producto, lavador, monto, texto, quién lo
          registró.
        </p>
        <div className="flex flex-wrap items-end gap-2">
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
          <div className="flex flex-col gap-1">
            <label htmlFor="categoria" className="text-[11px] text-muted">
              Categoría
            </label>
            <select
              id="categoria"
              name="categoria"
              defaultValue={filtroCategoria}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="">Todas</option>
              {CATEGORIAS_GASTO.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="subcategoria" className="text-[11px] text-muted">
              Producto
            </label>
            <select
              id="subcategoria"
              name="subcategoria"
              defaultValue={filtroSubcategoria}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="">Todos</option>
              {subcategorias.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="lavador" className="text-[11px] text-muted">
              Trabajador
            </label>
            <select
              id="lavador"
              name="lavador"
              defaultValue={filtroLavador}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="">Todos</option>
              {lavadores.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="montoMin" className="text-[11px] text-muted">
              Monto mín.
            </label>
            <input
              id="montoMin"
              type="number"
              name="montoMin"
              min="0"
              step="0.01"
              defaultValue={filtroMontoMin}
              placeholder="$0"
              className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="montoMax" className="text-[11px] text-muted">
              Monto máx.
            </label>
            <input
              id="montoMax"
              type="number"
              name="montoMax"
              min="0"
              step="0.01"
              defaultValue={filtroMontoMax}
              placeholder="$999999"
              className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="registradoPor" className="text-[11px] text-muted">
              Registró
            </label>
            <select
              id="registradoPor"
              name="registradoPor"
              defaultValue={filtroRegistradoPor}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="">Cualquiera</option>
              {registradores.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1" style={{ minWidth: 160 }}>
            <label htmlFor="q" className="text-[11px] text-muted">
              Buscar texto (concepto, notas, producto)
            </label>
            <input
              id="q"
              name="q"
              defaultValue={filtroQ}
              placeholder="Ej. Dogo, llanta, Manuel..."
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              hayFiltroMaestro
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            Filtrar
          </button>
          {hayFiltroMaestro && (
            <Link
              href="/gastos"
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
            >
              Quitar filtros
            </Link>
          )}
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Total ({rango.etiqueta})</p>
          <p className="mt-1 text-2xl font-bold text-primary">{money(totalGastos)}</p>
          <p className="mt-1 text-xs text-muted">{gastosFiltrados.length} gasto{gastosFiltrados.length === 1 ? "" : "s"}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Promedio por gasto</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {gastosFiltrados.length > 0 ? money(totalGastos / gastosFiltrados.length) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Promedio por semana</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {promedioSemanal !== null ? money(promedioSemanal) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Promedio por mes</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {promedioMensual !== null ? money(promedioMensual) : "—"}
          </p>
        </div>
      </div>

      <GastosClient
        gastos={gastosFiltrados}
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
