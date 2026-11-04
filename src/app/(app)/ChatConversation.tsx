"use client";

import { Fragment, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { MascotaAvatar, MascotaConAnillo } from "./MascotaAvatar";
import { PREGUNTAS_SUGERIDAS, type ChatMensaje } from "./useAiChat";

// Un color por pregunta sugerida (en el mismo orden de PREGUNTAS_SUGERIDAS).
const COLORES_SUGERENCIA = ["var(--success)", "var(--accent)", "var(--primary)", "var(--warning)"];

const RESORTE = { type: "spring", stiffness: 380, damping: 28 } as const;

// El modelo a veces marca palabras con **negritas** — se muestran en
// negrita en vez de dejar los asteriscos.
function TextoConFormato({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
          <strong key={i} className="font-semibold text-foreground">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        )
      )}
    </>
  );
}

export function ChatConversation({
  mensajes,
  enviando,
  nombreUsuario,
  onSeleccionarPregunta,
  compact = false,
}: {
  mensajes: ChatMensaje[];
  enviando: boolean;
  nombreUsuario: string;
  onSeleccionarPregunta: (texto: string) => void;
  compact?: boolean;
}) {
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, enviando]);

  const hayConversacion = mensajes.length > 0;

  // Antes el estado vacío (sin mensajes) usaba "h-full" sin "flex-1": al no
  // participar del layout flex, el panel no se estiraba y en celular (donde
  // las 4 preguntas sugeridas se apilan en una sola columna y ocupan más
  // alto) el cuadro de texto de abajo quedaba empujado fuera del panel y
  // recortado por el "overflow-hidden" del contenedor. Ahora ambos estados
  // comparten el mismo contenedor "flex-1 overflow-y-auto": siempre llena
  // el espacio disponible entre el encabezado y el cuadro de texto, y si el
  // contenido no cabe, se desplaza en vez de recortarse.
  return (
    <div className={`flex-1 overflow-y-auto ${compact ? "px-3 py-3" : "px-4 py-4 sm:px-6"}`}>
      {!hayConversacion ? (
        <div className="flex h-full min-h-full flex-col items-center justify-center gap-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
          >
            <div className="animate-flotar">
              <MascotaConAnillo size={compact ? 64 : 84} grosor={3} />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...RESORTE, delay: 0.1 }}
          >
            <h2 className={`font-semibold text-foreground ${compact ? "text-base" : "text-lg sm:text-xl"}`}>
              ¿En qué te ayudo, <span className="text-gradient-brand">{nombreUsuario}</span>?
            </h2>
            {!compact && (
              <p className="mt-1 text-sm text-muted">Pregúntame sobre ventas, gastos, lavadores o cualquier cosa del negocio.</p>
            )}
          </motion.div>
          <div className={`grid w-full gap-2 ${compact ? "max-w-xs grid-cols-1" : "max-w-md grid-cols-1 sm:grid-cols-2"}`}>
            {PREGUNTAS_SUGERIDAS.map((p, i) => {
              const color = COLORES_SUGERENCIA[i % COLORES_SUGERENCIA.length];
              return (
                <motion.button
                  key={p.texto}
                  type="button"
                  onClick={() => onSeleccionarPregunta(p.texto)}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0, transition: { ...RESORTE, delay: 0.18 + i * 0.06 } }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  style={{ "--color": color } as React.CSSProperties}
                  className="group relative flex items-center gap-2.5 overflow-hidden rounded-xl border border-border bg-surface/80 px-3 py-2.5 text-left text-sm text-foreground shadow-sm backdrop-blur transition-[border-color,box-shadow] duration-300 hover:border-[var(--color)] hover:shadow-[0_10px_24px_-12px_var(--color)]"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{ background: "linear-gradient(120deg, color-mix(in srgb, var(--color) 12%, transparent), transparent 70%)" }}
                  />
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
                    style={{ background: "color-mix(in srgb, var(--color) 16%, transparent)" }}
                  >
                    {p.icono}
                  </span>
                  <span className="flex-1">{p.texto}</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 -translate-x-1 text-[var(--color)] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                </motion.button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={`mx-auto flex flex-col ${compact ? "gap-3" : "max-w-2xl gap-5"}`}>
          {mensajes.map((m) =>
            m.rol === "usuario" ? (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: 24, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={RESORTE}
                className="flex origin-bottom-right justify-end"
              >
                <div
                  className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-white shadow-[0_10px_22px_-12px_var(--primary)]"
                  style={{ backgroundImage: "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 55%, #ff8a3d))" }}
                >
                  {m.texto}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: -20, scale: 0.94 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={RESORTE}
                className="flex origin-bottom-left items-start gap-2.5"
              >
                <MascotaAvatar size={compact ? 26 : 32} className="mt-0.5 border-2 border-primary/30 shadow-sm" />
                <div className="relative max-w-[85%] overflow-hidden rounded-2xl rounded-tl-md border border-border bg-surface/90 px-4 py-2.5 shadow-sm backdrop-blur">
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-[2px]"
                    style={{ backgroundImage: "linear-gradient(90deg, var(--primary), #facc15, var(--accent))" }}
                  />
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    <TextoConFormato texto={m.texto} />
                  </p>
                </div>
              </motion.div>
            )
          )}
          {enviando && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5"
            >
              <MascotaConAnillo size={compact ? 24 : 30} grosor={2} />
              <span className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-border bg-surface/90 px-3.5 py-2.5 shadow-sm backdrop-blur">
                {["var(--primary)", "#facc15", "var(--accent)"].map((color, i) => (
                  <motion.span
                    key={color}
                    className="h-2 w-2 rounded-full"
                    style={{ background: color }}
                    animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                  />
                ))}
                <span className="ml-1 text-xs text-muted">Pensando…</span>
              </span>
            </motion.div>
          )}
          <div ref={finRef} />
        </div>
      )}
    </div>
  );
}
