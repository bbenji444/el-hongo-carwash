import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "./actions";
import type { RolUsuario } from "@/types/database.types";

const NAV_ITEMS = [
  { label: "Dashboard", fase: 1, href: "/", disponible: true },
  { label: "Tickets", fase: 2, href: "/tickets", disponible: true },
  { label: "Servicios", fase: 2, href: "/servicios", disponible: true },
  { label: "Caja y turnos", fase: 3, href: "/turnos", disponible: true },
  { label: "Clientes", fase: 4, href: "/clientes", disponible: true },
  { label: "Membresías", fase: 4, href: "/membresias", disponible: true },
  { label: "Inventario", fase: 5, href: "/inventario", disponible: true },
  { label: "Reportes", fase: 6, href: "/reportes", disponible: true },
];

const ROL_LABEL: Record<RolUsuario, string> = {
  dueno: "Dueño",
  encargado: "Encargado de turno",
  cajero: "Cajero / Operador",
};

const ROL_BADGE_CLASS: Record<RolUsuario, string> = {
  dueno: "bg-primary/15 text-primary border-primary/40",
  encargado: "bg-accent/15 text-accent border-accent/40",
  cajero: "bg-muted/15 text-muted border-muted/40",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombre, rol, activo")
    .eq("id", user.id)
    .maybeSingle();

  if (!usuario || !usuario.activo) {
    redirect("/login?motivo=cuenta_inactiva");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-3 border-b border-border px-5 py-5">
          <Image
            src="/logo.jpg"
            alt="El Hongo Car Wash"
            width={40}
            height={40}
            className="rounded-full border border-primary"
          />
          <div>
            <p className="text-sm font-bold leading-tight text-foreground">EL HONGO</p>
            <p className="text-[10px] uppercase tracking-widest text-muted">Car Wash Admin</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) =>
            item.disponible && item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-muted transition hover:bg-surface-hover hover:text-foreground"
              >
                <span>{item.label}</span>
              </Link>
            ) : (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-muted/60"
              >
                <span>{item.label}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted/60">
                  Fase {item.fase}
                </span>
              </div>
            )
          )}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{usuario.nombre}</span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${ROL_BADGE_CLASS[usuario.rol]}`}
            >
              {ROL_LABEL[usuario.rol]}
            </span>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:border-primary hover:text-primary"
            >
              Cerrar sesión
            </button>
          </form>
        </header>

        <main className="flex-1 bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
