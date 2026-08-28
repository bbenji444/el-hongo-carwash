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
//
// Si falta la variable de entorno (p. ej. se agregó solo en local y no en
// el hosting de producción), antes esto tronaba con un error sin manejar
// que rompía toda la pantalla — ahora se detecta antes y se regresa un
// mensaje claro en vez de reventar la acción del servidor.
function crearClienteAdmin(): { admin: ReturnType<typeof createSupabaseJsClient<Database>> | null; error: string | null } {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return {
      admin: null,
      error:
        "Falta configurar SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor donde corre la app.",
    };
  }
  return {
    admin: createSupabaseJsClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    error: null,
  };
}

export async function crearUsuario(input: {
  nombre: string;
  correo: string;
  password: string;
  rol: RolUsuario;
  puedeEditarTickets: boolean;
  puedeEditarTurnos: boolean;
}) {
  const { supabase, error: permisoError } = await requiereDueno();
  if (permisoError) return { error: permisoError };

  const { admin, error: adminError } = crearClienteAdmin();
  if (adminError || !admin) return { error: adminError ?? "No se pudo preparar la creación de la cuenta." };

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
    puede_editar_tickets: input.puedeEditarTickets,
    puede_editar_turnos: input.puedeEditarTurnos,
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
  input: {
    nombre: string;
    rol: RolUsuario;
    puedeEditarTickets: boolean;
    puedeEditarTurnos: boolean;
    correo?: string;
    password?: string;
  }
) {
  const { supabase, actorId, error: permisoError } = await requiereDueno();
  if (permisoError) return { error: permisoError };

  if (id === actorId && input.rol !== "dueno") {
    return { error: "No puedes quitarte a ti mismo el rol de dueño." };
  }

  if (input.correo || input.password) {
    const { admin, error: adminError } = crearClienteAdmin();
    if (adminError || !admin) return { error: adminError ?? "No se pudo preparar la actualización de la cuenta." };
    const cambios: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (input.correo) {
      cambios.email = input.correo;
      cambios.email_confirm = true;
    }
    if (input.password) cambios.password = input.password;

    const { error: authError } = await admin.auth.admin.updateUserById(id, cambios);
    if (authError) return { error: authError.message };
  }

  const { error } = await supabase
    .from("usuarios")
    .update({
      nombre: input.nombre,
      rol: input.rol,
      puede_editar_tickets: input.puedeEditarTickets,
      puede_editar_turnos: input.puedeEditarTurnos,
    })
    .eq("id", id);

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
