-- ============================================================================
-- El Hongo Car Wash — Fase 30b: los 5 archivos de gastos que ya existían
-- antes de que se agregara la columna archivo_tipo se quedaron con
-- archivo_tipo = null. Eso los deja marcados como "no previsualizable" en la
-- app incluso al que sí es un PDF (que sí se puede mostrar). Aquí se infiere
-- el tipo a partir de la extensión del nombre de archivo guardado.
-- ============================================================================

update public.gastos
set archivo_tipo = case
  when archivo_nombre ilike '%.pdf' then 'application/pdf'
  when archivo_nombre ilike '%.heic' then 'image/heic'
  when archivo_nombre ilike '%.heif' then 'image/heif'
  when archivo_nombre ilike '%.jpg' or archivo_nombre ilike '%.jpeg' then 'image/jpeg'
  when archivo_nombre ilike '%.png' then 'image/png'
  when archivo_nombre ilike '%.webp' then 'image/webp'
  when archivo_nombre ilike '%.gif' then 'image/gif'
  else archivo_tipo
end
where archivo_tipo is null
  and archivo_nombre is not null;
