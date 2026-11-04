"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MascotaConAnillo } from "./MascotaAvatar";
import { ChatConversation } from "./ChatConversation";
import { ChatInputBar } from "./ChatInputBar";
import { ChatEncabezado, ChatFondo } from "./ChatMarco";
import { useAiChat } from "./useAiChat";

// Burbuja flotante del AI Assistant — visible en todas las páginas menos el
// Dashboard (que ya trae la tarjeta grande). Lleva su propia conversación,
// independiente de la del Dashboard.
export function FloatingChatWidget({ nombreUsuario }: { nombreUsuario: string }) {
  const [abierto, setAbierto] = useState(false);
  const { mensajes, enviando, enviarPregunta, reiniciar } = useAiChat();
  const [texto, setTexto] = useState("");

  function enviar(valor: string) {
    enviarPregunta(valor);
    setTexto("");
  }

  return (
    <>
      <AnimatePresence>
        {abierto && (
          <motion.div
            key="fondo-chat"
            aria-hidden="true"
            onClick={() => setAbierto(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] sm:hidden"
          />
        )}

        {abierto && (
          <motion.div
            key="panel-chat"
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.92, transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="fixed inset-x-0 bottom-0 z-30 isolate flex h-[78svh] origin-bottom flex-col overflow-hidden rounded-t-3xl border-t border-border bg-surface shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] sm:inset-x-auto sm:bottom-24 sm:right-5 sm:h-[34rem] sm:w-[24rem] sm:origin-bottom-right sm:rounded-3xl sm:border"
          >
            <ChatFondo />
            <ChatEncabezado compact hayMensajes={mensajes.length > 0} onNuevo={reiniciar} onCerrar={() => setAbierto(false)} />
            <ChatConversation mensajes={mensajes} enviando={enviando} nombreUsuario={nombreUsuario} onSeleccionarPregunta={enviar} compact />
            <ChatInputBar texto={texto} setTexto={setTexto} onEnviar={enviar} enviando={enviando} compact />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Con el panel abierto, este botón quedaba justo encima del botón de
          "Enviar" del cuadro de texto en celular (ambos fixed bottom-right)
          y tapaba el envío de mensajes — se oculta mientras está abierto;
          la "✕" del encabezado del panel ya cierra el chat. */}
      <AnimatePresence>
        {!abierto && (
          <motion.div
            key="boton-chat"
            initial={{ opacity: 0, scale: 0.4, rotate: -30 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.4, rotate: 30, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="group fixed bottom-5 right-5 z-30"
          >
            {/* Globito "¿Te ayudo?" al pasar el mouse (computadora) */}
            <span className="pointer-events-none absolute bottom-full right-0 mb-2 hidden translate-y-1 whitespace-nowrap rounded-xl rounded-br-sm bg-foreground px-3 py-1.5 text-xs font-medium text-background opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 sm:block">
              ¿Te ayudo con algo? ✨
            </span>
            {/* La flotación (animación CSS) va en un envoltorio aparte: si
                fuera en el mismo botón, taparía el "transform" del hover. */}
            <span className="animate-flotar block">
              <motion.button
                type="button"
                onClick={() => setAbierto(true)}
                aria-label="Abrir chat con El Hongo AI Assistant"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                className="relative flex h-16 w-16 items-center justify-center rounded-full"
              >
                {/* Halo que late detrás del botón */}
                <span aria-hidden className="absolute inset-1 animate-ping rounded-full bg-primary/25 [animation-duration:2.6s]" />
                <span className="relative rounded-full bg-surface shadow-[0_10px_28px_-8px_var(--primary)]">
                  <MascotaConAnillo size={52} grosor={3} enLinea />
                </span>
              </motion.button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
