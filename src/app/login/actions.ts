"use server";

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

// Mismo mensaje sin importar si el "usuario" no existe o si la contraseña
// está mal — no hay que dejarle saber a quien intenta entrar cuáles
// nombres sí son cuentas reales.
const ERROR_GENERICO = "Usuario o contraseña incorrectos.";

function crearClienteAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// El login ya no pide correo, pide el nombre con el que se ve a cada quien
// en la app ("Benjamin", no "benjamin@elhongo.com") — pero Supabase Auth
// por dentro sigue identificando cuentas por correo, así que aquí se busca
// primero el correo real ligado a ese nombre (con el cliente de service
// role, porque esta búsqueda pasa ANTES de que la persona esté
// autenticada) y luego sí se inicia sesión normal con ese correo.
export async function iniciarSesionConUsuario(nombreIngresado: string, password: string) {
  const nombreLimpio = nombreIngresado.trim();
  if (!nombreLimpio || !password) return { error: ERROR_GENERICO };

  const admin = crearClienteAdmin();
  if (!admin) return { error: "Falta configuración del servidor. Contacta al dueño." };

  // ilike sin comodines (%) es un "igual" normal pero sin distinguir
  // mayúsculas/minúsculas — así "benjamin", "Benjamin" o "BENJAMIN" entran
  // igual de bien.
  const { data: candidatos } = await admin.from("usuarios").select("id").ilike("nombre", nombreLimpio).limit(1);

  const usuarioEncontrado = candidatos?.[0];
  if (!usuarioEncontrado) return { error: ERROR_GENERICO };

  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(usuarioEncontrado.id);
  if (authUserError || !authUser.user?.email) return { error: ERROR_GENERICO };

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: authUser.user.email,
    password,
  });

  if (authError || !authData.user) return { error: ERROR_GENERICO };

  const { data: usuario } = await supabase.from("usuarios").select("activo").eq("id", authData.user.id).maybeSingle();

  if (!usuario || !usuario.activo) {
    await supabase.auth.signOut();
    return { error: "Tu cuenta no está autorizada en el sistema. Contacta al dueño." };
  }

  return { error: null };
}
