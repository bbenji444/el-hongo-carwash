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
