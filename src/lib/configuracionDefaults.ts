import type { ConfiguracionApp } from "@/types/database.types";

// Sin dependencias de servidor (no importa next/headers ni supabase), así
// que es seguro importar esto tanto desde Server Components como desde
// Client Components (p. ej. NuevoTicketModal necesita emojiPorTamano).

// Valores de respaldo si por alguna razón el renglón singleton no existe
// todavía (p. ej. la migración no se ha corrido) — así el resto de la app
// nunca se rompe por falta de configuración.
export const CONFIGURACION_DEFAULT: ConfiguracionApp = {
  id: true,
  nav_dashboard: "Dashboard",
  nav_tickets: "Tickets",
  nav_servicios: "Servicios",
  nav_lavadores: "Lavadores",
  nav_turnos: "Caja y turnos",
  nav_clientes: "Clientes",
  nav_inventario: "Inventario",
  nav_reportes: "Reportes",
  nav_gastos: "Gastos",
  emoji_saludo: "👋🏻",
  emoji_lavador: "🧑🏻‍🔧",
  emoji_automovil: "🚗",
  emoji_camioneta_chica: "🚙",
  emoji_camioneta_grande: "🚐",
  emoji_camioneta_extra_grande: "🚚",
  emoji_moto_chica: "🛵",
  emoji_moto_grande: "🏍️",
  color_primario: "#e31e24",
  color_accent: "#0077cc",
  color_success: "#16a34a",
  color_warning: "#b45309",
  semaforo_alerta_min: 25,
  semaforo_critico_min: 35,
};

export function emojiPorTamano(config: ConfiguracionApp, tamano: string): string {
  switch (tamano) {
    case "automovil":
      return config.emoji_automovil;
    case "camioneta_chica":
      return config.emoji_camioneta_chica;
    case "camioneta_grande":
      return config.emoji_camioneta_grande;
    case "camioneta_extra_grande":
      return config.emoji_camioneta_extra_grande;
    case "moto_chica":
      return config.emoji_moto_chica;
    case "moto_grande":
      return config.emoji_moto_grande;
    default:
      return "🚗";
  }
}
