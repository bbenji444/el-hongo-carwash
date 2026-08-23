import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "./actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { RolUsuario } from "@/types/database.types";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Tickets", href: "/tickets" },
  { label: "Servicios", href: "/servicios" },
  { label: "Caja y turnos", href: "/turnos" },
  { label: "Clientes", href: "/clientes" },
  { label: "Membresías", href: "/membresias" },
  { label: "Inventario", href: "/inventario" },
  { label: "Reportes", href: "/reportes" },
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
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-muted transition hover:bg-surface-hover hover:text-foreground"
            >
              <span>{item.label}</span>
            </Link>
          ))}
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
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:border-primary hover:text-primary"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
