-- ============================================================================
-- El Hongo Car Wash — Fase 26: registra cuánto tarda cada lavada real (de
-- "Iniciar" a "Terminado"), para poder promediarlo por lavador.
--
-- hora_cambio_estado ya existía, pero se sobreescribe en CADA cambio de
-- estado (en_espera→en_proceso, en_proceso→terminado, terminado→entregado),
-- así que para cuando un ticket llega a "entregado" ya se perdió el
-- instante exacto en que empezó a lavarse. Se agregan dos columnas nuevas
-- que no se vuelven a tocar una vez puestas:
--   - hora_inicio_lavado: se llena al pasar a "en_proceso" (botón Iniciar).
--   - hora_fin_lavado: se llena al pasar a "terminado" (botón Terminar).
-- ============================================================================

alter table public.tickets
  add column if not exists hora_inicio_lavado timestamptz,
  add column if not exists hora_fin_lavado timestamptz;
