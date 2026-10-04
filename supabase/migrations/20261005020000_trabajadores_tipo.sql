-- ============================================================================
-- "Lavadores" pasa a ser "Trabajadores": no todos los que se pagan en
-- Nómina lavan autos (ej. Fani es la encargada). Se agrega un tipo para
-- poder diferenciarlos — ambos siguen saliendo en el selector de Nómina de
-- Gastos, pero solo "lavador" sale en el selector de asignar quién lava un
-- carro en Tickets.
-- ============================================================================

create type public.lavador_tipo as enum ('lavador', 'encargado');

alter table public.lavadores
  add column tipo public.lavador_tipo not null default 'lavador';

update public.lavadores set tipo = 'encargado' where nombre = 'Fani';
