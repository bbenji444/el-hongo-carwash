import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PERIODOS, resolverRango } from "@/lib/rangoFechas";
import { GastosClient } from "./GastosClient";

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

  const usuarioIds = [...new Set((gastosRaw ?? []).map((g) => g.creado_por))];
  const { data: usuarios } = usuarioIds.length
    ? await supabase.from("usuarios").select("id, nombre").in("id", usuarioIds)
    : { data: [] };
  const nombrePorUsuario = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]));

  const gastos = (gastosRaw ?? []).map((g) => ({
    id: g.id,
    concepto: g.concepto,
    monto: g.monto,
    fecha: g.fecha,
    notas: g.notas,
    creadoPor: nombrePorUsuario.get(g.creado_por) ?? "—",
  }));

  const totalGastos = gastos.reduce((acc, g) => acc + g.monto, 0);

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

      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Total de gastos ({rango.etiqueta})</p>
        <p className="mt-1 text-2xl font-bold text-primary">{money(totalGastos)}</p>
      </div>

      <GastosClient gastos={gastos} />
    </div>
  );
}
