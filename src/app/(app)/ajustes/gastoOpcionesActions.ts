"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registrarMovimiento } from "@/lib/historial";
import { nombreCategoriaGasto } from "@/lib/gastoCategorias";
import type { GastoCategoria } from "@/types/database.types";

// Opciones de gastos (productos/conceptos dentro de cada categoría general:
// Fabuloso, Luz, Extintores…) — tabla gasto_subcategorias. Ajustes es solo
// para el dueño, y el RLS de borrado también.

type OpcionInput = { nombre: string; categoria: GastoCategoria };

async function requiereDueno() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, userId: null, error: "Sesión no válida." };
  const { data: actor } = await supabase.from("usuarios").select("rol").eq("id", user.id).maybeSingle();
  if (actor?.rol !== "dueno") return { supabase, userId: null, error: "Solo el dueño puede cambiar las opciones de gastos." };
  return { supabase, userId: user.id, error: null };
}

function revalidar() {
  revalidatePath("/ajustes");
  revalidatePath("/gastos");
}

// El índice único de la tabla distingue mayúsculas — se revisa aquí sin
// distinguirlas, para no terminar con "Fabuloso" y "fabuloso" por separado.
async function nombreDuplicado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nombre: string,
  excluirId: string | null
) {
  const { data } = await supabase.from("gasto_subcategorias").select("id, nombre").ilike("nombre", nombre);
  return (data ?? []).some((o) => o.id !== excluirId);
}

export async function crearOpcionGasto(input: OpcionInput) {
  const { supabase, userId, error: permisoError } = await requiereDueno();
  if (permisoError) return { error: permisoError };

  const nombre = input.nombre.trim();
  if (!nombre) return { error: "El nombre es obligatorio." };
  if (await nombreDuplicado(supabase, nombre, null)) return { error: `Ya existe una opción llamada "${nombre}".` };

  const { data, error } = await supabase
    .from("gasto_subcategorias")
    .insert({ nombre, categoria: input.categoria })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? `Ya existe una opción llamada "${nombre}".` : error.message };

  await registrarMovimiento(
    supabase,
    userId!,
    "crear",
    "gasto",
    data.id,
    `Agregó la opción de gasto "${nombre}" (${nombreCategoriaGasto(input.categoria)})`
  );
  revalidar();
  return { error: null };
}

export async function actualizarOpcionGasto(id: string, input: OpcionInput) {
  const { supabase, userId, error: permisoError } = await requiereDueno();
  if (permisoError) return { error: permisoError };

  const nombre = input.nombre.trim();
  if (!nombre) return { error: "El nombre es obligatorio." };
  if (await nombreDuplicado(supabase, nombre, id)) return { error: `Ya existe una opción llamada "${nombre}".` };

  const { data: antes } = await supabase.from("gasto_subcategorias").select("nombre, categoria").eq("id", id).maybeSingle();

  const { error } = await supabase
    .from("gasto_subcategorias")
    .update({ nombre, categoria: input.categoria })
    .eq("id", id);
  if (error) return { error: error.code === "23505" ? `Ya existe una opción llamada "${nombre}".` : error.message };

  const cambios: string[] = [];
  if (antes && antes.nombre !== nombre) cambios.push(`nombre: ${antes.nombre} → ${nombre}`);
  if (antes && antes.categoria !== input.categoria) {
    cambios.push(
      `categoría: ${antes.categoria ? nombreCategoriaGasto(antes.categoria) : "sin categoría"} → ${nombreCategoriaGasto(input.categoria)}`
    );
  }
  await registrarMovimiento(
    supabase,
    userId!,
    "editar",
    "gasto",
    id,
    `Editó la opción de gasto "${antes?.nombre ?? nombre}"${cambios.length ? ` — ${cambios.join(", ")}` : ""}`
  );
  revalidar();
  return { error: null };
}

export async function toggleActivoOpcionGasto(id: string, activo: boolean) {
  const { supabase, userId, error: permisoError } = await requiereDueno();
  if (permisoError) return { error: permisoError };

  const { data: opcion } = await supabase.from("gasto_subcategorias").select("nombre").eq("id", id).maybeSingle();
  const { error } = await supabase.from("gasto_subcategorias").update({ activo }).eq("id", id);
  if (error) return { error: error.message };

  await registrarMovimiento(
    supabase,
    userId!,
    activo ? "activar" : "desactivar",
    "gasto",
    id,
    `${activo ? "Activó" : "Desactivó"} la opción de gasto "${opcion?.nombre ?? "—"}"`
  );
  revalidar();
  return { error: null };
}

export async function eliminarOpcionGasto(id: string) {
  const { supabase, userId, error: permisoError } = await requiereDueno();
  if (permisoError) return { error: permisoError };

  const { data: opcion } = await supabase.from("gasto_subcategorias").select("nombre").eq("id", id).maybeSingle();

  // Si ya hay gastos registrados con esta opción, borrarla rompería ese
  // historial (y las gráficas de "en qué producto se va más") — en ese caso
  // solo se permite desactivarla.
  const { count } = await supabase
    .from("gastos")
    .select("id", { count: "exact", head: true })
    .eq("subcategoria_id", id);
  if (count && count > 0) {
    return {
      error: `"${opcion?.nombre ?? "Esta opción"}" ya se usó en ${count} gasto(s), así que no se puede eliminar sin perder ese historial. Desactívala para que ya no aparezca.`,
    };
  }

  const { error } = await supabase.from("gasto_subcategorias").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { error: "Esta opción ya se usó en gastos registrados — desactívala en vez de eliminarla." };
    }
    return { error: error.message };
  }

  await registrarMovimiento(supabase, userId!, "eliminar", "gasto", id, `Eliminó la opción de gasto "${opcion?.nombre ?? "—"}"`);
  revalidar();
  return { error: null };
}
