"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "./actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ConfiguracionApp } from "@/types/database.types";

export function AppShell({
  usuarioNombre,
  esDueno,
  config,
  children,
}: {
  usuarioNombre: string;
  esDueno: boolean;
  config: ConfiguracionApp;
  children: React.ReactNode;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { label: config.nav_dashboard, href: "/" },
    { label: config.nav_tickets, href: "/tickets" },
    { label: config.nav_servicios, href: "/servicios" },
    { label: config.nav_lavadores, href: "/lavadores" },
    { label: config.nav_turnos, href: "/turnos" },
    { label: config.nav_clientes, href: "/clientes" },
    { label: config.nav_inventario, href: "/inventario" },
    { label: config.nav_reportes, href: "/reportes" },
    ...(esDueno ? [{ label: "Ajustes", href: "/ajustes" }] : []),
  ];

  const variablesColor = {
    "--primary": config.color_primario,
    "--accent": config.color_accent,
    "--success": config.color_success,
    "--warning": config.color_warning,
  } as React.CSSProperties;

  return (
    <div className="flex min-h-screen" style={variablesColor}>
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
          {navItems.map((item) => {
            const activo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuAbierto(false)}
                className={`relative flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all duration-150 ${
                  activo
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted hover:translate-x-0.5 hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                {activo && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-black/15 bg-primary px-4 py-4 shadow-[0_2px_10px_-2px_rgba(227,30,36,0.5)] md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
              className="rounded-lg px-2 py-1 text-lg leading-none text-white transition hover:bg-white/15 md:hidden"
            >
              {menuAbierto ? "✕" : "☰"}
            </button>
            <span className="text-sm font-semibold text-white">{usuarioNombre}</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-lg border border-white/50 px-3 py-1.5 text-sm font-medium text-white transition hover:border-white hover:bg-white/15"
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
