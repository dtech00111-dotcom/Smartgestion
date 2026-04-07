-- Smart Gestion - Planification expiration automatique des réservations
-- Sur Supabase hébergé : activer pg_cron / Integrations > Cron si besoin.
-- Sur Supabase local : le schéma "cron" est souvent absent → cette migration ne planifie rien (pas d'erreur).

-- Planifie l'expiration des réservations toutes les 5 minutes (uniquement si pg_cron est présent)
-- Pour désactiver sur hébergé : SELECT cron.unschedule('expire-old-reservations');
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron') THEN
    PERFORM cron.schedule(
      'expire-old-reservations',
      '*/5 * * * *',
      $cmd$SELECT public.expire_old_reservations()$cmd$
    );
  ELSE
    RAISE NOTICE '015_reservations_cron: schema cron absent (typique en local). Sur cloud, activer Cron / pg_cron ou exécuter manuellement public.expire_old_reservations().';
  END IF;
END $migration$;
