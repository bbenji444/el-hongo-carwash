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

export async function crearUsuario(input: { nombre: string; correo: string; password: string; rol: RolUsuario }) {
  const { supabase, error: permisoError } = await requiereDueno();
  if (permisoError) return { error: permisoError };

  // Cliente aislado (sin persistSession) para no pisar la sesión del dueño
  // con la del usuario recién creado — mismo patrón que solicitarDescuento
  // en tickets/actions.ts.
  const isolatedClient = createSupabaseJsClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: authData, error: authError } = await isolatedClient.auth.signUp({
    email: input.correo,
    password: input.password,
  });

  if (authError || !authData.user) {
    return { error: authError?.message ?? "No se pudo crear la cuenta." };
  }

  const { error: insertError } = await supabase.from("usuarios").insert({
    id: authData.user.id,
    nombre: input.nombre,
    rol: input.rol,
  });

  if (insertError) return { error: insertError.message };

  revalidatePath("/usuarios");
  return { error: null };
}

export async function actualizarUsuario(id: string, input: { nombre: string; rol: RolUsuario }) {
  const { supabase, actorId, error: permisoError } = await requiereDueno();
  if (permisoError) return { error: permisoError };

  if (id === actorId && input.rol !== "dueno") {
    return { error: "No puedes quitarte a ti mismo el rol de dueño." };
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
