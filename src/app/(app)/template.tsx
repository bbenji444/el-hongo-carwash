"use client";

import { motion } from "motion/react";

// Transición suave al cambiar de sección (Next vuelve a montar el template
// en cada navegación). Al terminar, Motion deja "transform: none", así los
// modales con "position: fixed" de cada página se siguen ubicando respecto
// a la pantalla y no respecto a este contenedor.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
