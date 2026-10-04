"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type Mensaje = { id: string; rol: "usuario" | "asistente"; texto: string };

const PREGUNTAS_SUGERIDAS = ["¿Ventas de hoy?", "¿Rendimiento semanal?", "¿Lavadores activos?"];

// Todavía no hay backend conectado (próxima fase: la API va a consultar la
// base de datos y responder con un modelo de IA) — esta respuesta es solo
// para que la UI se sienta completa mientras tanto.
const RESPUESTA_PLACEHOLDER =
  "Todavía no estoy conectado a tus datos reales — eso llega en la siguiente actualización. Por ahora esto es solo una vista previa. 🚧";

export function AiAssistantCard({ nombreUsuario }: { nombreUsuario: string }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: "saludo",
      rol: "asistente",
      texto: `¡Hola ${nombreUsuario}! Soy tu asistente de El Hongo Car Wash, impulsado por IA. ¿Cómo puedo ayudarte hoy?`,
    },
  ]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensajes]);

  function enviarPregunta(pregunta: string) {
    const limpio = pregunta.trim();
    if (!limpio || enviando) return;
    setMensajes((m) => [...m, { id: crypto.randomUUID(), rol: "usuario", texto: limpio }]);
    setTexto("");
    setEnviando(true);
    setTimeout(() => {
      setMensajes((m) => [...m, { id: crypto.randomUUID(), rol: "asistente", texto: RESPUESTA_PLACEHOLDER }]);
      setEnviando(false);
    }, 500);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    enviarPregunta(texto);
  }

  return (
    <div className="hover-lift animate-in rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base">🤖</span>
        <div>
          <h2 className="font-semibold text-foreground">El Hongo AI Assistant</h2>
          <p className="text-[11px] text-muted">Impulsado por IA · próximamente conectado a tus datos</p>
        </div>
      </div>

      <div className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
        {mensajes.map((m) => (
          <div key={m.id} className={`flex ${m.rol === "usuario" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.rol === "usuario" ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm bg-surface-hover text-foreground"
              }`}
            >
              {m.texto}
            </div>
          </div>
        ))}
        {enviando && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-surface-hover px-3 py-2 text-sm text-muted">Pensando…</div>
          </div>
        )}
        <div ref={finRef} />
      </div>

      {mensajes.length <= 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {PREGUNTAS_SUGERIDAS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => enviarPregunta(p)}
              className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Enviar un mensaje..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!texto.trim() || enviando}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition hover:bg-primary-hover disabled:opacity-40"
          aria-label="Enviar"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
