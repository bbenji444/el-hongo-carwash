import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "./actions";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Tickets", href: "/tickets" },
  { label: "Servicios", href: "/servicios" },
  { label: "Caja y turnos", href: "/turnos" },
  { label: "Clientes", href: "/clientes" },
  { label: "Inventario", href: "/inventario" },
  { label: "Reportes", href: "/reportes" },
];

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
    .select("nombre, activo")
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
            width={52}
            height={52}
            className="rounded-full border-2 border-primary shadow-[0_0_0_3px_rgba(227,30,36,0.15)]"
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
        <header className="flex items-center justify-between border-b border-primary/20 bg-primary/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{usuario.nombre}</span>
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

        <main className="relative flex-1 bg-background">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
          >
            <div className="relative h-[480px] w-[480px] opacity-[0.07] [mask-image:radial-gradient(circle,black_0%,black_35%,transparent_75%)] [-webkit-mask-image:radial-gradient(circle,black_0%,black_35%,transparent_75%)]">
              <Image src="/logo.jpg" alt="" fill className="object-contain" />
            </div>
          </div>
          <div className="relative z-10 p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
