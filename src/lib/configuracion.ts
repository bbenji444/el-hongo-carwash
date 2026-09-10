import { cache } from "react";
import { unstable_cache as nextCache } from "next/cache";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type { ConfiguracionApp, Database } from "@/types/database.types";
import { CONFIGURACION_DEFAULT } from "@/lib/configuracionDefaults";

export { CONFIGURACION_DEFAULT, emojiPorTamano } from "@/lib/configuracionDefaults";

export const TAG_CONFIGURACION = "configuracion";

// Se lee con la service role (no con el cliente de la sesión del usuario)
// a propósito: unstable_cache no puede depender de cookies()/headers() de
// la petición en curso, y el cliente normal necesita las cookies para
// autenticar la consulta contra RLS. configuracion_app no es información
// sensible por usuario (son textos del menú, colores, emojis), así que
// leerla con la service role aquí es seguro.
async function leerConfiguracionSinCache(): Promise<ConfiguracionApp> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return CONFIGURACION_DEFAULT;

  const admin = createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await admin.from("configuracion_app").select("*").eq("id", true).maybeSingle();
  return data ?? CONFIGURACION_DEFAULT;
}

// La configuración se lee en CADA página de la app (el layout raíz la
// necesita para el sidebar/colores/emojis) pero casi nunca cambia — solo
// cuando el dueño guarda algo en Ajustes. Antes se pedía a Supabase en
// cada navegación (aunque revalidatePath("/", "layout") de otras acciones
// —crear un ticket, cobrar, etc.— no tiene nada que ver con esto, igual
// forzaba a que el layout se re-renderizara y volviera a consultarla).
// Ahora vive en la Data Cache de Next.js, y solo se vuelve a pedir cuando
// actualizarConfiguracion/restablecerConfiguracion la invalidan a propósito
// (revalidateTag) — el resto del tiempo es una lectura en memoria, sin
// viaje de red a la base de datos.
const obtenerConfiguracionCacheada = nextCache(leerConfiguracionSinCache, ["configuracion_app"], {
  tags: [TAG_CONFIGURACION],
  revalidate: 3600,
});

// cache() de React deduplica además DENTRO del mismo request (el layout y
// la página que se renderizan juntos piden la configuración cada uno, pero
// aquí ni siquiera se toca la Data Cache dos veces).
export const obtenerConfiguracion = cache(obtenerConfiguracionCacheada);
