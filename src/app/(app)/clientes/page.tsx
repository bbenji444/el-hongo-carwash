import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientesClient } from "./ClientesClient";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let query = supabase.from("clientes").select("id, nombre, telefono").order("nombre").limit(50);
  if (q) {
    query = query.ilike("nombre", `%${q}%`);
  }
  const { data: clientes } = await query;

  const clienteIds = (clientes ?? []).map((c) => c.id);

  const [{ data: vinculos }, { data: vehiculos }] = await Promise.all([
    clienteIds.length
      ? supabase
          .from("membresias_clientes")
          .select("cliente_id, membresia_id")
          .in("cliente_id", clienteIds)
          .eq("activa", true)
      : Promise.resolve({ data: [] }),
    clienteIds.length
      ? supabase.from("vehiculos").select("cliente_id").in("cliente_id", clienteIds)
      : Promise.resolve({ data: [] }),
  ]);

  const membresiaIds = [...new Set((vinculos ?? []).map((v) => v.membresia_id))];
  const { data: membresias } = membresiaIds.length
    ? await supabase.from("membresias").select("id, nombre").in("id", membresiaIds)
    : { data: [] };

  const nombreMembresiaPorId = new Map((membresias ?? []).map((m) => [m.id, m.nombre]));
  const membresiaPorCliente = new Map(
    (vinculos ?? []).map((v) => [v.cliente_id, nombreMembresiaPorId.get(v.membresia_id) ?? null])
  );
  const vehiculosPorCliente = new Map<string, number>();
  for (const v of vehiculos ?? []) {
    vehiculosPorCliente.set(v.cliente_id, (vehiculosPorCliente.get(v.cliente_id) ?? 0) + 1);
  }

  const clientesConDetalle = (clientes ?? []).map((c) => ({
    ...c,
    membresiaActiva: membresiaPorCliente.get(c.id) ?? null,
    vehiculos: vehiculosPorCliente.get(c.id) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
        <p className="text-sm text-muted">Directorio de clientes, vehículos y membresías.</p>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre..."
          className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:text-foreground"
        >
          Buscar
        </button>
        {q && (
          <Link
            href="/clientes"
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:text-foreground"
          >
            Limpiar
          </Link>
        )}
      </form>

      <ClientesClient clientes={clientesConDetalle} />
    </div>
  );
}
