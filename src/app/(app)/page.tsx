import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombre, rol")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Hola, {usuario?.nombre ?? "usuario"} 👋
        </h1>
        <p className="text-sm text-muted">
          Sesión iniciada correctamente como <span className="text-accent">{usuario?.rol}</span>.
          Fase 1 a 6 (setup, schema, auth, tickets, servicios, caja y turnos, clientes y membresías,
          inventario, reportes) completas.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/tickets"
          className="rounded-xl border border-primary/40 bg-primary/5 p-5 transition hover:bg-primary/10"
        >
          <p className="text-xs uppercase tracking-wide text-primary">Fase 2</p>
          <p className="mt-1 font-semibold text-foreground">Tickets</p>
          <p className="mt-2 text-sm text-muted">Tablero de tickets del turno en curso.</p>
        </Link>
        <Link
          href="/servicios"
          className="rounded-xl border border-primary/40 bg-primary/5 p-5 transition hover:bg-primary/10"
        >
          <p className="text-xs uppercase tracking-wide text-primary">Fase 2</p>
          <p className="mt-1 font-semibold text-foreground">Servicios</p>
          <p className="mt-2 text-sm text-muted">Catálogo de servicios.</p>
        </Link>
        <Link
          href="/turnos"
          className="rounded-xl border border-primary/40 bg-primary/5 p-5 transition hover:bg-primary/10"
        >
          <p className="text-xs uppercase tracking-wide text-primary">Fase 3</p>
          <p className="mt-1 font-semibold text-foreground">Caja y turnos</p>
          <p className="mt-2 text-sm text-muted">Cierre de turno y conciliación de efectivo.</p>
        </Link>
        <Link
          href="/clientes"
          className="rounded-xl border border-primary/40 bg-primary/5 p-5 transition hover:bg-primary/10"
        >
          <p className="text-xs uppercase tracking-wide text-primary">Fase 4</p>
          <p className="mt-1 font-semibold text-foreground">Clientes</p>
          <p className="mt-2 text-sm text-muted">Directorio de clientes, vehículos y membresías.</p>
        </Link>
        <Link
          href="/membresias"
          className="rounded-xl border border-primary/40 bg-primary/5 p-5 transition hover:bg-primary/10"
        >
          <p className="text-xs uppercase tracking-wide text-primary">Fase 4</p>
          <p className="mt-1 font-semibold text-foreground">Membresías</p>
          <p className="mt-2 text-sm text-muted">Catálogo de planes de membresía.</p>
        </Link>
        <Link
          href="/inventario"
          className="rounded-xl border border-primary/40 bg-primary/5 p-5 transition hover:bg-primary/10"
        >
          <p className="text-xs uppercase tracking-wide text-primary">Fase 5</p>
          <p className="mt-1 font-semibold text-foreground">Inventario</p>
          <p className="mt-2 text-sm text-muted">Insumos y recetas de consumo por servicio.</p>
        </Link>
        <Link
          href="/reportes"
          className="rounded-xl border border-primary/40 bg-primary/5 p-5 transition hover:bg-primary/10"
        >
          <p className="text-xs uppercase tracking-wide text-primary">Fase 6</p>
          <p className="mt-1 font-semibold text-foreground">Reportes</p>
          <p className="mt-2 text-sm text-muted">Ventas, descuentos y diferencias de caja.</p>
        </Link>
      </div>
    </div>
  );
}
