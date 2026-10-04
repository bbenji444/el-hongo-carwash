"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

type Mensaje = { id: string; rol: "usuario" | "asistente"; texto: string };

const PREGUNTAS_SUGERIDAS = [
  { icono: "💰", texto: "¿Ventas de hoy?" },
  { icono: "📊", texto: "¿Rendimiento semanal?" },
  { icono: "🧽", texto: "¿Lavadores activos?" },
  { icono: "📈", texto: "¿Cómo van las ventas este mes?" },
];

// Todavía no hay backend conectado (próxima fase: la API va a consultar la
// base de datos y responder con un modelo de IA) — esta respuesta es solo
// para que la UI se sienta completa mientras tanto.
const RESPUESTA_PLACEHOLDER =
  "Todavía no estoy conectado a tus datos reales — eso llega en la siguiente actualización. Por ahora esto es solo una vista previa. 🚧";

export function AiAssistantCard({ nombreUsuario }: { nombreUsuario: string }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hayConversacion = mensajes.length > 0;

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, enviando]);

  // Autoajusta el alto del textarea al texto escrito (estilo ChatGPT/Claude),
  // con un tope para que no se coma toda la tarjeta en un mensaje largo.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [texto]);

  function enviarPregunta(pregunta: string) {
    const limpio = pregunta.trim();
    if (!limpio || enviando) return;
    setMensajes((m) => [...m, { id: crypto.randomUUID(), rol: "usuario", texto: limpio }]);
    setTexto("");
    setEnviando(true);
    setTimeout(() => {
      setMensajes((m) => [...m, { id: crypto.randomUUID(), rol: "asistente", texto: RESPUESTA_PLACEHOLDER }]);
      setEnviando(false);
    }, 600);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    enviarPregunta(texto);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarPregunta(texto);
    }
  }

  return (
    <div className="flex h-[calc(100svh-12rem)] min-h-[420px] flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm sm:h-[34rem] lg:h-[38rem]">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-lg">🤖</span>
          <div>
            <p className="text-sm font-semibold text-foreground">El Hongo AI Assistant</p>
            <p className="text-[11px] text-muted">Próximamente conectado a tus datos</p>
          </div>
        </div>
        {hayConversacion && (
          <button
            type="button"
            onClick={() => setMensajes([])}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-surface-hover hover:text-foreground"
          >
            Nuevo chat
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {!hayConversacion ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl">🤖</span>
            <div>
              <h2 className="text-lg font-semibold text-foreground sm:text-xl">¿En qué te ayudo, {nombreUsuario}?</h2>
              <p className="mt-1 text-sm text-muted">Pregúntame sobre ventas, gastos, lavadores o cualquier cosa del negocio.</p>
            </div>
            <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
              {PREGUNTAS_SUGERIDAS.map((p) => (
                <button
                  key={p.texto}
                  type="button"
                  onClick={() => enviarPregunta(p.texto)}
                  className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm text-foreground transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="text-base">{p.icono}</span>
                  {p.texto}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {mensajes.map((m) =>
              m.rol === "usuario" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-white">
                    {m.texto}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm">
                    🤖
                  </span>
                  <p className="max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed text-foreground">{m.texto}</p>
                </div>
              )
            )}
            {enviando && (
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm">
                  🤖
                </span>
                <span className="flex items-center gap-1 py-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
                </span>
              </div>
            )}
            <div ref={finRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-border p-3 sm:p-4">
        <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 transition focus-within:border-accent">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Pregúntame sobre tu negocio..."
            className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={!texto.trim() || enviando}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-hover disabled:opacity-40"
            aria-label="Enviar"
          >
            ➤
          </button>
        </div>
      </form>
    </div>
  );
}
