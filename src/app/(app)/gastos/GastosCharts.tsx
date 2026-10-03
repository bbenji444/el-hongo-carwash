"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GastoCategoria } from "@/types/database.types";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

const COLORES_CATEGORIA = [
  "var(--primary)",
  "var(--accent)",
  "var(--warning)",
  "#8b5cf6",
  "#0891b2",
  "var(--success)",
];

export type GastoPorCategoria = { categoria: GastoCategoria; nombre: string; total: number };

// Barras horizontales, una por categoría, de mayor a menor — así se ve de
// un vistazo en qué se va más el dinero sin tener que leer números.
// seleccionada/onSeleccionar permiten usar la gráfica misma como filtro:
// clic en una barra filtra la tabla de abajo a esa categoría.
export function GastosPorCategoriaChart({
  data,
  seleccionada,
  onSeleccionar,
}: {
  data: GastoPorCategoria[];
  seleccionada: GastoCategoria | null;
  onSeleccionar: (categoria: GastoCategoria) => void;
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-[220px] items-center justify-center text-sm text-muted">
        Sin gastos registrados en este período.
      </p>
    );
  }

  const altura = Math.max(160, data.length * 44);

  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="nombre"
          stroke="var(--muted)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={140}
        />
        <Tooltip
          cursor={{ fill: "var(--primary)", fillOpacity: 0.06 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as GastoPorCategoria;
            return (
              <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
                <p className="font-medium text-foreground">{p.nombre}</p>
                <p className="text-muted">{money(p.total)}</p>
              </div>
            );
          }}
        />
        <Bar
          dataKey="total"
          radius={[0, 8, 8, 0]}
          maxBarSize={28}
          animationDuration={700}
          animationEasing="ease-out"
          cursor="pointer"
          onClick={(entry) => {
            // El dato original va en entry.payload, no en entry mismo
            // (entry trae las coordenadas/props del rectángulo dibujado).
            const p = (entry as unknown as { payload?: GastoPorCategoria }).payload;
            if (p) onSeleccionar(p.categoria);
          }}
        >
          {data.map((d, i) => (
            <Cell
              key={d.categoria}
              fill={COLORES_CATEGORIA[i % COLORES_CATEGORIA.length]}
              fillOpacity={seleccionada && seleccionada !== d.categoria ? 0.35 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export type GastoPorSubcategoria = { subcategoriaId: string; nombre: string; total: number };

// Mismo tipo de gráfica que arriba, pero por producto específico
// (subcategoría: Shampoo, Abrillantador, etc.) en vez de por categoría
// general — para responder "¿en qué producto concreto se va más el
// dinero?". Solo entra aquí lo que sí tiene subcategoría asignada.
export function GastosPorSubcategoriaChart({
  data,
  seleccionada,
  onSeleccionar,
}: {
  data: GastoPorSubcategoria[];
  seleccionada: string | null;
  onSeleccionar: (subcategoriaId: string) => void;
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-[160px] items-center justify-center text-sm text-muted">
        Ningún gasto de este período tiene un producto específico asignado todavía.
      </p>
    );
  }

  const altura = Math.max(160, data.length * 44);

  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="nombre"
          stroke="var(--muted)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={140}
        />
        <Tooltip
          cursor={{ fill: "var(--accent)", fillOpacity: 0.06 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as GastoPorSubcategoria;
            return (
              <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
                <p className="font-medium text-foreground">{p.nombre}</p>
                <p className="text-muted">{money(p.total)}</p>
              </div>
            );
          }}
        />
        <Bar
          dataKey="total"
          radius={[0, 8, 8, 0]}
          maxBarSize={28}
          animationDuration={700}
          animationEasing="ease-out"
          cursor="pointer"
          onClick={(entry) => {
            const p = (entry as unknown as { payload?: GastoPorSubcategoria }).payload;
            if (p) onSeleccionar(p.subcategoriaId);
          }}
        >
          {data.map((d, i) => (
            <Cell
              key={d.subcategoriaId}
              fill={COLORES_CATEGORIA[i % COLORES_CATEGORIA.length]}
              fillOpacity={seleccionada && seleccionada !== d.subcategoriaId ? 0.35 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
