"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requiereDuenoOEncargado() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, error: "Sesión no válida." };

  const { data: actor } = await supabase.from("usuarios").select("rol").eq("id", user.id).maybeSingle();

  if (!actor || !["dueno", "encargado"].includes(actor.rol)) {
    return { supabase, error: "No tienes permiso para administrar gastos." };
  }

  return { supabase, userId: user.id, error: null };
}

export async function crearGasto(input: { concepto: string; monto: number; fecha: string; notas: string | null }) {
  const { supabase, userId, error: permisoError } = await requiereDuenoOEncargado();
  if (permisoError) return { data: null, error: permisoError };

  const { data, error } = await supabase
    .from("gastos")
    .insert({
      concepto: input.concepto,
      monto: input.monto,
      fecha: input.fecha,
      notas: input.notas,
      creado_por: userId!,
    })
    .select("id")
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath("/", "layout");
  return { data, error: null };
}

const TIPOS_ARCHIVO_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// Sube la foto/PDF del ticket de compra a Supabase Storage (bucket privado
// "gastos") y guarda la ruta en el gasto. Se sube DESPUÉS de crear el
// gasto (necesita su id para armar la ruta), no en el mismo paso.
export async function subirArchivoGasto(gastoId: string, formData: FormData) {
  const { supabase, error: permisoError } = await requiereDuenoOEncargado();
  if (permisoError) return { error: permisoError };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "No se recibió ningún archivo." };
  }
  if (!TIPOS_ARCHIVO_PERMITIDOS.includes(archivo.type)) {
    return { error: "Solo se aceptan imágenes (JPG, PNG, WEBP, HEIC) o PDF." };
  }

  const nombreLimpio = archivo.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${gastoId}/${Date.now()}-${nombreLimpio}`;

  const { error: uploadError } = await supabase.storage
    .from("gastos")
    .upload(path, archivo, { contentType: archivo.type, upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase
    .from("gastos")
    .update({ archivo_path: path, archivo_nombre: archivo.name })
    .eq("id", gastoId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}

// Genera una URL firmada de corta duración para ver el archivo — el bucket
// es privado, así que no hay una URL pública fija que se pueda guardar.
export async function obtenerUrlArchivoGasto(gastoId: string) {
  const { supabase, error: permisoError } = await requiereDuenoOEncargado();
  if (permisoError) return { data: null, error: permisoError };

  const { data: gasto, error: gastoError } = await supabase
    .from("gastos")
    .select("archivo_path")
    .eq("id", gastoId)
    .maybeSingle();

  if (gastoError) return { data: null, error: gastoError.message };
  if (!gasto?.archivo_path) return { data: null, error: "Este gasto no tiene archivo adjunto." };

  const { data, error } = await supabase.storage.from("gastos").createSignedUrl(gasto.archivo_path, 3600);

  if (error) return { data: null, error: error.message };

  return { data: data.signedUrl, error: null };
}

export async function eliminarGasto(gastoId: string) {
  const { supabase, error: permisoError } = await requiereDuenoOEncargado();
  if (permisoError) return { error: permisoError };

  const { data: gasto } = await supabase.from("gastos").select("archivo_path").eq("id", gastoId).maybeSingle();

  const { error } = await supabase.from("gastos").delete().eq("id", gastoId);

  if (error) return { error: error.message };

  if (gasto?.archivo_path) {
    // Solo limpieza — si falla no bloquea el borrado del gasto, que ya se
    // completó.
    await supabase.storage.from("gastos").remove([gasto.archivo_path]);
  }

  revalidatePath("/", "layout");
  return { error: null };
}
