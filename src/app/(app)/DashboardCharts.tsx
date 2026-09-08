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

export function VentasPorServicioChart({ data }: { data: { nombre: string; total: number; tickets: number }[] }) {
  if (data.length === 0) {
    return <p className="flex h-[260px] items-center justify-center text-sm text-muted">Sin ventas todavía hoy.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="barVentas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="nombre" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} width={48} />
        <Tooltip
          cursor={{ fill: "var(--primary)", fillOpacity: 0.06 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as { nombre: string; total: number; tickets: number };
            return (
              <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
                <p className="mb-0.5 font-medium text-foreground">{label}</p>
                <p className="flex items-center gap-1.5 text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} />
                  {money(p.total)}
                </p>
                <p className="text-muted">
                  {p.tickets} {p.tickets === 1 ? "vendido" : "vendidos"}
                </p>
              </div>
            );
          }}
        />
        <Bar
          dataKey="total"
          fill="url(#barVentas)"
          radius={[8, 8, 0, 0]}
          maxBarSize={56}
          animationDuration={700}
          animationEasing="ease-out"
        >
          <LabelList dataKey="tickets" position="top" fontSize={11} fill="var(--muted)" />
        </Bar>
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

// Escala de 6 colores (rojo -> naranja -> amarillo -> verde claro -> verde
// -> verde oscuro), repartida sobre el rango REAL que se observa entre los
// lavadores del período (no una escala fija 1-10) — así siempre se ve
// diferencia visual entre ellos, aunque todos anden en la parte alta de la
// calificación (que es lo esperado la mayoría del tiempo). Gris si el
// lavador todavía no tiene ninguna calificación (rollout gradual del KPI).
const PALETA_SATISFACCION = ["#dc2626", "#ea580c", "#facc15", "#a3e635", "#4ade80", "#16a34a"];

function colorPorSatisfaccion(valor: number | null, min: number, max: number) {
  if (valor === null) return "var(--muted)";
  if (max === min) return PALETA_SATISFACCION[PALETA_SATISFACCION.length - 1];
  const t = Math.max(0, Math.min(1, (valor - min) / (max - min)));
  const idx = Math.min(PALETA_SATISFACCION.length - 1, Math.floor(t * PALETA_SATISFACCION.length));
  return PALETA_SATISFACCION[idx];
}

export function RelacionLavadoresChart({
  data,
}: {
  data: {
    nombre: string;
    eficiencia: number;
    volumenAjustadoMin: number;
    satisfaccionProm: number | null;
    calificaciones: number;
  }[];
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-[260px] items-center justify-center text-sm text-muted">
        Aún no hay suficientes lavadas cronometradas (Iniciar → Terminado) en los últimos 7 días.
      </p>
    );
  }

  const promedioVolumen = data.reduce((acc, d) => acc + d.volumenAjustadoMin, 0) / data.length;
  const promedioEficiencia = data.reduce((acc, d) => acc + d.eficiencia, 0) / data.length;
  const satisfacciones = data.map((d) => d.satisfaccionProm).filter((v): v is number => v !== null);
  const minSatisfaccion = satisfacciones.length ? Math.min(...satisfacciones) : 0;
  const maxSatisfaccion = satisfacciones.length ? Math.max(...satisfacciones) : 0;

  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="eficiencia"
            name="Eficiencia"
            stroke="var(--muted)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            label={{
              value: "Índice de eficiencia — menos es mejor (1.0 = como el promedio)",
              position: "insideBottom",
              offset: -4,
              fontSize: 10,
              fill: "var(--muted)",
            }}
          />
          <YAxis
            type="number"
            dataKey="volumenAjustadoMin"
            name="Volumen ajustado"
            unit=" min"
            stroke="var(--muted)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <ZAxis dataKey="calificaciones" range={[80, 320]} />
          <ReferenceLine x={promedioEficiencia} stroke="var(--border)" strokeDasharray="4 4" />
          <ReferenceLine y={promedioVolumen} stroke="var(--border)" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: "var(--muted)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as {
                nombre: string;
                eficiencia: number;
                volumenAjustadoMin: number;
                satisfaccionProm: number | null;
                calificaciones: number;
              };
              return (
                <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
                  <p className="mb-0.5 font-medium text-foreground">{p.nombre}</p>
                  <p className="text-muted">Eficiencia: {p.eficiencia.toFixed(2)}</p>
                  <p className="text-muted">Volumen ajustado: {p.volumenAjustadoMin.toFixed(0)} min</p>
                  <p className="text-muted">
                    Satisfacción:{" "}
                    {p.satisfaccionProm !== null ? `${p.satisfaccionProm.toFixed(1)}/10 (n=${p.calificaciones})` : "sin datos"}
                  </p>
                </div>
              );
            }}
          />
          <Scatter data={data} animationDuration={700} animationEasing="ease-out">
            {data.map((d) => (
              <Cell
                key={d.nombre}
                fill={colorPorSatisfaccion(d.satisfaccionProm, minSatisfaccion, maxSatisfaccion)}
              />
            ))}
            <LabelList dataKey="nombre" position="top" fontSize={11} fill="var(--foreground)" />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          Baja
          {PALETA_SATISFACCION.map((c) => (
            <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
          ))}
          Alta (satisfacción relativa al grupo)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-muted" /> Sin calificaciones aún
        </span>
        <span>· Tamaño de burbuja = número de calificaciones</span>
      </div>
    </div>
  );
}
