"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

const COLORES_LAVADORES = [
  "var(--primary)",
  "var(--accent)",
  "var(--success)",
  "var(--warning)",
  "#8b5cf6",
  "#0891b2",
];

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-0.5 font-medium text-foreground">{label}</p>
      <p className="flex items-center gap-1.5 text-muted">
        <span className="h-2 w-2 rounded-full" style={{ background: payload[0].color }} />
        {money(payload[0].value)}
      </p>
    </div>
  );
}

export function VentasPorServicioChart({ data }: { data: { nombre: string; total: number }[] }) {
  if (data.length === 0) {
    return <p className="flex h-[260px] items-center justify-center text-sm text-muted">Sin ventas todavía hoy.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="barVentas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="nombre" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} width={48} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--primary)", fillOpacity: 0.06 }} />
        <Bar
          dataKey="total"
          fill="url(#barVentas)"
          radius={[8, 8, 0, 0]}
          maxBarSize={56}
          animationDuration={700}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TendenciaVentasChart({ data }: { data: { etiqueta: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="areaTendencia" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="etiqueta" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} width={48} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: 4 }} />
        <Area
          type="monotone"
          dataKey="total"
          stroke="var(--accent)"
          strokeWidth={2.5}
          fill="url(#areaTendencia)"
          dot={{ r: 3, fill: "var(--accent)", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }}
          animationDuration={800}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function AutosPorLavadorChart({ data }: { data: { nombre: string; autos: number }[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-[260px] items-center justify-center text-sm text-muted">
        Sin lavados asignados en los últimos 7 días.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" allowDecimals={false} stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="nombre"
          stroke="var(--muted)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={90}
        />
        <Tooltip
          cursor={{ fill: "var(--primary)", fillOpacity: 0.06 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
                <p className="mb-0.5 font-medium text-foreground">{label}</p>
                <p className="text-muted">{payload[0].value} autos lavados</p>
              </div>
            );
          }}
        />
        <Bar dataKey="autos" radius={[0, 8, 8, 0]} maxBarSize={28} animationDuration={700} animationEasing="ease-out">
          {data.map((d, i) => (
            <Cell key={d.nombre} fill={COLORES_LAVADORES[i % COLORES_LAVADORES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RelacionLavadoresChart({
  data,
}: {
  data: { nombre: string; autos: number; tiempoMin: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-[260px] items-center justify-center text-sm text-muted">
        Aún no hay suficientes lavadas cronometradas (Iniciar → Terminado) en los últimos 7 días.
      </p>
    );
  }

  const promedioAutos = data.reduce((acc, d) => acc + d.autos, 0) / data.length;
  const promedioTiempo = data.reduce((acc, d) => acc + d.tiempoMin, 0) / data.length;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="tiempoMin"
          name="Tiempo promedio"
          unit=" min"
          stroke="var(--muted)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          label={{ value: "Tiempo promedio (min) — menos es mejor", position: "insideBottom", offset: -4, fontSize: 10, fill: "var(--muted)" }}
        />
        <YAxis
          type="number"
          dataKey="autos"
          name="Autos lavados"
          allowDecimals={false}
          stroke="var(--muted)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <ZAxis range={[120, 120]} />
        <ReferenceLine x={promedioTiempo} stroke="var(--border)" strokeDasharray="4 4" />
        <ReferenceLine y={promedioAutos} stroke="var(--border)" strokeDasharray="4 4" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3", stroke: "var(--muted)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as { nombre: string; autos: number; tiempoMin: number };
            return (
              <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
                <p className="mb-0.5 font-medium text-foreground">{p.nombre}</p>
                <p className="text-muted">{p.autos} autos lavados</p>
                <p className="text-muted">{p.tiempoMin.toFixed(0)} min promedio</p>
              </div>
            );
          }}
        />
        <Scatter data={data} animationDuration={700} animationEasing="ease-out">
          {data.map((d, i) => (
            <Cell key={d.nombre} fill={COLORES_LAVADORES[i % COLORES_LAVADORES.length]} />
          ))}
          <LabelList dataKey="nombre" position="top" fontSize={11} fill="var(--foreground)" />
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
