"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CONFIGURACION_DEFAULT } from "@/lib/configuracion";
import type { ConfiguracionApp } from "@/types/database.types";

export type ConfiguracionInput = Omit<ConfiguracionApp, "id">;

function revalidarTodo() {
  // La configuración se lee en casi toda la app (sidebar, colores, emojis,
  // semáforo), así que se invalida todo en vez de tratar de enumerar cada
  // ruta que la usa.
  revalidatePath("/", "layout");
}

export async function actualizarConfiguracion(input: ConfiguracionInput) {
  const supabase = await createClient();

  const { error } = await supabase.from("configuracion_app").update(input).eq("id", true);

  if (error) return { error: error.message };

  revalidarTodo();
  return { error: null };
}

export async function restablecerConfiguracion() {
  const supabase = await createClient();

  const defaults: ConfiguracionInput = {
    nav_dashboard: CONFIGURACION_DEFAULT.nav_dashboard,
    nav_tickets: CONFIGURACION_DEFAULT.nav_tickets,
    nav_servicios: CONFIGURACION_DEFAULT.nav_servicios,
    nav_lavadores: CONFIGURACION_DEFAULT.nav_lavadores,
    nav_turnos: CONFIGURACION_DEFAULT.nav_turnos,
    nav_clientes: CONFIGURACION_DEFAULT.nav_clientes,
    nav_inventario: CONFIGURACION_DEFAULT.nav_inventario,
    nav_reportes: CONFIGURACION_DEFAULT.nav_reportes,
    emoji_saludo: CONFIGURACION_DEFAULT.emoji_saludo,
    emoji_lavador: CONFIGURACION_DEFAULT.emoji_lavador,
    emoji_automovil: CONFIGURACION_DEFAULT.emoji_automovil,
    emoji_camioneta_chica: CONFIGURACION_DEFAULT.emoji_camioneta_chica,
    emoji_camioneta_grande: CONFIGURACION_DEFAULT.emoji_camioneta_grande,
    emoji_camioneta_extra_grande: CONFIGURACION_DEFAULT.emoji_camioneta_extra_grande,
    color_primario: CONFIGURACION_DEFAULT.color_primario,
    color_accent: CONFIGURACION_DEFAULT.color_accent,
    color_success: CONFIGURACION_DEFAULT.color_success,
    color_warning: CONFIGURACION_DEFAULT.color_warning,
    semaforo_alerta_min: CONFIGURACION_DEFAULT.semaforo_alerta_min,
    semaforo_critico_min: CONFIGURACION_DEFAULT.semaforo_critico_min,
  };

  const { error } = await supabase.from("configuracion_app").update(defaults).eq("id", true);

  if (error) return { error: error.message };

  revalidarTodo();
  return { error: null };
}
