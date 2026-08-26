import { createClient } from "@/lib/supabase/server";
import type { Inventario } from "@/types/database.types";

export type DatosInventario = {
  insumos: Inventario[];
  totalInsumos: number;
  numAgotados: number;
  numBajo: number;
  valorTotalInventario: number;
  soloBajo: boolean;
  generadoEn: string;
};

export async function obtenerDatosInventario(soloBajo: boolean): Promise<DatosInventario> {
  const supabase = await createClient();

  const { data } = await supabase.from("inventario").select("*").order("nombre_insumo");
  const todos = data ?? [];

  const numAgotados = todos.filter((i) => i.stock_actual <= 0).length;
  const numBajo = todos.filter((i) => i.stock_actual > 0 && i.stock_actual <= i.stock_minimo).length;
  const valorTotalInventario = todos.reduce((acc, i) => acc + i.stock_actual * i.costo_unitario, 0);
  const insumos = soloBajo ? todos.filter((i) => i.stock_actual <= i.stock_minimo) : todos;

  return {
    insumos,
    totalInsumos: todos.length,
    numAgotados,
    numBajo,
    valorTotalInventario,
    soloBajo,
    generadoEn: new Date().toISOString(),
  };
}
