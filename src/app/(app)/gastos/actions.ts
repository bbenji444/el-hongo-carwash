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

export async function actualizarGasto(
  gastoId: string,
  input: { concepto: string; monto: number; fecha: string; notas: string | null }
) {
  const { supabase, error: permisoError } = await requiereDuenoOEncargado();
  if (permisoError) return { error: permisoError };

  const { error } = await supabase
    .from("gastos")
    .update({
      concepto: input.concepto,
      monto: input.monto,
      fecha: input.fecha,
      notas: input.notas,
    })
    .eq("id", gastoId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Renglones de producto ("orden de compra"): en vez de registrar cada
// insumo como un gasto separado, un solo gasto puede llevar varios
// renglones (producto, cantidad, precio unitario). El monto del gasto se
// recalcula solo con la suma de sus renglones (trigger en la base de
// datos), así que aquí solo se administran los renglones.
// ---------------------------------------------------------------------------

export async function agregarGastoItem(
  gastoId: string,
  input: { producto: string; cantidad: number; precioUnitario: number }
) {
  const { supabase, error: permisoError } = await requiereDuenoOEncargado();
  if (permisoError) return { data: null, error: permisoError };

  const { data, error } = await supabase
    .from("gasto_items")
    .insert({
      gasto_id: gastoId,
      producto: input.producto,
      cantidad: input.cantidad,
      precio_unitario: input.precioUnitario,
    })
    .select("id, producto, cantidad, precio_unitario")
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath("/", "layout");
  return {
    data: { id: data.id, producto: data.producto, cantidad: data.cantidad, precioUnitario: data.precio_unitario },
    error: null,
  };
}

export async function actualizarGastoItem(
  itemId: string,
  input: { producto: string; cantidad: number; precioUnitario: number }
) {
  const { supabase, error: permisoError } = await requiereDuenoOEncargado();
  if (permisoError) return { error: permisoError };

  const { error } = await supabase
    .from("gasto_items")
    .update({ producto: input.producto, cantidad: input.cantidad, precio_unitario: input.precioUnitario })
    .eq("id", itemId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}

export async function eliminarGastoItem(itemId: string) {
  const { supabase, error: permisoError } = await requiereDuenoOEncargado();
  if (permisoError) return { error: permisoError };

  const { error } = await supabase.from("gasto_items").delete().eq("id", itemId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Archivos adjuntos: un gasto puede tener varios (varias fotos del mismo
// ticket, o el ticket completo de una orden de compra con varios productos).
// ---------------------------------------------------------------------------

const TIPOS_ARCHIVO_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// Sube una foto/PDF del ticket de compra a Supabase Storage (bucket privado
// "gastos") y agrega un renglón en gasto_archivos — se puede llamar varias
// veces por gasto para adjuntar más de un archivo.
export async function subirArchivoGasto(gastoId: string, formData: FormData) {
  const { supabase, error: permisoError } = await requiereDuenoOEncargado();
  if (permisoError) return { data: null, error: permisoError };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { data: null, error: "No se recibió ningún archivo." };
  }
  if (!TIPOS_ARCHIVO_PERMITIDOS.includes(archivo.type)) {
    return { data: null, error: "Solo se aceptan imágenes (JPG, PNG, WEBP, HEIC) o PDF." };
  }

  const nombreLimpio = archivo.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${gastoId}/${Date.now()}-${nombreLimpio}`;

  const { error: uploadError } = await supabase.storage
    .from("gastos")
    .upload(path, archivo, { contentType: archivo.type, upsert: false });

  if (uploadError) return { data: null, error: uploadError.message };

  const { data, error } = await supabase
    .from("gasto_archivos")
    .insert({ gasto_id: gastoId, archivo_path: path, archivo_nombre: archivo.name, archivo_tipo: archivo.type })
    .select("id, archivo_nombre, archivo_tipo")
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath("/", "layout");
  return { data: { id: data.id, nombre: data.archivo_nombre, tipo: data.archivo_tipo }, error: null };
}

export async function eliminarArchivoGasto(archivoId: string) {
  const { supabase, error: permisoError } = await requiereDuenoOEncargado();
  if (permisoError) return { error: permisoError };

  const { data: archivo } = await supabase
    .from("gasto_archivos")
    .select("archivo_path")
    .eq("id", archivoId)
    .maybeSingle();

  const { error } = await supabase.from("gasto_archivos").delete().eq("id", archivoId);
  if (error) return { error: error.message };

  if (archivo?.archivo_path) {
    // Solo limpieza — si falla no bloquea el borrado, que ya se completó.
    await supabase.storage.from("gastos").remove([archivo.archivo_path]);
  }

  revalidatePath("/", "layout");
  return { error: null };
}

// Formatos que un navegador sí puede mostrar directo (img/iframe). HEIC/HEIF
// (el formato nativo de fotos del iPhone) no está en la lista a propósito:
// ningún navegador lo renderiza sin convertirlo primero — para esos solo se
// ofrece descargar.
const TIPOS_PREVISUALIZABLES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

// Genera una URL firmada de corta duración para ver un archivo — el bucket
// es privado, así que no hay una URL pública fija que se pueda guardar.
export async function obtenerUrlArchivoGasto(archivoId: string) {
  const { supabase, error: permisoError } = await requiereDuenoOEncargado();
  if (permisoError) return { data: null, error: permisoError };

  const { data: archivo, error: archivoError } = await supabase
    .from("gasto_archivos")
    .select("archivo_path, archivo_nombre, archivo_tipo")
    .eq("id", archivoId)
    .maybeSingle();

  if (archivoError) return { data: null, error: archivoError.message };
  if (!archivo) return { data: null, error: "Este archivo ya no existe." };

  const { data, error } = await supabase.storage.from("gastos").createSignedUrl(archivo.archivo_path, 3600);

  if (error) return { data: null, error: error.message };

  return {
    data: {
      url: data.signedUrl,
      nombre: archivo.archivo_nombre,
      tipo: archivo.archivo_tipo,
      previsualizable: Boolean(archivo.archivo_tipo && TIPOS_PREVISUALIZABLES.includes(archivo.archivo_tipo)),
    },
    error: null,
  };
}

export async function eliminarGasto(gastoId: string) {
  const { supabase, error: permisoError } = await requiereDuenoOEncargado();
  if (permisoError) return { error: permisoError };

  const { data: archivos } = await supabase.from("gasto_archivos").select("archivo_path").eq("gasto_id", gastoId);

  const { error } = await supabase.from("gastos").delete().eq("id", gastoId);

  if (error) return { error: error.message };

  if (archivos && archivos.length > 0) {
    // Solo limpieza — si falla no bloquea el borrado del gasto, que ya se
    // completó (gasto_archivos y gasto_items se borran solos por cascada).
    await supabase.storage.from("gastos").remove(archivos.map((a) => a.archivo_path));
  }

  revalidatePath("/", "layout");
  return { error: null };
}
