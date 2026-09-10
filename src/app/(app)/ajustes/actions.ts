"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CONFIGURACION_DEFAULT, TAG_CONFIGURACION } from "@/lib/configuracion";
import type { ConfiguracionApp } from "@/types/database.types";

export type ConfiguracionInput = Omit<ConfiguracionApp, "id">;

function revalidarTodo() {
  // revalidatePath refresca las páginas ya renderizadas; revalidateTag es
  // lo que de verdad obliga a que obtenerConfiguracion() vuelva a leer de
  // Supabase la próxima vez (vive en su propia Data Cache, ver
  // src/lib/configuracion.ts) — sin esto, un cambio aquí podía tardar
  // hasta una hora en reflejarse en el resto de la app.
  revalidatePath("/", "layout");
  revalidateTag(TAG_CONFIGURACION);
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
    nav_gastos: CONFIGURACION_DEFAULT.nav_gastos,
    nav_ingresos: CONFIGURACION_DEFAULT.nav_ingresos,
    emoji_saludo: CONFIGURACION_DEFAULT.emoji_saludo,
    emoji_lavador: CONFIGURACION_DEFAULT.emoji_lavador,
    emoji_automovil: CONFIGURACION_DEFAULT.emoji_automovil,
    emoji_camioneta_chica: CONFIGURACION_DEFAULT.emoji_camioneta_chica,
    emoji_camioneta_grande: CONFIGURACION_DEFAULT.emoji_camioneta_grande,
    emoji_camioneta_extra_grande: CONFIGURACION_DEFAULT.emoji_camioneta_extra_grande,
    emoji_moto_chica: CONFIGURACION_DEFAULT.emoji_moto_chica,
    emoji_moto_grande: CONFIGURACION_DEFAULT.emoji_moto_grande,
    color_primario: CONFIGURACION_DEFAULT.color_primario,
    color_accent: CONFIGURACION_DEFAULT.color_accent,
    color_success: CONFIGURACION_DEFAULT.color_success,
    color_warning: CONFIGURACION_DEFAULT.color_warning,
    semaforo_alerta_min: CONFIGURACION_DEFAULT.semaforo_alerta_min,
    semaforo_critico_min: CONFIGURACION_DEFAULT.semaforo_critico_min,
    lealtad_sexta_lavada_activa: CONFIGURACION_DEFAULT.lealtad_sexta_lavada_activa,
  };

  const { error } = await supabase.from("configuracion_app").update(defaults).eq("id", true);

  if (error) return { error: error.message };

  revalidarTodo();
  return { error: null };
}
