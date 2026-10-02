import type { GastoCategoria } from "@/types/database.types";

export const CATEGORIAS_GASTO: { value: GastoCategoria; label: string }[] = [
  { value: "nomina", label: "Nómina" },
  { value: "insumos", label: "Insumos/Productos" },
  { value: "servicios", label: "Servicios (luz, agua, internet)" },
  { value: "renta", label: "Renta" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "otros", label: "Otros" },
];

const LABEL_POR_CATEGORIA = new Map(CATEGORIAS_GASTO.map((c) => [c.value, c.label]));

export function nombreCategoriaGasto(categoria: GastoCategoria): string {
  return LABEL_POR_CATEGORIA.get(categoria) ?? categoria;
}
