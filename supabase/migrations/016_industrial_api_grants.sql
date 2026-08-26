-- Migration 016: GRANTs mínimos API (Phase A) para tabelas industriais base.
-- Corrige privilégios efectivos: roles API tinham apenas TRUNCATE/REFERENCES/TRIGGER
-- (default ACL de postgres = Dxtm), sem SELECT/INSERT/UPDATE — causa do REST 403.
--
-- NÃO altera RLS nem policies (013 permanece; 015 continua PENDING / fora deste ficheiro).
-- NÃO toca em tabelas legado work_orders / work_order_tasks.
-- Idempotente: GRANT repetido é no-op seguro.

-- ---------------------------------------------------------------------------
-- anon + authenticated: mínimo alinhado ao frontend industrial (anon key;
-- authenticated se supabase.auth estiver activo no mesmo client).
-- Sem DELETE.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON public.industrial_work_orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.industrial_work_order_tasks TO anon, authenticated;
GRANT SELECT, INSERT ON public.industrial_work_order_events TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.industrial_piece_transforms TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.industrial_piece_edges TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.industrial_piece_operations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.industrial_piece_remates TO anon, authenticated;

GRANT SELECT, INSERT ON public.industrial_piece_quality TO anon, authenticated;
GRANT SELECT, INSERT ON public.industrial_piece_time_entries TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.system_settings TO anon, authenticated;
GRANT SELECT, INSERT ON public.system_events TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- service_role: SELECT apenas (CI verify / server). Sem CRUD completo.
-- INSERT em industrial_work_order_events omitido — CI actual só faz SELECT;
-- BFF de escrita trata-se na Phase B.
-- ---------------------------------------------------------------------------

GRANT SELECT ON public.industrial_work_orders TO service_role;
GRANT SELECT ON public.industrial_work_order_tasks TO service_role;
GRANT SELECT ON public.industrial_work_order_events TO service_role;
GRANT SELECT ON public.industrial_piece_transforms TO service_role;
GRANT SELECT ON public.industrial_piece_edges TO service_role;
GRANT SELECT ON public.industrial_piece_operations TO service_role;
GRANT SELECT ON public.industrial_piece_quality TO service_role;
GRANT SELECT ON public.industrial_piece_time_entries TO service_role;
GRANT SELECT ON public.industrial_piece_remates TO service_role;
GRANT SELECT ON public.system_settings TO service_role;
GRANT SELECT ON public.system_events TO service_role;
