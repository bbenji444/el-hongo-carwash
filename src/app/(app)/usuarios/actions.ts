"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database, RolUsuario } from "@/types/database.types";

async function requiereDueno() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, actorId: null, error: "Sesión no válida." };

  const { data: actor } = await supabase.from("usuarios").select("rol").eq("id", user.id).maybeSingle();

  if (!actor || actor.rol !== "dueno") {
    return { supabase, actorId: user.id, error: "Solo el dueño puede administrar usuarios." };
  }

  return { supabase, actorId: user.id, error: null };
}

// Cliente con la service role key: puede crear/editar cuentas de auth.users
// directamente (correo, contraseña, confirmación) sin pasar por el flujo
// normal de signUp. Nunca se expone al navegador — solo vive en server
// actions, protegidas además por requiereDueno().
function crearClienteAdmin() {
  return createSupabaseJsClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function crearUsuario(input: { nombre: string; correo: string; password: string; rol: RolUsuario }) {
  const { supabase, error: permisoError } = await requiereDueno();
  if (permisoError) return { error: permisoError };

  const admin = crearClienteAdmin();

  // email_confirm: true crea la cuenta ya confirmada — el correo aquí
  // funciona como nombre de usuario, no hace falta que sea una dirección
  // real ni que nadie confirme nada.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.correo,
    password: input.password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return { error: authError?.message ?? "No se pudo crear la cuenta." };
  }

  const { error: insertError } = await supabase.from("usuarios").insert({
    id: authData.user.id,
    nombre: input.nombre,
    rol: input.rol,
  });

  if (insertError) {
    // Si falla el alta en public.usuarios, no dejar huérfana la cuenta de
    // auth que sí se alcanzó a crear.
    await admin.auth.admin.deleteUser(authData.user.id);
    return { error: insertError.message };
  }

  revalidatePath("/usuarios");
  return { error: null };
}

export async function actualizarUsuario(
  id: string,
  input: { nombre: string; rol: RolUsuario; correo?: string; password?: string }
) {
  const { supabase, actorId, error: permisoError } = await requiereDueno();
  if (permisoError) return { error: permisoError };

  if (id === actorId && input.rol !== "dueno") {
    return { error: "No puedes quitarte a ti mismo el rol de dueño." };
  }

  if (input.correo || input.password) {
    const admin = crearClienteAdmin();
    const cambios: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (input.correo) {
      cambios.email = input.correo;
      cambios.email_confirm = true;
    }
    if (input.password) cambios.password = input.password;

    const { error: authError } = await admin.auth.admin.updateUserById(id, cambios);
    if (authError) return { error: authError.message };
  }

  const { error } = await supabase.from("usuarios").update({ nombre: input.nombre, rol: input.rol }).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/usuarios");
  return { error: null };
}

export async function toggleActivoUsuario(id: string, activo: boolean) {
  const { supabase, actorId, error: permisoError } = await requiereDueno();
  if (permisoError) return { error: permisoError };

  if (id === actorId && !activo) {
    return { error: "No puedes desactivar tu propia cuenta." };
  }

  const { error } = await supabase.from("usuarios").update({ activo }).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/usuarios");
  return { error: null };
}
