"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 13,
};

function formatoMoneda(valor: unknown) {
  return [`$${Number(valor).toFixed(2)}`, "Ventas"] as [string, string];
}

export function VentasPorServicioChart({ data }: { data: { nombre: string; total: number }[] }) {
  if (data.length === 0) {
    return <p className="flex h-[260px] items-center justify-center text-sm text-muted">Sin ventas todavía hoy.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="nombre" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} width={48} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} formatter={formatoMoneda} />
        <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TendenciaVentasChart({ data }: { data: { etiqueta: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="etiqueta" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} width={48} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} formatter={formatoMoneda} />
        <Line type="monotone" dataKey="total" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
