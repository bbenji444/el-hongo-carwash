"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function cerrarTurno(turnoId: string, efectivoContado: number) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sesión no válida." };

  const { error } = await supabase
    .from("turnos")
    .update({
      estado: "cerrado",
      efectivo_contado: efectivoContado,
      usuario_cierre_id: user.id,
      hora_cierre: new Date().toISOString(),
    })
    .eq("id", turnoId);

  if (error) return { error: error.message };

  revalidatePath("/turnos");
  revalidatePath("/tickets");
  return { error: null };
}
