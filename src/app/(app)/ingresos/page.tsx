import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PERIODOS, resolverRango } from "@/lib/rangoFechas";
import { IngresosClient } from "./IngresosClient";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export default async function IngresosPage({
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

  const ingresosQuery = supabase.from("ingresos_extra").select("*").order("fecha", { ascending: false });
  if (rango.desdeIso) ingresosQuery.gte("fecha", rango.desdeIso);
  if (rango.hastaIso) ingresosQuery.lte("fecha", rango.hastaIso);

  const { data: ingresosRaw } = await ingresosQuery;

  const usuarioIds = [...new Set((ingresosRaw ?? []).map((i) => i.creado_por))];
  const { data: usuarios } = usuarioIds.length
    ? await supabase.from("usuarios").select("id, nombre").in("id", usuarioIds)
    : { data: [] };

  const nombrePorUsuario = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]));

  const ingresos = (ingresosRaw ?? []).map((i) => ({
    id: i.id,
    concepto: i.concepto,
    monto: i.monto,
    fecha: i.fecha,
    notas: i.notas,
    creadoPor: nombrePorUsuario.get(i.creado_por) ?? "—",
  }));

  const totalIngresos = ingresos.reduce((acc, i) => acc + i.monto, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ingresos extra</h1>
        <p className="text-sm text-muted">
          Pensiones de estacionamiento y cualquier otro ingreso que no venga de un ticket de lavado.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {PERIODOS.map((p) => (
            <Link
              key={p.value}
              href={`/ingresos?periodo=${p.value}`}
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
              href="/ingresos"
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
            >
              Quitar filtro
            </Link>
          )}
        </form>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Total de ingresos extra ({rango.etiqueta})</p>
        <p className="mt-1 text-2xl font-bold text-success">{money(totalIngresos)}</p>
      </div>

      <IngresosClient ingresos={ingresos} />
    </div>
  );
}
