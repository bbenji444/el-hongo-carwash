"use client";

import { useState, useTransition, type FormEvent } from "react";
import { CalendarClock } from "lucide-react";
import { diaMX } from "@/lib/fecha";
import { DIAS_ATRAS_MAX_TURNO, horaMX, nombreDiaTurno } from "@/lib/turnoDia";
import { abrirTurno } from "./actions";

const HORA_INICIO_DIA_ANTERIOR = "09:00";

// Hoy y los días anteriores que se pueden elegir, en hora de México.
function diasDisponibles() {
  const ahora = new Date();
  return Array.from({ length: DIAS_ATRAS_MAX_TURNO + 1 }, (_, n) => {
    const instante = new Date(ahora.getTime() - n * 24 * 3600 * 1000).toISOString();
    const fecha = diaMX(instante);
    const nombre = nombreDiaTurno(`${fecha}T12:00:00-06:00`, ahora);
    return { fecha, etiqueta: nombre.charAt(0).toUpperCase() + nombre.slice(1) };
  });
}

export function AbrirTurnoForm() {
  const [dias] = useState(diasDisponibles);
  const hoy = dias[0].fecha;
  const [fecha, setFecha] = useState(hoy);
  const [hora, setHora] = useState(() => horaMX(new Date()));
  const [horaEditada, setHoraEditada] = useState(false);
  const [efectivoInicial, setEfectivoInicial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const esOtroDia = fecha !== hoy;
  const etiquetaDia = dias.find((d) => d.fecha === fecha)?.etiqueta ?? fecha;

  function cambiarDia(nueva: string) {
    setFecha(nueva);
    // Si no ha tocado la hora, se sugiere una razonable para ese día.
    if (!horaEditada) setHora(nueva === hoy ? horaMX(new Date()) : HORA_INICIO_DIA_ANTERIOR);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const monto = Number(efectivoInicial);
    if (efectivoInicial.trim() === "" || !Number.isFinite(monto) || monto < 0) {
      setError("Ingresa un monto válido.");
      return;
    }
    if (!hora) {
      setError("Elige la hora de inicio del turno.");
      return;
    }
    if (!esOtroDia && hora > horaMX(new Date())) {
      setError("La hora de inicio no puede ser en el futuro.");
      return;
    }

    startTransition(async () => {
      const result = await abrirTurno(monto, { fecha, hora });
      if (result.error) setError(result.error);
    });
  }

  const claseCampo =
    "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-primary/40 bg-primary/5 p-6 text-center sm:p-10">
      <div>
        <p className="text-lg font-semibold text-foreground">No hay un turno abierto</p>
        <p className="text-sm text-muted">
          Abre el turno con el efectivo inicial de caja antes de registrar autos. Si se te pasó capturar el de un
          día anterior, elige ese día.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex w-full max-w-xl flex-col gap-3 text-left">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5 sm:col-span-1">
            <label htmlFor="turno-dia" className="text-xs font-medium text-muted">
              Día del turno
            </label>
            <select
              id="turno-dia"
              value={fecha}
              onChange={(e) => cambiarDia(e.target.value)}
              className={claseCampo}
              suppressHydrationWarning
            >
              {dias.map((d) => (
                <option key={d.fecha} value={d.fecha}>
                  {d.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="turno-hora" className="text-xs font-medium text-muted">
              Hora de inicio
            </label>
            <input
              id="turno-hora"
              type="time"
              value={hora}
              onChange={(e) => {
                setHora(e.target.value);
                setHoraEditada(true);
              }}
              className={claseCampo}
              suppressHydrationWarning
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="turno-efectivo" className="text-xs font-medium text-muted">
              Efectivo inicial
            </label>
            <input
              id="turno-efectivo"
              value={efectivoInicial}
              onChange={(e) => setEfectivoInicial(e.target.value)}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className={claseCampo}
              placeholder="0.00"
            />
          </div>
        </div>

        {esOtroDia && (
          <p className="flex items-start gap-2 rounded-lg border border-warning/60 bg-warning/15 px-3 py-2 text-sm text-foreground">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              Vas a abrir el turno de un día anterior: <strong>{etiquetaDia}</strong>. Los autos que registres en él
              quedarán con fecha de ese día. Al terminar, ciérralo en Caja y turnos con la hora en que terminó.
            </span>
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="self-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Abriendo..." : esOtroDia ? "Abrir turno de ese día" : "Abrir turno"}
        </button>
      </form>
      {error && <p className="text-sm text-primary">{error}</p>}
    </div>
  );
}
