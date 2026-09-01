-- ============================================================================
-- El Hongo Car Wash — Fase 30: guarda el tipo MIME del archivo adjunto de
-- cada gasto, para poder decidir en la app cómo mostrarlo (imagen, PDF, o
-- "no se puede previsualizar" para formatos como HEIC que ningún navegador
-- puede mostrar directamente) sin tener que adivinarlo del nombre.
-- ============================================================================

alter table public.gastos
  add column if not exists archivo_tipo text;
