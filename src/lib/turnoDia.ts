import { diaMX } from "./fecha";

// Cada turno pertenece a UN día: el de su hora de apertura (en hora de
// México). Así se puede abrir "el turno del lunes" aunque hoy sea martes, y
// todo lo que se registre en él (autos y pagos) queda con fecha del lunes —
// los reportes, el dashboard y las comisiones lo cuentan en el día correcto
// aunque el registro se haya capturado tarde.

// Hasta cuántos días atrás se puede abrir un turno.
export const DIAS_ATRAS_MAX_TURNO = 7;

const UN_MINUTO = 60 * 1000;

// "YYYY-MM-DD" + "HH:MM" en hora de México → instante exacto.
export function instanteMX(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora}:00-06:00`);
}

// "HH:MM" (24 h) de un instante, en hora de México.
export function horaMX(fechaIso: string | Date): string {
  const mx = new Date(new Date(fechaIso).getTime() - 6 * 3600 * 1000);
  return mx.toISOString().slice(11, 16);
}

// Último minuto del día del turno (23:59 en hora de México).
function finDelDiaTurno(horaApertura: string): Date {
  return instanteMX(diaMX(horaApertura), "23:59");
}

export function esTurnoDeOtroDia(horaApertura: string, ahora = new Date()): boolean {
  return diaMX(horaApertura) !== diaMX(ahora.toISOString());
}

// Fecha y hora con la que se guarda un auto registrado en el turno:
//  - Turno de hoy: la hora real del registro.
//  - Turno de un día anterior: un minuto después del último auto registrado
//    en ese turno (o de la apertura, si es el primero), sin pasar de las
//    23:59 de ese día. Así quedan en el orden en que se capturaron y dentro
//    del día del turno.
export function momentoRegistro(horaApertura: string, ultimoRegistro: string | null, ahora = new Date()): string {
  if (!esTurnoDeOtroDia(horaApertura, ahora)) return ahora.toISOString();
  const base = Math.max(new Date(horaApertura).getTime(), ultimoRegistro ? new Date(ultimoRegistro).getTime() : 0);
  const momento = Math.min(base + UN_MINUTO, finDelDiaTurno(horaApertura).getTime());
  return new Date(momento).toISOString();
}

// "lunes 2 de noviembre" — para frases como "el turno del lunes 2 de noviembre".
export function fechaTurno(horaApertura: string): string {
  return new Date(`${diaMX(horaApertura)}T12:00:00-06:00`)
    .toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Mexico_City",
    })
    .replace(",", ""); // "lunes, 2 de noviembre" → "lunes 2 de noviembre"
}

// Igual, pero con "hoy"/"ayer" al frente cuando aplica (para listas y avisos).
export function nombreDiaTurno(horaApertura: string, ahora = new Date()): string {
  const dia = diaMX(horaApertura);
  const hoy = diaMX(ahora.toISOString());
  const ayer = diaMX(new Date(ahora.getTime() - 24 * 3600 * 1000).toISOString());
  const nombre = fechaTurno(horaApertura);
  if (dia === hoy) return `hoy, ${nombre}`;
  if (dia === ayer) return `ayer, ${nombre}`;
  return nombre;
}
