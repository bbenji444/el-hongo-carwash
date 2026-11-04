"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  CarFront,
  ChartColumn,
  Contact,
  HandCoins,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  Settings,
  Sparkles,
  UserCog,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { signOutAction } from "./actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FondoAnimado } from "@/components/FondoAnimado";
import { FloatingChatWidget } from "./FloatingChatWidget";
import type { ConfiguracionApp } from "@/types/database.types";

type NavItem = { label: string; href: string; icono: LucideIcon };

const RESORTE = { type: "spring", stiffness: 420, damping: 34 } as const;

// Mismo contenido de menú para escritorio y para el cajón de celular —
// cambia solo el "layoutId" del resaltado (para que no salte entre los dos).
function Navegacion({
  items,
  pathname,
  idResaltado,
  onNavegar,
}: {
  items: NavItem[];
  pathname: string;
  idResaltado: string;
  onNavegar: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {items.map((item, i) => {
        const activo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icono = item.icono;
        return (
          <motion.div
            key={item.href}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0, transition: { delay: 0.04 + i * 0.035, ...RESORTE } }}
          >
            <Link
              href={item.href}
              onClick={onNavegar}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200 ${
                activo ? "font-medium text-primary" : "text-muted hover:text-foreground"
              }`}
            >
              {/* Resaltado del item activo: se desliza de un item a otro */}
              {activo && (
                <motion.span
                  layoutId={idResaltado}
                  transition={RESORTE}
                  className="absolute inset-0 rounded-lg bg-primary/10 ring-1 ring-primary/15"
                >
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                </motion.span>
              )}
              {!activo && (
                <span className="absolute inset-0 rounded-lg bg-surface-hover opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              )}
              <Icono
                className={`relative h-[18px] w-[18px] shrink-0 transition-transform duration-300 group-hover:scale-110 ${
                  activo ? "" : "group-hover:-rotate-6"
                }`}
                strokeWidth={activo ? 2.3 : 1.9}
              />
              <span className="relative transition-transform duration-200 group-hover:translate-x-0.5">{item.label}</span>
            </Link>
          </motion.div>
        );
      })}
    </nav>
  );
}

export function AppShell({
  usuarioNombre,
  esDueno,
  puedeVerHistorial,
  config,
  children,
}: {
  usuarioNombre: string;
  esDueno: boolean;
  puedeVerHistorial: boolean;
  config: ConfiguracionApp;
  children: React.ReactNode;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { label: config.nav_dashboard, href: "/", icono: LayoutDashboard },
    { label: config.nav_tickets, href: "/tickets", icono: CarFront },
    { label: config.nav_servicios, href: "/servicios", icono: Sparkles },
    { label: config.nav_lavadores, href: "/lavadores", icono: Users },
    { label: config.nav_turnos, href: "/turnos", icono: Wallet },
    { label: config.nav_clientes, href: "/clientes", icono: Contact },
    { label: config.nav_inventario, href: "/inventario", icono: Package },
    { label: config.nav_reportes, href: "/reportes", icono: ChartColumn },
    { label: config.nav_gastos, href: "/gastos", icono: Receipt },
    { label: config.nav_ingresos, href: "/ingresos", icono: HandCoins },
    ...(esDueno
      ? [
          { label: "Usuarios", href: "/usuarios", icono: UserCog },
          { label: "Ajustes", href: "/ajustes", icono: Settings },
        ]
      : []),
    ...(puedeVerHistorial ? [{ label: "Histórico", href: "/historial", icono: History }] : []),
  ];

  const variablesColor = {
    "--primary": config.color_primario,
    "--accent": config.color_accent,
    "--success": config.color_success,
    "--warning": config.color_warning,
  } as React.CSSProperties;

  const marca = (
    <div className="group flex items-center gap-3 border-b border-border px-5 py-5">
      <motion.div
        whileHover={{ rotate: -8, scale: 1.06 }}
        transition={{ type: "spring", stiffness: 300, damping: 14 }}
        className="relative"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20 [animation-duration:3s]" />
        <Image
          src="/logo.jpg"
          alt="El Hongo Car Wash"
          width={52}
          height={52}
          className="relative rounded-full border-2 border-primary shadow-[0_0_0_3px_rgba(227,30,36,0.15)]"
        />
      </motion.div>
      <div>
        <p className="text-sm font-bold leading-tight text-foreground">EL HONGO</p>
        <p className="text-[10px] uppercase tracking-widest text-muted">Car Wash Admin</p>
      </div>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen" style={variablesColor}>
        {/* Menú lateral fijo en computadora */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/90 backdrop-blur-xl md:sticky md:top-0 md:flex md:h-screen">
          {marca}
          <Navegacion items={navItems} pathname={pathname} idResaltado="nav-activo-escritorio" onNavegar={() => setMenuAbierto(false)} />
        </aside>

        {/* Cajón deslizable en celular */}
        <AnimatePresence>
          {menuAbierto && (
            <>
              <motion.div
                key="fondo-menu"
                aria-hidden="true"
                onClick={() => setMenuAbierto(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] md:hidden"
              />
              <motion.aside
                key="cajon-menu"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 36 }}
                className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-surface shadow-2xl md:hidden"
              >
                {marca}
                <Navegacion items={navItems} pathname={pathname} idResaltado="nav-activo-celular" onNavegar={() => setMenuAbierto(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <motion.header
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="sticky top-0 z-30 flex items-center justify-between border-b border-black/15 bg-primary px-4 py-4 shadow-[0_2px_10px_-2px_rgba(227,30,36,0.5)] md:px-6"
          >
            <div className="flex items-center gap-3">
              <motion.button
                type="button"
                onClick={() => setMenuAbierto((v) => !v)}
                aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
                whileTap={{ scale: 0.9 }}
                className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/15 md:hidden"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={menuAbierto ? "cerrar" : "abrir"}
                    initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.18 }}
                  >
                    {menuAbierto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold uppercase text-white ring-1 ring-white/40">
                  {usuarioNombre.charAt(0)}
                </span>
                <span className="text-sm font-semibold text-white">{usuarioNombre}</span>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <form action={signOutAction}>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  className="group flex items-center gap-1.5 rounded-lg border border-white/50 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:border-white hover:bg-white/15"
                >
                  <LogOut className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  <span className="hidden sm:inline">Cerrar sesión</span>
                </motion.button>
              </form>
            </div>
          </motion.header>

          <main className="relative isolate flex flex-1 flex-col bg-background">
            {/* Fondo vivo y discreto: aurora + burbujas + logo que respira */}
            <div className="fixed inset-0 -z-10 md:left-64">
              <FondoAnimado intensidad="sutil" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-respirar relative h-[480px] w-[480px] opacity-[0.08] [mask-image:radial-gradient(circle,black_0%,black_45%,transparent_82%)] [-webkit-mask-image:radial-gradient(circle,black_0%,black_45%,transparent_82%)]">
                  <Image src="/logo.jpg" alt="" fill sizes="480px" className="object-contain" />
                </div>
              </div>
            </div>
            <div className="relative flex-1 p-4 sm:p-6">{children}</div>

            <footer className="relative px-4 pb-5 sm:px-6">
              <div className="animate-linea-brillo mb-3 h-px w-full bg-[linear-gradient(90deg,transparent,var(--primary),var(--accent),transparent)] opacity-40" />
              <p className="flex flex-wrap items-center justify-center gap-x-2 text-center text-[11px] text-muted">
                <span className="font-semibold text-foreground/80">El Hongo Car Wash</span>
                <span>·</span>
                <span>Panel de administración</span>
                <span>·</span>
                <span>{new Date().getFullYear()}</span>
              </p>
            </footer>
          </main>
        </div>

        {pathname !== "/" && <FloatingChatWidget nombreUsuario={usuarioNombre} />}
      </div>
    </MotionConfig>
  );
}
