const OFFSET_HORAS_MX = 6;

export function inicioDeDiaMX(diasAtras = 0): Date {
  const mx = new Date(Date.now() - OFFSET_HORAS_MX * 3600 * 1000);
  mx.setUTCHours(0, 0, 0, 0);
  mx.setUTCDate(mx.getUTCDate() - diasAtras);
  return new Date(mx.getTime() + OFFSET_HORAS_MX * 3600 * 1000);
}

export function diaMX(fechaIso: string): string {
  const mx = new Date(new Date(fechaIso).getTime() - OFFSET_HORAS_MX * 3600 * 1000);
  return mx.toISOString().slice(0, 10);
}

// Convierte una fecha "YYYY-MM-DD" (la que manda un <input type="date">) al
// instante exacto de inicio/fin de ese día en hora de México, sin depender
// del huso horario del servidor que ejecuta el código.
export function inicioDeDiaMXDesdeFecha(fechaStr: string): Date {
  return new Date(`${fechaStr}T00:00:00-06:00`);
}

export function finDeDiaMXDesdeFecha(fechaStr: string): Date {
  return new Date(`${fechaStr}T23:59:59.999-06:00`);
}
