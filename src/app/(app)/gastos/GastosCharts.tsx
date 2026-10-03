"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

// Dona (pie con hueco en medio) — una rebanada por categoría. Clic en una
// rebanada o en su nombre en la leyenda filtra la tabla de abajo.
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

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Tooltip
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
        <Pie
          data={data}
          dataKey="total"
          nameKey="nombre"
          innerRadius={64}
          outerRadius={100}
          paddingAngle={data.length > 1 ? 2 : 0}
          cursor="pointer"
          animationDuration={700}
          animationEasing="ease-out"
          onClick={(entry) => {
            // El dato original va en entry.payload, no en entry mismo.
            const p = (entry as unknown as { payload?: GastoPorCategoria }).payload;
            if (p) onSeleccionar(p.categoria);
          }}
        >
          {data.map((d, i) => (
            <Cell
              key={d.categoria}
              fill={COLORES_CATEGORIA[i % COLORES_CATEGORIA.length]}
              fillOpacity={seleccionada && seleccionada !== d.categoria ? 0.35 : 1}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Legend
          verticalAlign="bottom"
          height={48}
          wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
          formatter={(value) => <span style={{ color: "var(--foreground)" }}>{value}</span>}
          onClick={(legendEntry) => {
            // El payload exacto de un renglón de leyenda varía según el
            // tipo de gráfica — lo confiable es "value" (el nombre que se
            // ve), así que se busca el dato por nombre en vez de adivinar
            // la forma del payload.
            const match = data.find((d) => d.nombre === legendEntry.value);
            if (match) onSeleccionar(match.categoria);
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export type GastoPorSubcategoria = { subcategoriaId: string; nombre: string; total: number };

// Barras horizontales por producto específico (Shampoo, Abrillantador,
// etc.) — para responder "¿en qué producto concreto se va más el dinero?".
// Se queda como barras (no dona) a propósito: la lista de productos crece
// con el tiempo y una dona con muchas rebanadas se vuelve ilegible: el
// contenedor que la envuelve (en GastosClient) le pone un alto máximo con
// scroll propio, para no alargar toda la página.
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

  const altura = Math.max(160, data.length * 40);

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
          maxBarSize={24}
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

export type GastoPorMes = { mes: string; etiqueta: string; total: number };

// Barras verticales, una por mes (últimos 12), para ver la tendencia de
// gasto en el tiempo de un vistazo. Clic en un mes manda a ver ese mes
// específico (lo resuelve GastosClient, que es quien sabe navegar).
export function GastosPorMesChart({ data, onSeleccionarMes }: { data: GastoPorMes[]; onSeleccionarMes: (mes: string) => void }) {
  const sinDatos = data.every((d) => d.total === 0);
  if (sinDatos) {
    return (
      <p className="flex h-[220px] items-center justify-center text-sm text-muted">
        Sin gastos registrados en los últimos 12 meses.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="barGastosMes" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="etiqueta" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} width={56} />
        <Tooltip
          cursor={{ fill: "var(--primary)", fillOpacity: 0.06 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as GastoPorMes;
            return (
              <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
                <p className="mb-0.5 font-medium text-foreground">{label}</p>
                <p className="text-muted">{money(p.total)}</p>
              </div>
            );
          }}
        />
        <Bar
          dataKey="total"
          fill="url(#barGastosMes)"
          radius={[6, 6, 0, 0]}
          maxBarSize={40}
          animationDuration={700}
          animationEasing="ease-out"
          cursor="pointer"
          onClick={(entry) => {
            const p = (entry as unknown as { payload?: GastoPorMes }).payload;
            if (p) onSeleccionarMes(p.mes);
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export type GastoPorLavador = { lavadorId: string; nombre: string; total: number };

// Mismo estilo que el de producto específico, pero "¿a quién se le ha
// pagado cuánto en nómina?".
export function NominaPorLavadorChart({
  data,
  seleccionado,
  onSeleccionar,
}: {
  data: GastoPorLavador[];
  seleccionado: string | null;
  onSeleccionar: (lavadorId: string) => void;
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-[160px] items-center justify-center text-sm text-muted">
        Ningún gasto de Nómina de este período tiene un lavador asignado todavía.
      </p>
    );
  }

  const altura = Math.max(160, data.length * 40);

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
          cursor={{ fill: "var(--success)", fillOpacity: 0.06 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as GastoPorLavador;
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
          fill="var(--success)"
          radius={[0, 8, 8, 0]}
          maxBarSize={24}
          animationDuration={700}
          animationEasing="ease-out"
          cursor="pointer"
          fillOpacity={1}
          onClick={(entry) => {
            const p = (entry as unknown as { payload?: GastoPorLavador }).payload;
            if (p) onSeleccionar(p.lavadorId);
          }}
        >
          {data.map((d) => (
            <Cell key={d.lavadorId} fillOpacity={seleccionado && seleccionado !== d.lavadorId ? 0.35 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
