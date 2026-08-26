"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
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

export function AppShell({ usuarioNombre, children }: { usuarioNombre: string; children: React.ReactNode }) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="flex min-h-screen">
      {menuAbierto && (
        <div
          aria-hidden="true"
          onClick={() => setMenuAbierto(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          menuAbierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
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
              onClick={() => setMenuAbierto(false)}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-muted transition hover:bg-surface-hover hover:text-foreground"
            >
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-primary/30 bg-primary/20 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
              className="rounded-lg px-2 py-1 text-lg leading-none text-foreground transition hover:bg-primary/10 md:hidden"
            >
              {menuAbierto ? "✕" : "☰"}
            </button>
            <span className="text-sm font-medium text-foreground">{usuarioNombre}</span>
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
            <div className="relative h-[480px] w-[480px] opacity-[0.09] [mask-image:radial-gradient(circle,black_0%,black_45%,transparent_82%)] [-webkit-mask-image:radial-gradient(circle,black_0%,black_45%,transparent_82%)]">
              <Image src="/logo.jpg" alt="" fill className="object-contain" />
            </div>
          </div>
          <div className="relative z-10 p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
