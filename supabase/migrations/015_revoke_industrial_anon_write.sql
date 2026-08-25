-- Migration 015: Revogar anon write (e anon read aberto) das tabelas industriais.
-- Corrige 013_industrial_anon_rls.sql (FOR ALL TO anon USING (true)).
--
-- IMPORTANTE:
-- - Não apaga dados nem tabelas.
-- - Aplicar primeiro em staging.
-- - Após aplicar, o cliente browser com anon key NÃO consegue escrever.
-- - Leitura anónima também é revogada (dados industriais são AUTHORIZED DATA).
-- - Acesso futuro: BFF + service role (fases posteriores).

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'industrial_work_orders',
    'industrial_work_order_tasks',
    'industrial_work_order_events',
    'industrial_piece_transforms',
    'industrial_piece_edges',
    'industrial_piece_operations',
    'industrial_piece_quality',
    'industrial_piece_time_entries',
    'industrial_piece_remates',
    'system_settings',
    'system_events'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon write %1$s" ON public.%1$s', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "anon read %1$s" ON public.%1$s', tbl);
  END LOOP;
END $$;
