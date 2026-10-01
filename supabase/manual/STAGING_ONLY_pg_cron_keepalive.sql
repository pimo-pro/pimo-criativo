-- =============================================================================
-- STAGING ONLY — NÃO APLICAR EM PRODUCTION
-- =============================================================================
-- Projecto alvo: PIMO-Staging (rszpnvmscehqapflaklv)
--
-- Objectivo: keepalive independente do GitHub Actions. O Free Plan pausa
-- projectos com pouca actividade DB (~7 dias). O workflow GitHub já faz
-- SELECTs REST, mas um aviso de pausa voltou a aparecer apesar do job Staging
-- estar verde — esta camada corre DENTRO do Postgres via pg_cron.
--
-- Como aplicar (manual, após rever):
--   1. Abrir o SQL Editor do projecto PIMO-Staging no dashboard Supabase
--   2. Confirmar que o project ref na URL é rszpnvmscehqapflaklv
--   3. Colar e executar este ficheiro completo
--   4. Verificar com as queries no final
--
-- NÃO incluir isto no pipeline de migrations de Production.
-- NÃO correr via workflow supabase-migrations.yml com target=production.
-- =============================================================================

-- Extensão (já costuma estar disponível no Supabase; IF NOT EXISTS é seguro)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Função idempotente: SELECT simples em system_settings (actividade DB real).
-- SECURITY DEFINER + search_path fixo para o job cron (role postgres) a poder
-- ler a tabela independentemente de RLS do role anon/authenticated.
CREATE OR REPLACE FUNCTION public.keepalive_ping_system_settings()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint FROM public.system_settings;
$$;

REVOKE ALL ON FUNCTION public.keepalive_ping_system_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.keepalive_ping_system_settings() TO postgres;

-- Remove job anterior com o mesmo nome (re-aplicar = idempotente)
DO $$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN
    SELECT jobid FROM cron.job WHERE jobname = 'pimo-staging-keepalive-system-settings'
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

-- Corre todos os dias às 09:00 UTC (desfasado do GitHub 08:00/20:00)
SELECT cron.schedule(
  'pimo-staging-keepalive-system-settings',
  '0 9 * * *',
  $cron$SELECT public.keepalive_ping_system_settings();$cron$
);

-- =============================================================================
-- Verificação (correr à parte depois de aplicar)
-- =============================================================================
-- SELECT jobid, jobname, schedule, command, active
-- FROM cron.job
-- WHERE jobname = 'pimo-staging-keepalive-system-settings';
--
-- -- Após o próximo tick (ou forçar manualmente):
-- SELECT public.keepalive_ping_system_settings();
--
-- SELECT *
-- FROM cron.job_run_details
-- WHERE jobid = (
--   SELECT jobid FROM cron.job
--   WHERE jobname = 'pimo-staging-keepalive-system-settings'
-- )
-- ORDER BY start_time DESC
-- LIMIT 5;
--
-- Remover (se necessário):
-- SELECT cron.unschedule(jobid)
-- FROM cron.job
-- WHERE jobname = 'pimo-staging-keepalive-system-settings';
-- =============================================================================
