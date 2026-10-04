"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

const COLORES = ["var(--primary)", "var(--accent)", "var(--warning)", "#8b5cf6", "#0891b2", "var(--success)"];

export type VentaPorServicio = { servicioId: string; nombre: string; tickets: number; total: number };

// Dona por paquete — "¿qué servicio vende más?". Clic en una rebanada o en
// su nombre en la leyenda filtra el resto de la página por ese paquete.
export function VentasPorServicioChart({
  data,
  seleccionado,
  onSeleccionar,
}: {
  data: VentaPorServicio[];
  seleccionado: string | null;
  onSeleccionar: (servicioId: string) => void;
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-[220px] items-center justify-center text-sm text-muted">Sin ventas en este período.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as VentaPorServicio;
            return (
              <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
                <p className="font-medium text-foreground">{p.nombre}</p>
                <p className="text-muted">
                  {money(p.total)} · {p.tickets} ticket{p.tickets === 1 ? "" : "s"}
                </p>
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
            const p = (entry as unknown as { payload?: VentaPorServicio }).payload;
            if (p) onSeleccionar(p.servicioId);
          }}
        >
          {data.map((d, i) => (
            <Cell
              key={d.servicioId}
              fill={COLORES[i % COLORES.length]}
              fillOpacity={seleccionado && seleccionado !== d.servicioId ? 0.35 : 1}
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
            const match = data.find((d) => d.nombre === legendEntry.value);
            if (match) onSeleccionar(match.servicioId);
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export type VentaPorTamano = { tamano: string; nombre: string; tickets: number; total: number };

// Dona por tamaño de vehículo — "¿qué tamaño de carro atiendo más?".
export function VentasPorTamanoChart({
  data,
  seleccionado,
  onSeleccionar,
}: {
  data: VentaPorTamano[];
  seleccionado: string | null;
  onSeleccionar: (tamano: string) => void;
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-[220px] items-center justify-center text-sm text-muted">Sin ventas en este período.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as VentaPorTamano;
            return (
              <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
                <p className="font-medium text-foreground">{p.nombre}</p>
                <p className="text-muted">
                  {money(p.total)} · {p.tickets} ticket{p.tickets === 1 ? "" : "s"}
                </p>
              </div>
            );
          }}
        />
        <Pie
          data={data}
          dataKey="total"
          nameKey="nombre"
          innerRadius={56}
          outerRadius={92}
          paddingAngle={data.length > 1 ? 2 : 0}
          cursor="pointer"
          animationDuration={700}
          animationEasing="ease-out"
          onClick={(entry) => {
            const p = (entry as unknown as { payload?: VentaPorTamano }).payload;
            if (p) onSeleccionar(p.tamano);
          }}
        >
          {data.map((d, i) => (
            <Cell
              key={d.tamano}
              fill={COLORES[i % COLORES.length]}
              fillOpacity={seleccionado && seleccionado !== d.tamano ? 0.35 : 1}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Legend
          verticalAlign="bottom"
          height={40}
          wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
          formatter={(value) => <span style={{ color: "var(--foreground)" }}>{value}</span>}
          onClick={(legendEntry) => {
            const match = data.find((d) => d.nombre === legendEntry.value);
            if (match) onSeleccionar(match.tamano);
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export type VentaPorMetodo = { metodo: string; nombre: string; total: number };

// Dona por método de pago — "¿cómo me están pagando?".
export function VentasPorMetodoChart({
  data,
  seleccionado,
  onSeleccionar,
}: {
  data: VentaPorMetodo[];
  seleccionado: string | null;
  onSeleccionar: (metodo: string) => void;
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-[220px] items-center justify-center text-sm text-muted">Sin ventas en este período.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as VentaPorMetodo;
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
          innerRadius={56}
          outerRadius={92}
          paddingAngle={data.length > 1 ? 2 : 0}
          cursor="pointer"
          animationDuration={700}
          animationEasing="ease-out"
          onClick={(entry) => {
            const p = (entry as unknown as { payload?: VentaPorMetodo }).payload;
            if (p) onSeleccionar(p.metodo);
          }}
        >
          {data.map((d, i) => (
            <Cell
              key={d.metodo}
              fill={COLORES[i % COLORES.length]}
              fillOpacity={seleccionado && seleccionado !== d.metodo ? 0.35 : 1}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Legend
          verticalAlign="bottom"
          height={40}
          wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
          formatter={(value) => <span style={{ color: "var(--foreground)" }}>{value}</span>}
          onClick={(legendEntry) => {
            const match = data.find((d) => d.nombre === legendEntry.value);
            if (match) onSeleccionar(match.metodo);
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export type VentaPorMes = { mes: string; etiqueta: string; total: number };

// Barras verticales, una por mes (últimos 12) — tendencia de ventas en el
// tiempo. Clic en un mes manda a ver ese mes específico.
export function VentasPorMesChart({ data, onSeleccionarMes }: { data: VentaPorMes[]; onSeleccionarMes: (mes: string) => void }) {
  const sinDatos = data.every((d) => d.total === 0);
  if (sinDatos) {
    return (
      <p className="flex h-[220px] items-center justify-center text-sm text-muted">
        Sin ventas registradas en los últimos 12 meses.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="barVentasMes" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--success)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--success)" stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="etiqueta" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} width={56} />
        <Tooltip
          cursor={{ fill: "var(--success)", fillOpacity: 0.06 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as VentaPorMes;
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
          fill="url(#barVentasMes)"
          radius={[6, 6, 0, 0]}
          maxBarSize={40}
          animationDuration={700}
          animationEasing="ease-out"
          cursor="pointer"
          onClick={(entry) => {
            const p = (entry as unknown as { payload?: VentaPorMes }).payload;
            if (p) onSeleccionarMes(p.mes);
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
