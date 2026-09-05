-- ============================================================================
-- El Hongo Car Wash — Fase 38: calificación del cliente (1-10) al entregar
-- el ticket, como nuevo KPI de satisfacción para medir el desempeño del
-- lavador junto con velocidad y volumen. Opcional a propósito (rollout
-- gradual): un ticket se puede entregar sin calificar.
-- ============================================================================

alter table public.tickets
  add column if not exists calificacion smallint check (calificacion between 1 and 10);
