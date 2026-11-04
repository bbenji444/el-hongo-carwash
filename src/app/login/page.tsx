"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, Lock, ShieldCheck, User } from "lucide-react";
import { iniciarSesionConUsuario } from "./actions";
import { FondoAnimado } from "@/components/FondoAnimado";

// API nativa del navegador para guardar credenciales tras un login exitoso
// — soportada en Chrome/Edge, no en Firefox/Safari, por eso va detrás de
// comprobar que exista antes de usarla.
declare global {
  interface Window {
    PasswordCredential?: {
      new (data: { id: string; password: string; name?: string }): Credential;
    };
  }
}

const MOTIVOS: Record<string, string> = {
  cuenta_inactiva: "Tu cuenta fue desactivada. Contacta al dueño.",
};

const DEGRADADO_MARCA = "linear-gradient(120deg, var(--primary), #ff8a3d, #facc15, var(--accent), var(--primary))";
const RESORTE = { type: "spring", stiffness: 260, damping: 24 } as const;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const motivo = searchParams.get("motivo");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState<string | null>(motivo ? MOTIVOS[motivo] ?? null : null);
  const [intentoFallido, setIntentoFallido] = useState(0);
  const [loading, setLoading] = useState(false);
  const tarjetaRef = useRef<HTMLDivElement>(null);

  // El login siempre se ve en modo oscuro (también cuando se llega aquí sin
  // recargar la página, p. ej. al cerrar sesión). Al salir, ya con sesión,
  // se aplica el tema del sistema: claro, salvo que se haya elegido oscuro.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("dark");
    return () => {
      let oscuro = false;
      try {
        oscuro = localStorage.getItem("tema") === "oscuro";
      } catch {
        // Sin acceso a localStorage: se queda el predeterminado (claro).
      }
      html.classList.toggle("dark", oscuro);
    };
  }, []);

  // A propósito NO se auto-rellena el usuario al cargar la página (antes
  // se hacía con navigator.credentials.get({mediation:"optional"}), pero
  // eso dejaba el campo "Usuario" pre-llenado con el último que inició
  // sesión en ESE dispositivo/navegador para CUALQUIERA que abriera la
  // página — un problema real en un dispositivo compartido del negocio.
  // El guardado de credenciales (de abajo, al iniciar sesión con éxito)
  // sigue funcionando: cada quien puede seleccionar su propio usuario
  // guardado desde el administrador de contraseñas del navegador tocando
  // el campo, pero ya no aparece solo, sin que nadie lo pida.

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: loginError } = await iniciarSesionConUsuario(usuario, password);

    if (loginError) {
      setError(loginError);
      setIntentoFallido((n) => n + 1);
      setLoading(false);
      return;
    }

    // Le pide al navegador que guarde usuario+contraseña para la próxima vez
    // (equivalente a que aparezca el aviso de "¿Guardar contraseña?", pero
    // sin depender de que el navegador lo detecte solo en un login por
    // JavaScript en vez de un submit normal de formulario).
    if (window.PasswordCredential) {
      try {
        await navigator.credentials.store(new window.PasswordCredential({ id: usuario, password, name: usuario }));
      } catch {
        // Si el navegador lo rechaza (p. ej. el usuario ya dijo "nunca para
        // este sitio"), no es un error que deba bloquear el login.
      }
    }

    // Cada vez que se inicia sesión, el sistema arranca en modo claro.
    try {
      localStorage.setItem("tema", "claro");
    } catch {
      // Sin acceso a localStorage: claro es el predeterminado de todos modos.
    }

    router.replace("/");
    router.refresh();
  }

  // Luz que sigue al cursor sobre la tarjeta (en celular simplemente no
  // aparece). Vía variables CSS, sin re-render en cada movimiento.
  function seguirCursor(e: MouseEvent<HTMLDivElement>) {
    const el = tarjetaRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  const claseCampo =
    "group/campo flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 transition-[border-color,box-shadow] duration-200 focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_22%,transparent)]";
  const claseIcono = "h-4 w-4 shrink-0 text-muted transition-colors duration-200 group-focus-within/campo:text-accent";
  // El autocompletado del navegador pinta el campo de azul claro; se tapa
  // con el mismo fondo del campo para que no se vea un recuadro encimado.
  const claseInput =
    "w-full bg-transparent py-2.5 text-foreground outline-none placeholder:text-muted/70 autofill:shadow-[inset_0_0_0_1000px_var(--background)] autofill:[-webkit-text-fill-color:var(--foreground)]";

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative isolate flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-6">
        <div className="absolute inset-0 -z-10">
          <FondoAnimado intensidad="intensa" />
        </div>

        {/* Logo + formulario, centrados en la pantalla */}
        <div className="w-full max-w-sm">
          <div className="mb-7 flex flex-col items-center gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 14 }}
            >
              <div className="animate-flotar relative h-[132px] w-[132px] sm:h-[148px] sm:w-[148px]">
                {/* Aro de colores girando y su resplandor */}
                <span aria-hidden className="animate-girar absolute -inset-3 rounded-full opacity-70 blur-xl" style={{ background: `conic-gradient(from 0deg, var(--primary), #ff8a3d, #facc15, var(--accent), var(--primary))` }} />
                <span aria-hidden className="animate-girar absolute -inset-[3px] rounded-full" style={{ background: `conic-gradient(from 0deg, var(--primary), #ff8a3d, #facc15, var(--accent), var(--primary))` }} />
                <Image
                  src="/logo.jpg"
                  alt="El Hongo Car Wash"
                  fill
                  sizes="148px"
                  className="rounded-full border-4 border-surface object-cover"
                  priority
                />
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...RESORTE, delay: 0.15 }}
              className="text-center"
            >
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                EL HONGO{" "}
                <span className="animate-degradado bg-clip-text text-transparent" style={{ backgroundImage: DEGRADADO_MARCA }}>
                  CAR WASH
                </span>
              </h1>
              <p className="mt-0.5 text-xs uppercase tracking-[0.25em] text-muted">Panel de administración</p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...RESORTE, delay: 0.25 }}
          >
            {/* Borde con degradado que se desplaza */}
            <div
              className="animate-degradado rounded-[1.35rem] p-[1.5px] shadow-[0_30px_70px_-30px_var(--primary)]"
              style={{ backgroundImage: DEGRADADO_MARCA }}
            >
              <div
                ref={tarjetaRef}
                onMouseMove={seguirCursor}
                className="group relative isolate overflow-hidden rounded-[1.3rem] bg-surface/85 p-6 backdrop-blur-xl"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%)",
                  }}
                />
                <div className="mb-5">
                  <p className="text-lg font-bold text-foreground">¡Hola de nuevo! 👋</p>
                  <p className="text-sm text-muted">Inicia sesión para continuar</p>
                </div>

                {/* method="post": si alguien envía antes de que cargue la
                    página por completo, el navegador no pone la contraseña
                    en la dirección (lo haría con el GET por omisión). */}
                <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="usuario" className="text-sm font-medium text-muted">
                      Usuario
                    </label>
                    <div className={claseCampo}>
                      <User className={claseIcono} />
                      <input
                        id="usuario"
                        name="usuario"
                        type="text"
                        required
                        autoComplete="username"
                        value={usuario}
                        onChange={(e) => setUsuario(e.target.value)}
                        className={claseInput}
                        placeholder="Benjamin"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="password" className="text-sm font-medium text-muted">
                      Contraseña
                    </label>
                    <div className={claseCampo}>
                      <Lock className={claseIcono} />
                      <input
                        id="password"
                        name="password"
                        type={verPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={claseInput}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setVerPassword((v) => !v)}
                        aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                      >
                        {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        key={intentoFallido}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto", x: [0, -8, 8, -5, 5, 0] }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.4 }}
                        className="overflow-hidden rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={loading ? undefined : { scale: 1.02 }}
                    whileTap={loading ? undefined : { scale: 0.97 }}
                    className="group/boton animate-degradado relative mt-1 flex items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3 font-semibold text-white shadow-[0_12px_26px_-12px_var(--primary)] transition-[box-shadow,opacity] duration-300 hover:shadow-[0_16px_34px_-12px_var(--primary)] disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ backgroundImage: "linear-gradient(120deg, var(--primary), color-mix(in srgb, var(--primary) 60%, #ff8a3d), var(--primary))" }}
                  >
                    <span
                      aria-hidden
                      className="animate-barrido pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    />
                    {loading ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        Entrar
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/boton:translate-x-1" />
                      </>
                    )}
                  </motion.button>
                </form>
              </div>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Acceso restringido. Las cuentas son creadas por el dueño.
          </motion.p>
        </div>
      </main>
    </MotionConfig>
  );
}
